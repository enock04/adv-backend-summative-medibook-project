const { badRequest } = require('./httpError');
const { parseDateTime } = require('./slot');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-()\s]{7,20}$/;
const MAX_FEE = 99999999.99;

const parseId = (value) => {
  if (!/^[1-9]\d*$/.test(String(value))) {
    throw badRequest('id must be a positive integer');
  }
  return Number(value);
};

const requireString = (body, field, { min = 1, max }) => {
  const value = body[field];
  if (typeof value !== 'string') {
    throw badRequest(`${field} is required and must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw badRequest(`${field} must be between ${min} and ${max} characters`);
  }
  return trimmed;
};

const validatePatientInput = (body = {}) => {
  const full_name = requireString(body, 'full_name', { min: 2, max: 100 });
  const email = requireString(body, 'email', { max: 150 }).toLowerCase();
  const phone = requireString(body, 'phone', { max: 20 });

  if (!EMAIL_PATTERN.test(email)) throw badRequest('email is not a valid email address');
  if (!PHONE_PATTERN.test(phone)) throw badRequest('phone must be 7-20 characters of digits, spaces, +, - or ()');

  return { full_name, email, phone };
};

const validateDoctorInput = (body = {}) => {
  const full_name = requireString(body, 'full_name', { min: 2, max: 100 });
  const specialty = requireString(body, 'specialty', { max: 80 });
  const room = requireString(body, 'room', { max: 10 });

  const fee = body.consultation_fee;
  if (typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0 || fee > MAX_FEE) {
    throw badRequest('consultation_fee must be a number between 0 and 99999999.99');
  }
  if (Math.round(fee * 100) / 100 !== fee) {
    throw badRequest('consultation_fee can have at most 2 decimal places');
  }

  return { full_name, specialty, consultation_fee: fee, room };
};

const requireId = (body, field) => {
  const value = body[field];
  if (!Number.isInteger(value) || value < 1) {
    throw badRequest(`${field} is required and must be a positive integer`);
  }
  return value;
};

const validateBookingInput = (body = {}) => {
  const patient_id = requireId(body, 'patient_id');
  const doctor_id = requireId(body, 'doctor_id');
  if (typeof body.appt_datetime !== 'string') {
    throw badRequest('appt_datetime is required and must be a string like "2030-06-10 09:30"');
  }
  return { patient_id, doctor_id, appt_datetime: body.appt_datetime };
};

const validateDay = (value) => {
  if (typeof value !== 'string' || !parseDateTime(`${value} 00:00`)) {
    throw badRequest('date is required in the form YYYY-MM-DD');
  }
  return value;
};

module.exports = {
  parseId,
  validatePatientInput,
  validateDoctorInput,
  validateBookingInput,
  validateDay,
};
