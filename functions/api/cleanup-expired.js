import { json } from "../_lib/helpers.js";

// Optional endpoint you can call manually to clean expired pending bookings.
// But we also provide a cron-trigger worker example in README.
export async function onRequestPost(context) {
  const { env } = context;
  const db = env.DB;
  const nowIso = new Date().toISOString();
  await db.prepare(
    "UPDATE bookings SET status='canceled' WHERE status='pending' AND expires_at <= ?"
  ).bind(nowIso).run();
  return json({ ok: true });
}
