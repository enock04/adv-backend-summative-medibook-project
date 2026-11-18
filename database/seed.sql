USE medibook;

INSERT INTO patients (id, full_name, email, phone) VALUES
  (1, 'Ama Mensah',   'ama@mail.com',   '0244-111-222'),
  (2, 'Kojo Owusu',   'kojo@mail.com',  '0555-333-444'),
  (3, 'Esi Quaye',    'esi@mail.com',   '0200-555-666'),
  (4, 'Yaw Darko',    'yaw@mail.com',   '0277-888-999'),
  (5, 'Abena Sarpong','abena@mail.com', '0266-123-456');

-- Doctor 3 intentionally has no appointments.
INSERT INTO doctors (id, full_name, specialty, consultation_fee, room) VALUES
  (1, 'Dr. Boateng', 'Dermatology', 150.00, 'R-12'),
  (2, 'Dr. Adjei',   'Paediatrics', 100.00, 'R-03'),
  (3, 'Dr. Mensah',  'Cardiology',  200.00, 'R-07');

-- Dr. Boateng on 2026-12-07: 11 of 12 slots booked (near the daily cap).
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, status, amount_paid) VALUES
  (1, 1, '2026-12-07 09:00:00', 'booked', 150.00),
  (2, 1, '2026-12-07 09:30:00', 'booked', 120.00),
  (3, 1, '2026-12-07 10:00:00', 'booked', 150.00),
  (4, 1, '2026-12-07 10:30:00', 'booked', 150.00),
  (5, 1, '2026-12-07 11:00:00', 'booked', 150.00),
  (1, 1, '2026-12-07 11:30:00', 'booked', 150.00),
  (2, 1, '2026-12-07 12:00:00', 'booked', 150.00),
  (3, 1, '2026-12-07 12:30:00', 'booked', 150.00),
  (4, 1, '2026-12-07 13:00:00', 'booked', 150.00),
  (5, 1, '2026-12-07 13:30:00', 'booked', 150.00),
  (1, 1, '2026-12-07 14:00:00', 'booked', 150.00);

-- Dr. Adjei: a normal booking, plus a cancelled slot that was rebooked.
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, status, amount_paid, refund_amount, cancelled_at) VALUES
  (1, 2, '2026-12-15 10:00:00', 'booked',    100.00, NULL,  NULL),
  (2, 2, '2026-12-16 10:00:00', 'cancelled', 100.00, 50.00, '2026-12-15 09:00:00');
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, status, amount_paid) VALUES
  (3, 2, '2026-12-16 10:00:00', 'booked', 100.00);
