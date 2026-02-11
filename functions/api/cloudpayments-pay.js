import { badRequest, requireEnv } from "../_lib/helpers.js";
import { verifyCloudPaymentsHmac, jsonCode } from "./_lib/cloudpayments.js";

async function readMessage(request) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    return {
      rawMessage: url.searchParams.toString(),
      payload: Object.fromEntries(url.searchParams.entries()),
    };
  }
  const raw = await request.text();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }
  return { rawMessage: raw, payload };
}

export async function onRequest(context) {
  const { env, request } = context;
  const db = env.DB;

  const apiSecret = requireEnv(env, "CLOUDPAYMENTS_API_SECRET");
  const { rawMessage, payload } = await readMessage(request);

  const ok = await verifyCloudPaymentsHmac({
    apiSecret,
    rawMessage,
    headerX: request.headers.get("X-Content-HMAC"),
    headerEncoded: request.headers.get("Content-HMAC"),
  });
  if (!ok) return badRequest("Invalid signature", 400);

  const invoiceId = payload?.InvoiceId || payload?.invoiceId;
  const amount = Number(payload?.Amount ?? payload?.amount);
  const transactionId = Number(payload?.TransactionId ?? payload?.transactionId);
  if (!invoiceId) return jsonCode(0);

  // Validate amount against what we have in DB (extra safety)
  const row = await db.prepare(
    `SELECT b.status,s.price_cents
     FROM bookings b
     JOIN services s ON s.id=b.service_id
     WHERE b.id=?
     LIMIT 1`
  ).bind(invoiceId).first();

  if (!row) return jsonCode(0);

  const expected = Number((Number(row.price_cents) / 100).toFixed(2));
  if (Number.isFinite(amount) && Math.abs(expected - amount) > 0.009) {
    // If amount mismatches, don't confirm booking. Still отвечаем code:0, чтобы CloudPayments не ретраил бесконечно.
    await db.prepare(
      "UPDATE bookings SET cp_payment_status=? WHERE id=?"
    ).bind("amount_mismatch", invoiceId).run();
    return jsonCode(0);
  }

  // Confirm booking
  await db.prepare(
    `UPDATE bookings
     SET status='confirmed', cp_transaction_id=?, cp_payment_status=?
     WHERE id=?`
  ).bind(
    Number.isFinite(transactionId) ? transactionId : null,
    "paid",
    invoiceId
  ).run();

  return jsonCode(0);
}
