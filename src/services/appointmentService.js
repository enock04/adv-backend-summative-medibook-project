const config = require('../config');
const appointmentModel = require('../models/appointmentModel');
const doctorModel = require('../models/doctorModel');
const patientModel = require('../models/patientModel');
const { withTransaction } = require('../utils/transaction');
const { logEvent } = require('../utils/auditLogger');
const { calculateRefund, refundPercent } = require('../utils/refund');
const { validateSlot, parseDateTime, formatDateTime } = require('../utils/slot');
const { badRequest, notFound, conflict, unprocessable } = require('../utils/httpError');

const assertSlotIsValid = (apptDatetime, now) => {
  const result = validateSlot(apptDatetime, now);
  if (result.valid) return result.date;
  throw result.code === 'MALFORMED' ? badRequest(result.message) : unprocessable(result.message);
};

const waitlistOffer = (reason, doctorId, apptDatetime) =>
  conflict(reason, { waitlist_available: true, doctor_id: doctorId, appt_datetime: apptDatetime });

/**
 * Books a slot. The doctor row is locked first, so concurrent bookings for the
 * same doctor run one at a time and the daily-cap count cannot go stale.
 * The unique (doctor_id, active_slot) key is the last line of defence.
 */
const bookAppointment = async ({ patient_id, doctor_id, appt_datetime }, now = new Date()) => {
  const date = assertSlotIsValid(appt_datetime, now);
  const slot = formatDateTime(date);
  const dayStart = `${slot.slice(0, 10)} 00:00:00`;

  const appointment = await withTransaction(async (connection) => {
    const doctor = await doctorModel.findByIdForUpdate(doctor_id, connection);
    if (!doctor) throw notFound(`Doctor ${doctor_id} not found`);

    const patient = await patientModel.findById(patient_id, connection);
    if (!patient) throw notFound(`Patient ${patient_id} not found`);

    if (await appointmentModel.isSlotBooked(connection, doctor_id, slot)) {
      throw waitlistOffer('That slot is already booked', doctor_id, slot);
    }

    const bookedToday = await appointmentModel.countBookedForDay(connection, doctor_id, dayStart);
    if (bookedToday >= config.rules.maxAppointmentsPerDay) {
      throw waitlistOffer('The doctor is fully booked on that day', doctor_id, slot);
    }

    const id = await appointmentModel.insert(connection, {
      patient_id,
      doctor_id,
      appt_datetime: slot,
      amount_paid: doctor.consultation_fee,
    });
    return appointmentModel.findById(id, connection);
  });

  await logEvent('APPOINTMENT_BOOKED', {
    appointment_id: appointment.id,
    patient_id,
    doctor_id,
    appt_datetime: appointment.appt_datetime,
    amount_paid: appointment.amount_paid,
  });
  return appointment;
};

/**
 * Cancels an appointment. The refund is computed here from the notice given,
 * never taken from the client. The status change and refund fields are written
 * in one UPDATE inside a transaction, so they succeed or fail together.
 */
const cancelAppointment = async (appointmentId, now = new Date()) => {
  const result = await withTransaction(async (connection) => {
    const existing = await appointmentModel.findByIdForUpdate(appointmentId, connection);
    if (!existing) throw notFound(`Appointment ${appointmentId} not found`);
    if (existing.status === 'cancelled') throw conflict('Appointment is already cancelled');

    const apptDate = parseDateTime(existing.appt_datetime);
    if (apptDate.getTime() <= now.getTime()) {
      throw unprocessable('Appointments that have already started cannot be cancelled');
    }

    const refund_amount = calculateRefund(existing.amount_paid, apptDate, now);
    const refund_percent = refundPercent(apptDate, now);
    await appointmentModel.markCancelled(connection, appointmentId, refund_amount, formatDateTime(now));

    return {
      appointment: await appointmentModel.findById(appointmentId, connection),
      refund_amount,
      refund_percent,
    };
  });

  await logEvent('APPOINTMENT_CANCELLED', {
    appointment_id: appointmentId,
    patient_id: result.appointment.patient_id,
    doctor_id: result.appointment.doctor_id,
    appt_datetime: result.appointment.appt_datetime,
    refund_amount: result.refund_amount,
    refund_percent: result.refund_percent,
  });
  return result;
};

module.exports = { bookAppointment, cancelAppointment };
