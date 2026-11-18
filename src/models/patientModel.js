const pool = require('../config/db');

const COLUMNS = 'id, full_name, email, phone, created_at';

const create = async ({ full_name, email, phone }) => {
  const [result] = await pool.execute(
    'INSERT INTO patients (full_name, email, phone) VALUES (?, ?, ?)',
    [full_name, email, phone]
  );
  return result.insertId;
};

const findAll = async () => {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM patients ORDER BY id`);
  return rows;
};

const findById = async (id, executor = pool) => {
  const [rows] = await executor.execute(`SELECT ${COLUMNS} FROM patients WHERE id = ?`, [id]);
  return rows[0] || null;
};

const update = async (id, { full_name, email, phone }) => {
  await pool.execute(
    'UPDATE patients SET full_name = ?, email = ?, phone = ? WHERE id = ?',
    [full_name, email, phone, id]
  );
};

const remove = async (id) => {
  await pool.execute('DELETE FROM patients WHERE id = ?', [id]);
};

module.exports = { create, findAll, findById, update, remove };
