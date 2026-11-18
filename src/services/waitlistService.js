const config = require('../config');
const pool = require('../config/db');
const { redis } = require('../config/redis');
const appointmentModel = require('../models/appointmentModel');
const doctorModel = require('../models/doctorModel');
const patientModel = require('../models/patientModel');
const appointmentService = require('./appointmentService');
const reliableQueue = require('../queue/reliableQueue');
const waitlistQueue = require('../queue/waitlistQueue');
const { logEvent } = require('../utils/auditLogger');
const { formatDateTime } = require('../utils/slot');
const { HttpError, notFound, conflict, unprocessable } = require('../utils/httpError');

const { waitlistProcessing, waitlistFailed } = config.queues;

/**
 * A patient may only join when they could not book: either the requested slot
 * is taken (scope 'slot') or the doctor's whole day is full (scope 'day').
 */
const joinWaitlist = async ({ patient_id, doctor_id, appt_datetime }, now = new Date()) => {
  const slot = formatDateTime(appointmentService.assertSlotIsValid(appt_datetime, now));

  if (!(await doctorModel.findById(doctor_id))) throw notFound(`Doctor ${doctor_id} not found`);
  if (!(await patientModel.findById(patient_id))) throw notFound(`Patient ${patient_id} not found`);

  const bookedToday = await appointmentModel.countBookedForDay(
    pool,
    doctor_id,
    appointmentService.dayStartOf(slot)
  );
  const dayFull = bookedToday >= config.rules.maxAppointmentsPerDay;
  const slotTaken = await appointmentModel.isSlotBooked(pool, doctor_id, slot);
  if (!dayFull && !slotTaken) {
    throw unprocessable('That slot is available, so book it directly instead of joining the waitlist');
  }

  const scope = dayFull ? 'day' : 'slot';
  const position = await waitlistQueue.join(redis, {
    patient_id,
    doctor_id,
    appt_datetime: slot,
    scope,
  });
  if (position === null) throw conflict('Patient is already on the waitlist for that doctor and day');

  await logEvent('WAITLIST_JOINED', { patient_id, doctor_id, requested_datetime: slot, scope, position });
  return { patient_id, doctor_id, requested_datetime: slot, scope, position };
};

const listWaitlist = (doctorId, day) => waitlistQueue.list(redis, doctorId, day);

// Business or constraint failures that say "this slot cannot be booked right
// now", as opposed to something wrong with the patient or the infrastructure.
const isSlotLevelFailure = (err) => err instanceof HttpError || err.code === 'ER_DUP_ENTRY';

const parkFailedEntry = async (raw, entry, reason) => {
  await reliableQueue.moveToFailed(redis, waitlistFailed, waitlistProcessing, raw, reason);
  await logEvent('WAITLIST_FAILED', { patient_id: entry.patient_id, doctor_id: entry.doctor_id, reason });
};

/**
 * Called by the worker after a cancellation frees `appt_datetime`.
 * Takes the first eligible waitlisted patient and books them into the slot.
 *
 * The patient is moved to a processing list, not deleted. They leave it only
 * once the booking has succeeded. On any failure they are put back in their
 * place in line, or parked in the failed list if they cannot ever be booked,
 * so a patient is never in neither the queue nor the appointments table.
 */
const promoteNext = async ({ doctor_id, appt_datetime }) => {
  const key = waitlistQueue.queueKey(doctor_id, waitlistQueue.dayOf(appt_datetime));

  for (;;) {
    const raw = await reliableQueue.reserveMatching(redis, key, waitlistProcessing, (entry) =>
      waitlistQueue.canTakeSlot(entry, appt_datetime)
    );
    if (!raw) return { status: 'NO_ELIGIBLE_PATIENT' };
    const entry = JSON.parse(raw);

    try {
      if (!(await patientModel.findById(entry.patient_id))) {
        await parkFailedEntry(raw, entry, 'Patient no longer exists');
        continue;
      }

      const appointment = await appointmentService.bookAppointment({
        patient_id: entry.patient_id,
        doctor_id,
        appt_datetime,
      });
      await reliableQueue.ack(redis, waitlistProcessing, raw);
      await logEvent('WAITLIST_PROMOTED', {
        patient_id: entry.patient_id,
        doctor_id,
        appointment_id: appointment.id,
        appt_datetime: appointment.appt_datetime,
      });
      return { status: 'PROMOTED', appointment };
    } catch (err) {
      if (isSlotLevelFailure(err)) {
        await reliableQueue.requeueFront(redis, key, waitlistProcessing, raw);
        return { status: 'SLOT_UNAVAILABLE', reason: err.message };
      }

      const attempts = entry.attempts + 1;
      if (attempts >= config.worker.maxAttempts) {
        await parkFailedEntry(raw, entry, `Gave up after ${attempts} attempts: ${err.message}`);
        continue;
      }
      await reliableQueue.requeueFront(
        redis,
        key,
        waitlistProcessing,
        raw,
        JSON.stringify({ ...entry, attempts })
      );
      throw err;
    }
  }
};

// Run once when the worker starts: anything left in processing means a previous
// worker died mid-promotion, so return those patients to their queues.
const recoverStuckEntries = async () => {
  const stuck = await redis.lrange(waitlistProcessing, 0, -1);
  for (const raw of stuck.reverse()) {
    const key = waitlistQueue.keyForEntry(JSON.parse(raw));
    await reliableQueue.requeueFront(redis, key, waitlistProcessing, raw);
  }
  return stuck.length;
};

module.exports = { joinWaitlist, listWaitlist, promoteNext, recoverStuckEntries };
