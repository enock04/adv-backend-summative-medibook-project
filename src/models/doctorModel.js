const pool = require('../config/db');

const COLUMNS = 'id, full_name, specialty, consultation_fee, room, created_at';

const create = async ({ full_name, specialty, consultation_fee, room }) => {
  const [result] = await pool.execute(
    'INSERT INTO doctors (full_name, specialty, consultation_fee, room) VALUES (?, ?, ?, ?)',
    [full_name, specialty, consultation_fee, room]
  );
  return result.insertId;
};

const findAll = async () => {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM doctors ORDER BY id`);
  return rows;
};

const findById = async (id) => {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM doctors WHERE id = ?`, [id]);
  return rows[0] || null;
};

// Locks the doctor row for the rest of the transaction. Every booking for this
// doctor queues behind it, which serialises the cap check and the insert.
const findByIdForUpdate = async (id, connection) => {
  const [rows] = await connection.execute(
    `SELECT ${COLUMNS} FROM doctors WHERE id = ? FOR UPDATE`,
    [id]
  );
  return rows[0] || null;
};

const update = async (id, { full_name, specialty, consultation_fee, room }) => {
  await pool.execute(
    'UPDATE doctors SET full_name = ?, specialty = ?, consultation_fee = ?, room = ? WHERE id = ?',
    [full_name, specialty, consultation_fee, room, id]
  );
};

const remove = async (id) => {
  await pool.execute('DELETE FROM doctors WHERE id = ?', [id]);
};

module.exports = { create, findAll, findById, findByIdForUpdate, update, remove };
