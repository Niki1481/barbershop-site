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

  // On fail we освобождаем слот (делаем отмену pending записи)
  const invoiceId = payload?.InvoiceId || payload?.invoiceId;
  if (invoiceId) {
    await db.prepare(
      `UPDATE bookings
       SET status='canceled', cp_payment_status=?
       WHERE id=? AND status='pending'`
    ).bind("failed", invoiceId).run();
  }

  return jsonCode(0);
}
