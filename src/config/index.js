require('dotenv').config();

const toMinutes = (hhmm) => {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
};

const rules = {
  maxAppointmentsPerDay: Number(process.env.MAX_APPOINTMENTS_PER_DAY || 12),
  slotMinutes: Number(process.env.SLOT_MINUTES || 30),
  dayStartMinutes: toMinutes(process.env.WORKDAY_START || '09:00'),
  dayEndMinutes: toMinutes(process.env.WORKDAY_END || '17:00'),
  busyDayThreshold: Number(process.env.BUSY_DAY_THRESHOLD || 0.8),
  refund: {
    fullRefundAboveHours: 48,
    partialRefundFromHours: 24,
    fullPercent: 100,
    partialPercent: 50,
    nonePercent: 0,
  },
};

module.exports = {
  port: Number(process.env.PORT || 3000),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'medibook',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
  },
  auditLogDir: process.env.AUDIT_LOG_DIR || 'logs',
  rules,
};
