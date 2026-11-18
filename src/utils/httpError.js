class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const badRequest = (message) => new HttpError(400, message);
const notFound = (message) => new HttpError(404, message);
const conflict = (message, extra) => new HttpError(409, message, extra);
const unprocessable = (message) => new HttpError(422, message);

module.exports = { HttpError, badRequest, notFound, conflict, unprocessable };
