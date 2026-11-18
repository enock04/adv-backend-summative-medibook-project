const waitlistService = require('../services/waitlistService');
const asyncHandler = require('../utils/asyncHandler');
const { parseId, validateBookingInput, validateDay } = require('../utils/validators');

const joinWaitlist = asyncHandler(async (req, res) => {
  const input = validateBookingInput(req.body);
  res.status(201).json(await waitlistService.joinWaitlist(input));
});

const listWaitlist = asyncHandler(async (req, res) => {
  const doctorId = parseId(req.query.doctor_id);
  const day = validateDay(req.query.date);
  res.json(await waitlistService.listWaitlist(doctorId, day));
});

module.exports = { joinWaitlist, listWaitlist };
