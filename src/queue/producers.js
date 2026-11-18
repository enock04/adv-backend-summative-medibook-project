const config = require('../config');
const { redis } = require('../config/redis');
const reliableQueue = require('./reliableQueue');

// Producers never throw: the booking or cancellation they follow has already
// committed, so a Redis outage must not turn it into an error response.
const safePush = async (queue, job) => {
  try {
    await reliableQueue.push(redis, queue, { ...job, attempts: 0 });
    return true;
  } catch (err) {
    console.error(`Could not enqueue job on ${queue}:`, err.message);
    return false;
  }
};

const enqueueNotification = ({ appointment, patient, doctor }) =>
  safePush(config.queues.notificationJobs, {
    type: 'APPOINTMENT_CONFIRMATION',
    appointment_id: appointment.id,
    to: patient.email,
    message: `Hi ${patient.full_name}, your appointment with ${doctor.full_name} (room ${doctor.room}) is confirmed for ${appointment.appt_datetime}.`,
  });

const enqueuePromotion = ({ doctor_id, appt_datetime }) =>
  safePush(config.queues.promotionJobs, { doctor_id, appt_datetime });

module.exports = { enqueueNotification, enqueuePromotion };
