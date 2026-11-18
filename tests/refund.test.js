const { calculateRefund, refundPercent } = require('../src/utils/refund');

const appt = new Date(2030, 5, 10, 10, 0, 0);
const hoursBefore = (hours, minutes = 0) =>
  new Date(appt.getTime() - hours * 3600 * 1000 - minutes * 60 * 1000);

describe('calculateRefund', () => {
  test('more than 48 hours notice refunds 100%', () => {
    expect(calculateRefund(150, appt, hoursBefore(72))).toBe(150);
  });

  test('exactly 48 hours notice refunds 50% (boundary belongs to the 50% tier)', () => {
    expect(calculateRefund(150, appt, hoursBefore(48))).toBe(75);
  });

  test('one minute over 48 hours refunds 100%', () => {
    expect(calculateRefund(150, appt, hoursBefore(48, 1))).toBe(150);
  });

  test('between 24 and 48 hours refunds 50%', () => {
    expect(calculateRefund(100, appt, hoursBefore(30))).toBe(50);
  });

  test('exactly 24 hours notice refunds 50% (boundary belongs to the 50% tier)', () => {
    expect(calculateRefund(100, appt, hoursBefore(24))).toBe(50);
  });

  test('one minute under 24 hours refunds nothing', () => {
    expect(calculateRefund(100, appt, hoursBefore(23, 59))).toBe(0);
  });

  test('cancelling after the appointment time refunds nothing', () => {
    expect(calculateRefund(100, appt, new Date(appt.getTime() + 60000))).toBe(0);
  });

  test('rounds to cents without floating point drift', () => {
    expect(calculateRefund(120.35, appt, hoursBefore(30))).toBe(60.18);
  });
});

describe('refundPercent', () => {
  test('returns the tier percentage', () => {
    expect(refundPercent(appt, hoursBefore(100))).toBe(100);
    expect(refundPercent(appt, hoursBefore(36))).toBe(50);
    expect(refundPercent(appt, hoursBefore(2))).toBe(0);
  });
});
