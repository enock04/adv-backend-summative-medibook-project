const pool = require('../config/db');

const COLUMNS =
  'id, patient_id, doctor_id, appt_datetime, status, amount_paid, refund_amount, cancelled_at, booked_on';

const insert = async (
  connection,
  { patient_id, doctor_id, appt_datetime, amount_paid, booked_on }
) => {
  const [result] = await connection.execute(
    `INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid, booked_on)
     VALUES (?, ?, ?, ?, ?)`,
    [patient_id, doctor_id, appt_datetime, amount_paid, booked_on]
  );
  return result.insertId;
};

const findById = async (id, executor = pool) => {
  const [rows] = await executor.execute(`SELECT ${COLUMNS} FROM appointments WHERE id = ?`, [id]);
  return rows[0] || null;
};

const findByIdForUpdate = async (id, connection) => {
  const [rows] = await connection.execute(
    `SELECT ${COLUMNS} FROM appointments WHERE id = ? FOR UPDATE`,
    [id]
  );
  return rows[0] || null;
};

// dayStart is 'YYYY-MM-DD 00:00:00'; counts live bookings in that calendar day.
const countBookedForDay = async (connection, doctorId, dayStart) => {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total FROM appointments
     WHERE doctor_id = ? AND status = 'booked'
       AND appt_datetime >= ? AND appt_datetime < DATE_ADD(?, INTERVAL 1 DAY)`,
    [doctorId, dayStart, dayStart]
  );
  return rows[0].total;
};

const isSlotBooked = async (connection, doctorId, apptDatetime) => {
  const [rows] = await connection.execute(
    `SELECT 1 FROM appointments
     WHERE doctor_id = ? AND appt_datetime = ? AND status = 'booked' LIMIT 1`,
    [doctorId, apptDatetime]
  );
  return rows.length > 0;
};

const markCancelled = async (connection, id, refundAmount, cancelledAt) => {
  await connection.execute(
    `UPDATE appointments
     SET status = 'cancelled', refund_amount = ?, cancelled_at = ?
     WHERE id = ?`,
    [refundAmount, cancelledAt, id]
  );
};

module.exports = {
  insert,
  findById,
  findByIdForUpdate,
  countBookedForDay,
  isSlotBooked,
  markCancelled,
};
