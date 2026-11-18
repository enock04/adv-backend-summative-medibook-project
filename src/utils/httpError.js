class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const badRequest = (message) => new HttpError(400, message);
const notFound = (message) => new HttpError(404, message);
const conflict = (message) => new HttpError(409, message);
const unprocessable = (message) => new HttpError(422, message);

module.exports = { HttpError, badRequest, notFound, conflict, unprocessable };
