const pool = require('../config/db');

// Runs `work(connection)` inside a transaction: commits if it resolves,
// rolls back and rethrows if it throws.
const withTransaction = async (work) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback().catch(() => {});
    throw err;
  } finally {
    connection.release();
  }
};

module.exports = { withTransaction };
