import { json } from "../_lib/helpers.js";

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  const shop = {
    shop_name: env.SHOP_NAME || "Барбершоп",
    shop_tagline: env.SHOP_TAGLINE || "Онлайн запись 24/7",
    contacts_html: env.CONTACTS_HTML || "",
    currency: (env.CURRENCY || "rub").toLowerCase(),
    payment_provider: "cloudpayments",
    cloudpayments_public_id: env.CLOUDPAYMENTS_PUBLIC_ID || null,
    timezone_offset: env.TIMEZONE_OFFSET || "+03:00",
    slot_step_min: Number(env.SLOT_STEP_MIN || 15),
    hold_minutes: Number(env.HOLD_MINUTES || 15),
    cancel_deadline_hours: Number(env.CANCEL_DEADLINE_HOURS || 6),
  };

  const services = (await db.prepare(
    "SELECT id,name,duration_min,price_cents FROM services WHERE active=1 ORDER BY sort_order ASC, name ASC"
  ).all()).results;

  const barbers = (await db.prepare(
    "SELECT id,name,bio,photo_url FROM barbers WHERE active=1 ORDER BY sort_order ASC, name ASC"
  ).all()).results;

  return json({ ...shop, services, barbers });
}
