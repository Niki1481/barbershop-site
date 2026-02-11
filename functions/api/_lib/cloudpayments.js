// Shared helpers for CloudPayments notifications (Check/Pay/Fail/etc.)
// Docs: notifications contain X-Content-HMAC / Content-HMAC headers with base64(HMAC-SHA256(body, ApiSecret)).

function timingSafeEqual(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  let out = 0;
  for (let i = 0; i < a.byteLength; i++) out |= a[i] ^ b[i];
  return out === 0;
}

function bytesToBase64(bytes) {
  // btoa expects a binary string
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function hmacSHA256Base64(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToBase64(new Uint8Array(sig));
}

export async function verifyCloudPaymentsHmac({ apiSecret, rawMessage, headerX, headerEncoded }) {
  if (!apiSecret) return false;
  const expected = await hmacSHA256Base64(apiSecret, rawMessage);

  // Accept either header to avoid URL-encoding pitfalls described in docs.
  const candidates = [headerX, headerEncoded].filter(Boolean);
  if (!candidates.length) return false;

  const a = new TextEncoder().encode(expected);
  for (const h of candidates) {
    const b = new TextEncoder().encode(h);
    if (timingSafeEqual(a, b)) return true;
  }
  return false;
}

export function jsonCode(code) {
  return new Response(JSON.stringify({ code }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
