-- Example seed data. Replace with your real services and barbers.

INSERT INTO barbers (id, name, bio, active, sort_order) VALUES
('b1', 'Алексей', 'Классика и фейд', 1, 10),
('b2', 'Михаил', 'Борода и укладки', 1, 20);

INSERT INTO services (id, name, duration_min, price_cents, active, sort_order) VALUES
('s1', 'Стрижка', 45, 250000, 1, 10),
('s2', 'Стрижка + борода', 60, 350000, 1, 20),
('s3', 'Коррекция бороды', 30, 200000, 1, 30);

-- Working hours per barber (0=Sunday..6=Saturday)
-- Here: Mon-Sat 10:00-20:00, Sunday off.
INSERT INTO working_hours (barber_id, weekday, start_time, end_time) VALUES
('b1', 1, '10:00', '20:00'),
('b1', 2, '10:00', '20:00'),
('b1', 3, '10:00', '20:00'),
('b1', 4, '10:00', '20:00'),
('b1', 5, '10:00', '20:00'),
('b1', 6, '10:00', '20:00'),

('b2', 1, '10:00', '20:00'),
('b2', 2, '10:00', '20:00'),
('b2', 3, '10:00', '20:00'),
('b2', 4, '10:00', '20:00'),
('b2', 5, '10:00', '20:00'),
('b2', 6, '10:00', '20:00');
