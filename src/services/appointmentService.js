const config = require('../config');
const appointmentModel = require('../models/appointmentModel');
const doctorModel = require('../models/doctorModel');
const patientModel = require('../models/patientModel');
const { withTransaction } = require('../utils/transaction');
const { logEvent } = require('../utils/auditLogger');
const { calculateRefund, refundPercent } = require('../utils/refund');
const { validateSlot, parseDateTime, formatDateTime } = require('../utils/slot');
const { badRequest, notFound, conflict, unprocessable } = require('../utils/httpError');
const { enqueueNotification, enqueuePromotion } = require('../queue/producers');

const assertSlotIsValid = (apptDatetime, now) => {
  const result = validateSlot(apptDatetime, now);
  if (result.valid) return result.date;
  throw result.code === 'MALFORMED' ? badRequest(result.message) : unprocessable(result.message);
};

const dayStartOf = (slot) => `${slot.slice(0, 10)} 00:00:00`;

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

  const { appointment, patient, doctor } = await withTransaction(async (connection) => {
    const lockedDoctor = await doctorModel.findByIdForUpdate(doctor_id, connection);
    if (!lockedDoctor) throw notFound(`Doctor ${doctor_id} not found`);

    const foundPatient = await patientModel.findById(patient_id, connection);
    if (!foundPatient) throw notFound(`Patient ${patient_id} not found`);

    if (await appointmentModel.isSlotBooked(connection, doctor_id, slot)) {
      throw waitlistOffer('That slot is already booked', doctor_id, slot);
    }

    const bookedToday = await appointmentModel.countBookedForDay(connection, doctor_id, dayStartOf(slot));
    if (bookedToday >= config.rules.maxAppointmentsPerDay) {
      throw waitlistOffer('The doctor is fully booked on that day', doctor_id, slot);
    }

    const id = await appointmentModel.insert(connection, {
      patient_id,
      doctor_id,
      appt_datetime: slot,
      amount_paid: lockedDoctor.consultation_fee,
      booked_on: formatDateTime(now),
    });
    return {
      appointment: await appointmentModel.findById(id, connection),
      patient: foundPatient,
      doctor: lockedDoctor,
    };
  });

  await logEvent('APPOINTMENT_BOOKED', {
    appointment_id: appointment.id,
    patient_id,
    doctor_id,
    appt_datetime: appointment.appt_datetime,
    amount_paid: appointment.amount_paid,
  });
  await enqueueNotification({ appointment, patient, doctor });
  return appointment;
};

/**
 * Cancels an appointment. The refund is computed here from the notice given,
 * never taken from the client. The status change and refund fields are written
 * in one UPDATE inside a transaction, so they succeed or fail together.
 * Afterwards a promotion job tells the worker the slot is free for the waitlist.
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

  const { appointment } = result;
  await logEvent('APPOINTMENT_CANCELLED', {
    appointment_id: appointmentId,
    patient_id: appointment.patient_id,
    doctor_id: appointment.doctor_id,
    appt_datetime: appointment.appt_datetime,
    refund_amount: result.refund_amount,
    refund_percent: result.refund_percent,
  });
  await enqueuePromotion({ doctor_id: appointment.doctor_id, appt_datetime: appointment.appt_datetime });
  return result;
};

module.exports = { bookAppointment, cancelAppointment, assertSlotIsValid, dayStartOf };
