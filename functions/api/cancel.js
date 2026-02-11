import { json, badRequest, requireEnv, localToDate } from "../_lib/helpers.js";

async function cloudPaymentsRefund(env, transactionId, amount) {
  const publicId = requireEnv(env, "CLOUDPAYMENTS_PUBLIC_ID");
  const apiSecret = requireEnv(env, "CLOUDPAYMENTS_API_SECRET");

  const auth = btoa(`${publicId}:${apiSecret}`);
  const res = await fetch("https://api.cloudpayments.ru/payments/refund", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ TransactionId: transactionId, Amount: amount }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.Success !== true) {
    const msg = data?.Message || `CloudPayments refund error (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;

  let body;
  try { body = await request.json(); } catch { return badRequest("Неверный JSON."); }
  const token = body?.cancelToken?.trim();
  if (!token) return badRequest("cancelToken обязателен.");

  const row = await db.prepare(
    `SELECT b.id,b.status,b.start_local,b.cp_transaction_id,
            s.price_cents
     FROM bookings b
     JOIN services s ON s.id=b.service_id
     WHERE b.cancel_token=?
     LIMIT 1`
  ).bind(token).first();

  if (!row) return badRequest("Код не найден.", 404);
  if (row.status === "canceled") return json({ status: "already_canceled" });

  // Optional: cancellation deadline (in hours) before appointment time.
  // We treat start_local as local time and convert it using a fixed offset.
  const deadlineHours = Number(env.CANCEL_DEADLINE_HOURS || 6);
  const tz = env.TIMEZONE_OFFSET || "+03:00"; // Moscow by default
  const start = localToDate(row.start_local, tz);
  const diffHours = (start.getTime() - Date.now()) / (1000 * 60 * 60);
  const allow = diffHours >= deadlineHours;

  // Cancel booking
  await db.prepare(`UPDATE bookings SET status='canceled' WHERE id=?`).bind(row.id).run();

  // Optional auto-refund only if enabled and a payment_intent exists and cancellation is in time.
  const autoRefund = String(env.AUTO_REFUND || "false").toLowerCase() === "true";
  if (autoRefund && row.cp_transaction_id && allow) {
    const amount = Number((Number(row.price_cents) / 100).toFixed(2));
    try {
      await cloudPaymentsRefund(env, Number(row.cp_transaction_id), amount);
    } catch (e) {
      // Refund failed; keep canceled but report warning
      return json({ status: "canceled_but_refund_failed", message: e.message });
    }
    return json({ status: "canceled_and_refunded" });
  }

  if (!allow) return json({ status: "canceled_no_refund_deadline" });
  return json({ status: "canceled" });
}
