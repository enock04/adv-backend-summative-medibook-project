const config = require('../config');
const doctorModel = require('../models/doctorModel');
const reportModel = require('../models/reportModel');
const asyncHandler = require('../utils/asyncHandler');
const { notFound } = require('../utils/httpError');
const { formatDateTime } = require('../utils/slot');
const { parseId } = require('../utils/validators');

const { maxAppointmentsPerDay, statsWindowDays, busyDayThreshold } = config.rules;

const doctorStatistics = asyncHandler(async (req, res) => {
  const doctorId = parseId(req.params.id);
  const doctor = await doctorModel.findById(doctorId);
  if (!doctor) throw notFound(`Doctor ${doctorId} not found`);

  const now = formatDateTime(new Date());
  const [totals, nextDays, utilization] = await Promise.all([
    reportModel.doctorRevenueAndUpcoming(doctorId, now),
    reportModel.doctorDailyLoad(doctorId, now, statsWindowDays, maxAppointmentsPerDay),
    reportModel.doctorWindowUtilization(doctorId, now, statsWindowDays, maxAppointmentsPerDay),
  ]);

  res.json({
    doctor: { id: doctor.id, full_name: doctor.full_name, specialty: doctor.specialty },
    revenue_collected: totals.revenue_collected,
    upcoming_appointments: totals.upcoming_appointments,
    daily_capacity: maxAppointmentsPerDay,
    next_days: nextDays,
    utilization_percent: utilization,
  });
});

const doctorsReport = asyncHandler(async (req, res) => {
  res.json(await reportModel.doctorsReport());
});

const busyDaysReport = asyncHandler(async (req, res) => {
  res.json(await reportModel.busyDays(maxAppointmentsPerDay, busyDayThreshold));
});

module.exports = { doctorStatistics, doctorsReport, busyDaysReport };
