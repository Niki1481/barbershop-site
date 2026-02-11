-- Cloudflare D1 schema for BarberShop booking
PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS working_hours;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS barbers;

CREATE TABLE barbers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100
);

-- weekday: 0=Sunday ... 6=Saturday
CREATE TABLE working_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barber_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  start_time TEXT NOT NULL, -- "10:00"
  end_time TEXT NOT NULL,   -- "20:00"
  FOREIGN KEY(barber_id) REFERENCES barbers(id) ON DELETE CASCADE
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  barber_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  date TEXT NOT NULL, -- "YYYY-MM-DD"
  start_local TEXT NOT NULL, -- "YYYY-MM-DDTHH:mm"
  end_local TEXT NOT NULL,   -- "YYYY-MM-DDTHH:mm"
  status TEXT NOT NULL CHECK(status IN ('pending','confirmed','canceled')),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  cancel_token TEXT UNIQUE NOT NULL,
  cp_transaction_id INTEGER UNIQUE,
  cp_payment_status TEXT,
  created_at TEXT NOT NULL,  -- ISO
  expires_at TEXT NOT NULL,  -- ISO (for pending)
  FOREIGN KEY(barber_id) REFERENCES barbers(id),
  FOREIGN KEY(service_id) REFERENCES services(id)
);

CREATE INDEX idx_bookings_barber_date ON bookings(barber_id, date);
CREATE INDEX idx_bookings_status_expires ON bookings(status, expires_at);
