const { rules } = require('../config');

const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;
const MINUTES_PER_HOUR = 60;

const pad = (value) => String(value).padStart(2, '0');

const formatMinutes = (minutes) =>
  `${pad(Math.floor(minutes / MINUTES_PER_HOUR))}:${pad(minutes % MINUTES_PER_HOUR)}`;

// Formats a Date as 'YYYY-MM-DD HH:mm:ss' in clinic-local time, the format MySQL DATETIME uses.
const formatDateTime = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

// Parses 'YYYY-MM-DD HH:mm[:ss]' (or with 'T') as clinic-local time.
// Returns null for malformed input or impossible dates such as 2026-02-30.
const parseDateTime = (input) => {
  if (typeof input !== 'string') return null;
  const match = DATETIME_PATTERN.exec(input.trim());
  if (!match) return null;

  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0));
  const date = new Date(year, month - 1, day, hour, minute, second);
  const isRealDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute;
  return isRealDate ? date : null;
};

/**
 * Validates a requested appointment start time.
 * Returns { valid: true, date } or { valid: false, code, message }.
 * The last bookable slot starts at (day end - slot length), e.g. 16:30.
 */
const validateSlot = (input, now = new Date(), policy = rules) => {
  const date = parseDateTime(input);
  if (!date) {
    return { valid: false, code: 'MALFORMED', message: 'appt_datetime must be a valid date in the form YYYY-MM-DD HH:mm' };
  }

  if (date.getSeconds() !== 0 || date.getMinutes() % policy.slotMinutes !== 0) {
    return { valid: false, code: 'NOT_ON_BOUNDARY', message: `Appointments must start on a ${policy.slotMinutes}-minute boundary` };
  }

  const minutesIntoDay = date.getHours() * MINUTES_PER_HOUR + date.getMinutes();
  const firstStart = policy.dayStartMinutes;
  const lastStart = policy.dayEndMinutes - policy.slotMinutes;
  if (minutesIntoDay < firstStart || minutesIntoDay > lastStart) {
    return {
      valid: false,
      code: 'OUTSIDE_HOURS',
      message: `Appointments must start between ${formatMinutes(firstStart)} and ${formatMinutes(lastStart)}`,
    };
  }

  if (date.getTime() <= now.getTime()) {
    return { valid: false, code: 'NOT_FUTURE', message: 'Appointments can only be booked in the future' };
  }

  return { valid: true, date };
};

module.exports = { parseDateTime, validateSlot, formatDateTime };
