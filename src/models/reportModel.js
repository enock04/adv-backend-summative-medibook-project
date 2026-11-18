const pool = require('../config/db');

// Every figure below is computed by MySQL (joins, GROUP BY, HAVING, CTE);
// JavaScript only passes parameters and returns rows.
//
// Revenue collected = what patients paid minus what was refunded. A cancelled
// appointment with a 50% refund therefore still contributes the other 50%.
// Only 'booked' rows count as appointments; cancelled rows are kept for history.

// Revenue, plus upcoming bookings after `now` ('YYYY-MM-DD HH:mm:ss').
const doctorRevenueAndUpcoming = async (doctorId, now) => {
  const [rows] = await pool.execute(
    `SELECT COALESCE(SUM(amount_paid - COALESCE(refund_amount, 0)), 0) AS revenue_collected,
            COUNT(CASE WHEN status = 'booked' AND appt_datetime > ? THEN 1 END) AS upcoming_appointments
     FROM appointments
     WHERE doctor_id = ?`,
    [now, doctorId]
  );
  return rows[0];
};

// One row per day for the next `windowDays` days starting today, including
// days with no appointments (the recursive CTE generates the calendar).
const doctorDailyLoad = async (doctorId, now, windowDays, dailyCap) => {
  const [rows] = await pool.execute(
    `WITH RECURSIVE days AS (
       SELECT DATE(?) AS day, 1 AS n
       UNION ALL
       SELECT day + INTERVAL 1 DAY, n + 1 FROM days WHERE n < ?
     )
     SELECT days.day AS date,
            COUNT(a.id) AS appointments,
            ROUND(100 * COUNT(a.id) / ?, 1) AS utilization_percent
     FROM days
     LEFT JOIN appointments a
       ON a.doctor_id = ?
      AND a.status = 'booked'
      AND a.appt_datetime >= days.day
      AND a.appt_datetime < days.day + INTERVAL 1 DAY
     GROUP BY days.day
     ORDER BY days.day`,
    [now, windowDays, dailyCap, doctorId]
  );
  return rows;
};

// Booked slots in the window as a percentage of (daily cap x number of days).
const doctorWindowUtilization = async (doctorId, now, windowDays, dailyCap) => {
  const [rows] = await pool.execute(
    `SELECT ROUND(100 * COUNT(*) / (? * ?), 1) AS utilization_percent
     FROM appointments
     WHERE doctor_id = ?
       AND status = 'booked'
       AND appt_datetime >= DATE(?)
       AND appt_datetime < DATE_ADD(DATE(?), INTERVAL ? DAY)`,
    [dailyCap, windowDays, doctorId, now, now, windowDays]
  );
  return rows[0].utilization_percent;
};

// LEFT JOIN keeps doctors who have no appointments at all (zero rows, zero revenue).
const doctorsReport = async () => {
  const [rows] = await pool.execute(
    `SELECT d.id AS doctor_id,
            d.full_name,
            d.specialty,
            COUNT(CASE WHEN a.status = 'booked' THEN 1 END) AS total_appointments,
            COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) AS cancelled_appointments,
            COALESCE(SUM(a.amount_paid - COALESCE(a.refund_amount, 0)), 0) AS revenue_collected
     FROM doctors d
     LEFT JOIN appointments a ON a.doctor_id = d.id
     GROUP BY d.id, d.full_name, d.specialty
     ORDER BY d.id`
  );
  return rows;
};

// Doctor-days where live bookings exceed threshold x daily cap (e.g. > 80% of 12).
const busyDays = async (dailyCap, threshold) => {
  const [rows] = await pool.execute(
    `SELECT d.id AS doctor_id,
            d.full_name,
            DATE(a.appt_datetime) AS date,
            COUNT(*) AS booked_slots,
            ROUND(100 * COUNT(*) / ?, 1) AS utilization_percent
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     WHERE a.status = 'booked'
     GROUP BY d.id, d.full_name, DATE(a.appt_datetime)
     HAVING COUNT(*) > ? * ?
     ORDER BY date, d.id`,
    [dailyCap, dailyCap, threshold]
  );
  return rows;
};

module.exports = {
  doctorRevenueAndUpcoming,
  doctorDailyLoad,
  doctorWindowUtilization,
  doctorsReport,
  busyDays,
};
