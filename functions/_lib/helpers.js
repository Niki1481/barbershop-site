export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function badRequest(message, status = 400) {
  return json({ error: message }, { status });
}

export function requireEnv(env, key) {
  const v = env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

export function randomToken(len = 24) {
  // hex token
  const bytes = new Uint8Array(Math.ceil(len / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2,"0")).join("").slice(0, len);
}

export function addMinutesToLocal(localDT, minutes) {
  // localDT: YYYY-MM-DDTHH:mm (treat as local time string, no timezone math)
  const [d, t] = localDT.split("T");
  const [hh, mm] = t.split(":").map(Number);
  let total = hh * 60 + mm + minutes;
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${d}T${String(newH).padStart(2,"0")}:${String(newM).padStart(2,"0")}`;
}

export function localToDate(localDT, tzOffset = "+03:00") {
  // localDT: YYYY-MM-DDTHH:mm (local time). We convert it to a real Date using a fixed offset.
  // Example: localToDate("2026-02-11T14:30", "+03:00") -> Date(2026-02-11T14:30:00+03:00)
  return new Date(`${localDT}:00${tzOffset}`);
}

export function weekdayFromDate(dateStr) {
  // dateStr: YYYY-MM-DD. We compute weekday by taking midday UTC to avoid DST edge cases.
  const d = new Date(dateStr + "T12:00:00Z");
  // JS: 0=Sunday..6=Saturday; we store 0..6 same
  return d.getUTCDay();
}

export function parseTimeToMinutes(hhmm) {
  const [h,m] = hhmm.split(":").map(Number);
  return h*60+m;
}

export function minutesToTime(mins) {
  const h = Math.floor(mins/60);
  const m = mins%60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
