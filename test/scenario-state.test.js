import test from "node:test";
import assert from "node:assert/strict";
import {
  readEconomicsFromParams,
  writeEconomicsToParams
} from "../lib/scenario-state.js";

test("writes and restores all economics fields", () => {
  const params = new URLSearchParams("artist=Fred+again..&city=Gda%C5%84sk");
  writeEconomicsToParams(params, {
    fixedCosts: 125000,
    ticketPrice: 169,
    ticketFeesPercent: 7.5,
    variableCostPerAttendee: 25,
    ancillaryRevenuePerAttendee: 10
  });

  assert.deepEqual(readEconomicsFromParams(params), {
    fixedCosts: 125000,
    ticketPrice: 169,
    ticketFeesPercent: 7.5,
    variableCostPerAttendee: 25,
    ancillaryRevenuePerAttendee: 10
  });
  assert.equal(params.get("artist"), "Fred again..");
});

test("ignores invalid or negative URL values", () => {
  const params = new URLSearchParams("fc=-1&tp=text&tf=8");

  assert.deepEqual(readEconomicsFromParams(params), {
    ticketFeesPercent: 8
  });
});

test("removes missing values while preserving unrelated params", () => {
  const params = new URLSearchParams("artist=A&fc=1000&tp=100");
  writeEconomicsToParams(params, {
    fixedCosts: "",
    ticketPrice: 120
  });

  assert.equal(params.has("fc"), false);
  assert.equal(params.get("tp"), "120");
  assert.equal(params.get("artist"), "A");
});
