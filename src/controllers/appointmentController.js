const appointmentModel = require('../models/appointmentModel');
const appointmentService = require('../services/appointmentService');
const asyncHandler = require('../utils/asyncHandler');
const { notFound } = require('../utils/httpError');
const { parseId, validateBookingInput } = require('../utils/validators');

const bookAppointment = asyncHandler(async (req, res) => {
  const input = validateBookingInput(req.body);
  const appointment = await appointmentService.bookAppointment(input);
  res.status(201).location(`/api/appointments/${appointment.id}`).json(appointment);
});

const getAppointment = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const appointment = await appointmentModel.findById(id);
  if (!appointment) throw notFound(`Appointment ${id} not found`);
  res.json(appointment);
});

// DELETE cancels: the row is kept (status 'cancelled') for refund history,
// so the response carries the refund instead of being empty.
const cancelAppointment = asyncHandler(async (req, res) => {
  const result = await appointmentService.cancelAppointment(parseId(req.params.id));
  res.json(result);
});

module.exports = { bookAppointment, getAppointment, cancelAppointment };
