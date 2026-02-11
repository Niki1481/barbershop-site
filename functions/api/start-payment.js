import { json, badRequest, randomToken, addMinutesToLocal, requireEnv } from "../_lib/helpers.js";

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;

  let body;
  try { body = await request.json(); } catch { return badRequest("Неверный JSON."); }

  const { serviceId, barberId, date, startLocal, customer } = body || {};
  if (!serviceId || !barberId || !date || !startLocal) {
    return badRequest("Не хватает данных (serviceId/barberId/date/startLocal).");
  }
  if (!customer?.name || !customer?.phone) return badRequest("Имя и телефон обязательны.");

  // Read service/barber
  const svc = await db
    .prepare("SELECT id,name,duration_min,price_cents FROM services WHERE id=? AND active=1")
    .bind(serviceId)
    .first();
  if (!svc) return badRequest("Услуга не найдена.");

  const brb = await db
    .prepare("SELECT id,name FROM barbers WHERE id=? AND active=1")
    .bind(barberId)
    .first();
  if (!brb) return badRequest("Мастер не найден.");

  const duration = Number(svc.duration_min);
  const priceCents = Number(svc.price_cents);
  const holdMinutes = Number(env.HOLD_MINUTES || 15);
  const currency = (env.CURRENCY || "RUB").toUpperCase();

  const endLocal = addMinutesToLocal(startLocal, duration);

  // Expiration for pending holds (server time, ISO)
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + holdMinutes * 60 * 1000).toISOString();

  const bookingId = crypto.randomUUID();
  const cancelToken = randomToken(24);

  // Ensure still free and insert pending booking atomically
  // SQLite trick: INSERT ... SELECT ... WHERE NOT EXISTS ...
  const insertSql = `
    INSERT INTO bookings (
      id, barber_id, service_id, date, start_local, end_local,
      status, customer_name, customer_phone, customer_email,
      cancel_token, created_at, expires_at
    )
    SELECT
      ?,?,?,?,?,?,
      'pending',?,?,?,?,?,?,?
    WHERE NOT EXISTS (
      SELECT 1 FROM bookings
      WHERE barber_id=?
        AND date=?
        AND (
          status='confirmed'
          OR (status='pending' AND expires_at > ?)
        )
        AND NOT (? >= end_local OR ? <= start_local)
    );
  `;

  const stmt = db.prepare(insertSql).bind(
    bookingId, barberId, serviceId, date, startLocal, endLocal,
    customer.name.trim(),
    customer.phone.trim(),
    (customer.email || null),
    cancelToken,
    nowIso,
    expiresAt,
    barberId,
    date,
    nowIso,
    startLocal,
    endLocal
  );

  const res = await stmt.run();
  if (res.success !== true || (res.meta && res.meta.changes === 0)) {
    return badRequest("Это время уже занято. Обновите страницу и выберите другой слот.");
  }

  // CloudPayments Widget parameters
  // PublicId безопасно отдавать на фронт, а API Secret держим только в переменных окружения.
  let publicId;
  try {
    publicId = requireEnv(env, "CLOUDPAYMENTS_PUBLIC_ID");
  } catch (e) {
    return badRequest(e.message, 500);
  }
  const amount = Number((priceCents / 100).toFixed(2));
  const description = `${svc.name} — ${brb.name}`;

  const origin = new URL(request.url).origin;

  return json({
    booking_id: bookingId,
    cancel_token: cancelToken,
    amount,
    currency,
    description,
    public_id: publicId,
    account_id: customer.phone.trim(),
    email: (customer.email || null),
    expires_at: expiresAt,
    // Подскажем URLs для уведомлений (их нужно прописать в ЛК CloudPayments)
    notify_urls: {
      check: `${origin}/api/cloudpayments-check`,
      pay: `${origin}/api/cloudpayments-pay`,
      fail: `${origin}/api/cloudpayments-fail`,
    },
  });
}
