const config = require('../config');

// One Redis list per doctor per day, oldest request first.
const dayOf = (datetime) => datetime.slice(0, 10);

const queueKey = (doctorId, day) => `${config.queues.waitlistKeyPrefix}:${doctorId}:${day}`;

const keyForEntry = (entry) => queueKey(entry.doctor_id, dayOf(entry.requested_datetime));

const list = async (redis, doctorId, day) => {
  const items = await redis.lrange(queueKey(doctorId, day), 0, -1);
  return items.map((item, index) => ({ position: index + 1, ...JSON.parse(item) }));
};

// scope 'day': the doctor's whole day was full, any freed slot is acceptable.
// scope 'slot': only the requested slot was taken, wait for that exact slot.
// Returns the 1-based position, or null if the patient is already queued that day.
const join = async (redis, { patient_id, doctor_id, appt_datetime, scope }) => {
  const key = queueKey(doctor_id, dayOf(appt_datetime));
  const existing = await list(redis, doctor_id, dayOf(appt_datetime));
  if (existing.some((entry) => entry.patient_id === patient_id)) return null;

  const entry = {
    patient_id,
    doctor_id,
    requested_datetime: appt_datetime,
    scope,
    queued_at: new Date().toISOString(),
    attempts: 0,
  };
  return redis.rpush(key, JSON.stringify(entry));
};

const canTakeSlot = (entry, slot) => entry.scope === 'day' || entry.requested_datetime === slot;

module.exports = { dayOf, queueKey, keyForEntry, list, join, canTakeSlot };
