import test from "node:test";
import assert from "node:assert/strict";
import { calculateBreakEven } from "../lib/economics.js";

test("calculates contribution, break-even and scenario profit", () => {
  const result = calculateBreakEven({
    fixedCosts: 100000,
    ticketPrice: 150,
    ticketFeesPercent: 10,
    variableCostPerAttendee: 20,
    ancillaryRevenuePerAttendee: 5,
    attendance: { p10: 700, p50: 1000, p90: 1300 }
  });

  assert.equal(result.netTicketRevenue, 135);
  assert.equal(result.contributionPerAttendee, 120);
  assert.equal(result.breakEvenAttendance, 834);
  assert.equal(result.scenarios.p10.profit, -16000);
  assert.equal(result.scenarios.p50.profit, 20000);
  assert.equal(result.scenarios.p90.profit, 56000);
});

test("returns no break-even when contribution is not positive", () => {
  const result = calculateBreakEven({
    fixedCosts: 50000,
    ticketPrice: 20,
    ticketFeesPercent: 100,
    variableCostPerAttendee: 30,
    ancillaryRevenuePerAttendee: 0,
    attendance: { p10: 100, p50: 200, p90: 300 }
  });

  assert.equal(result.breakEvenAttendance, null);
  assert.ok(result.scenarios.p90.profit < 0);
});

test("sanitizes negative and non-numeric values", () => {
  const result = calculateBreakEven({
    fixedCosts: -1,
    ticketPrice: "not-a-number",
    ticketFeesPercent: 300,
    variableCostPerAttendee: -20,
    ancillaryRevenuePerAttendee: -5,
    attendance: {}
  });

  assert.equal(result.inputs.fixedCosts, 0);
  assert.equal(result.inputs.ticketFeesPercent, 100);
  assert.equal(result.scenarios.p50.attendance, 0);
});
