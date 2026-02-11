import { json, badRequest } from "../_lib/helpers.js";

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  // Для CloudPayments мы ищем запись по booking_id (=InvoiceId)
  const bookingId = url.searchParams.get("booking_id") || url.searchParams.get("id");
  if (!bookingId) return badRequest("booking_id обязателен.");

  const db = env.DB;

  const row = await db.prepare(
    `SELECT b.date,b.start_local,b.end_local,b.cancel_token,b.status,
            s.name as service_name,
            br.name as barber_name
     FROM bookings b
     JOIN services s ON s.id=b.service_id
     JOIN barbers br ON br.id=b.barber_id
     WHERE b.id=?
     LIMIT 1`
  ).bind(bookingId).first();

  if (!row) {
    return badRequest(
      "Запись не найдена. Если вы только что оплатили — подождите 5–10 секунд и обновите.",
      404
    );
  }

  // For privacy: only show cancel token if active
  if (row.status !== "confirmed" && row.status !== "pending") {
    return badRequest("Запись не активна.", 400);
  }

  return json({
    date: row.date,
    start_local: row.start_local,
    end_local: row.end_local,
    service_name: row.service_name,
    barber_name: row.barber_name,
    cancel_token: row.cancel_token,
    status: row.status,
  });
}
