import { badRequest, requireEnv } from "../_lib/helpers.js";
import { verifyCloudPaymentsHmac, jsonCode } from "./_lib/cloudpayments.js";

async function readMessage(request) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    // For GET notifications message is querystring without leading '?'
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
  const accountId = payload?.AccountId || payload?.accountId;
  if (!invoiceId) return jsonCode(10); // invalid order number
  if (!accountId) return jsonCode(11);
  if (!Number.isFinite(amount)) return jsonCode(12);

  const row = await db.prepare(
    `SELECT b.status,b.expires_at,s.price_cents
     FROM bookings b
     JOIN services s ON s.id=b.service_id
     WHERE b.id=?
     LIMIT 1`
  ).bind(invoiceId).first();

  if (!row) return jsonCode(10);
  if (row.status === "confirmed" || row.status === "canceled") return jsonCode(13);

  const nowIso = new Date().toISOString();
  if (String(row.expires_at) <= nowIso) return jsonCode(20);

  const expected = Number((Number(row.price_cents) / 100).toFixed(2));
  if (Math.abs(expected - amount) > 0.009) return jsonCode(12);

  return jsonCode(0);
}
