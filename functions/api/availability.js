import { json, badRequest, addMinutesToLocal, weekdayFromDate, parseTimeToMinutes, minutesToTime } from "../_lib/helpers.js";

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const serviceId = url.searchParams.get("serviceId");
  const barberId = url.searchParams.get("barberId");
  const date = url.searchParams.get("date"); // YYYY-MM-DD

  if (!serviceId || !barberId || !date) return badRequest("serviceId, barberId и date обязательны.");

  const db = env.DB;
  const svc = (await db.prepare("SELECT duration_min FROM services WHERE id=? AND active=1")
    .bind(serviceId).first());
  if (!svc) return badRequest("Услуга не найдена.");

  const duration = Number(svc.duration_min);
  const step = Number(env.SLOT_STEP_MIN || 15);
  const holdMin = Number(env.HOLD_MINUTES || 15);

  const weekday = weekdayFromDate(date);

  const wh = (await db.prepare(
    "SELECT start_time,end_time FROM working_hours WHERE barber_id=? AND weekday=? LIMIT 1"
  ).bind(barberId, weekday).first());

  // Если для мастера на этот день не задан график — считаем, что он не работает.
  if (!wh) return json({ slots: [] });

  const startWorkMin = parseTimeToMinutes(wh.start_time);
  const endWorkMin = parseTimeToMinutes(wh.end_time);

  // Заблокированные/занятые интервалы
  const nowIso = new Date().toISOString();
  const bookings = (await db.prepare(
    `SELECT start_local,end_local,status,created_at,expires_at
     FROM bookings
     WHERE barber_id=?
       AND date=?
       AND (
            status='confirmed'
            OR (status='pending' AND expires_at > ?)
       )`
  ).bind(barberId, date, nowIso).all()).results;

  const blocked = bookings.map(b => ({
    start: b.start_local,
    end: b.end_local
  }));

  // Генерация слотов
  const slots = [];
  for (let m = startWorkMin; m + duration <= endWorkMin; m += step) {
    const startTime = minutesToTime(m);
    const endTime = minutesToTime(m + duration);
    const startLocal = `${date}T${startTime}`;
    const endLocal = `${date}T${endTime}`;

    // проверяем пересечение с blocked
    let ok = true;
    for (const blk of blocked) {
      // overlap if NOT (end <= blk.start OR start >= blk.end)
      if (!(endLocal <= blk.start || startLocal >= blk.end)) {
        ok = false;
        break;
      }
    }
    if (ok) slots.push(startLocal);
  }

  return json({ slots });
}
