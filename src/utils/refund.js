const { rules } = require('../config');

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Refund policy (boundaries are inclusive on the 50% tier):
 *   notice  > 48h          -> 100%
 *   24h <= notice <= 48h   -> 50%   (exactly 24h and exactly 48h are 50%)
 *   notice  < 24h          -> 0%    (including appointments already started)
 */
const refundPercent = (apptDate, cancelledAt, policy = rules.refund) => {
  const noticeHours = (apptDate.getTime() - cancelledAt.getTime()) / MS_PER_HOUR;
  if (noticeHours > policy.fullRefundAboveHours) return policy.fullPercent;
  if (noticeHours >= policy.partialRefundFromHours) return policy.partialPercent;
  return policy.nonePercent;
};

const calculateRefund = (amountPaid, apptDate, cancelledAt, policy = rules.refund) => {
  const percent = refundPercent(apptDate, cancelledAt, policy);
  const cents = Math.round(amountPaid * 100);
  return Math.round((cents * percent) / 100) / 100;
};

module.exports = { calculateRefund, refundPercent };
