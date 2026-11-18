const { HttpError } = require('../utils/httpError');

const MYSQL_ERRORS = {
  ER_DUP_ENTRY: [409, 'A record with the same unique value already exists'],
  ER_ROW_IS_REFERENCED_2: [409, 'Record is referenced by other data and cannot be deleted'],
  ER_NO_REFERENCED_ROW_2: [422, 'A referenced record does not exist'],
  ER_CHECK_CONSTRAINT_VIOLATED: [422, 'Value violates a database rule'],
};

const notFoundHandler = (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  const mapped = MYSQL_ERRORS[err.code];
  if (mapped) {
    return res.status(mapped[0]).json({ error: mapped[1] });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
};

module.exports = { errorHandler, notFoundHandler };
