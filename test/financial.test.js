import test from "node:test";
import assert from "node:assert/strict";
import { calculateFinancialProjection } from "../lib/financial.js";

test("calculates financial projections with custom inputs, ROI, and scenarios", () => {
  const result = calculateFinancialProjection({
    fixedCosts: 10000,
    venueCost: 15000,
    artistFee: 5000,
    ticketPrice: 120,
    ticketFeesPercent: 10,
    variableCostPerAttendee: 20,
    ancillaryRevenuePerAttendee: 10,
    attendance: { p10: 200, p50: 300, p90: 400 }
  });

  assert.equal(result.totalFixedCosts, 30000);
  assert.equal(result.netTicketRevenue, 108); // 120 * 0.9
  assert.equal(result.contributionPerAttendee, 98); // 108 + 10 - 20
  assert.equal(result.breakEvenAttendance, 307); // Math.ceil(30000 / 98) = 307

  // P50 scenario checks (300 attendance)
  const p50 = result.scenarios.p50;
  assert.equal(p50.attendance, 300);
  assert.equal(p50.ticketRevenue, 32400); // 300 * 108
  assert.equal(p50.ancillaryRevenue, 3000); // 300 * 10
  assert.equal(p50.totalRevenue, 35400);
  assert.equal(p50.variableCosts, 6000); // 300 * 20
  assert.equal(p50.totalCosts, 36000); // 30000 (fixed) + 6000
  assert.equal(p50.profit, -600); // 35400 - 36000 = -600
  assert.equal(p50.roi, -1.67); // Math.round((-600 / 36000) * 100 * 100) / 100 = -1.67
});

test("returns null break-even when contribution per attendee is zero or negative", () => {
  const result = calculateFinancialProjection({
    fixedCosts: 5000,
    venueCost: 5000,
    artistFee: 2000,
    ticketPrice: 10,
    ticketFeesPercent: 100,
    variableCostPerAttendee: 20,
    ancillaryRevenuePerAttendee: 0,
    attendance: { p10: 100, p50: 200, p90: 300 }
  });

  assert.equal(result.breakEvenAttendance, null);
  assert.ok(result.scenarios.p90.profit < 0);
});

test("sanitizes negative and invalid values", () => {
  const result = calculateFinancialProjection({
    fixedCosts: -1000,
    venueCost: -500,
    artistFee: "invalid",
    ticketPrice: -50,
    ticketFeesPercent: 120, // max 100
    variableCostPerAttendee: -10,
    ancillaryRevenuePerAttendee: -5,
    attendance: {}
  });

  assert.equal(result.inputs.fixedCosts, 0);
  assert.equal(result.inputs.venueCost, 0);
  assert.equal(result.inputs.artistFee, 0);
  assert.equal(result.inputs.ticketPrice, 0);
  assert.equal(result.inputs.ticketFeesPercent, 100);
  assert.equal(result.inputs.variableCostPerAttendee, 0);
  assert.equal(result.inputs.ancillaryRevenuePerAttendee, 0);
});
