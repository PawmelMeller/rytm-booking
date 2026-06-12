import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFinancialRanking,
  compareAnalyses,
  createRankingCsv
} from "../lib/comparison.js";

test("sorts analyses by score descending", () => {
  const analyses = [
    { score: 60, city: { name: "City A" } },
    { score: 85, city: { name: "City B" } },
    { score: 72, city: { name: "City C" } }
  ];

  const sorted = compareAnalyses(analyses);

  assert.equal(sorted[0].city.name, "City B");
  assert.equal(sorted[1].city.name, "City C");
  assert.equal(sorted[2].city.name, "City A");
});

test("tie-breaks by P50 attendance", () => {
  const analyses = [
    { score: 80, city: { name: "City A" }, attendance: { p50: 500 } },
    { score: 80, city: { name: "City B" }, attendance: { p50: 800 } },
    { score: 70, city: { name: "City C" }, attendance: { p50: 1000 } }
  ];

  const sorted = compareAnalyses(analyses);

  assert.equal(sorted[0].city.name, "City B");
  assert.equal(sorted[1].city.name, "City A");
  assert.equal(sorted[2].city.name, "City C");
});

test("tie-breaks by population when scores and attendance are equal", () => {
  const analyses = [
    { score: 80, city: { name: "City A", population: 200000 }, attendance: { p50: 500 } },
    { score: 80, city: { name: "City B", population: 500000 }, attendance: { p50: 500 } }
  ];

  const sorted = compareAnalyses(analyses);

  assert.equal(sorted[0].city.name, "City B");
  assert.equal(sorted[1].city.name, "City A");
});

test("handles empty and invalid input", () => {
  assert.deepEqual(compareAnalyses([]), []);
  assert.deepEqual(compareAnalyses(null), []);
});

test("ranks cities by P50 profit before score", () => {
  const analyses = [
    {
      score: 90,
      city: { name: "Mniejszy rynek" },
      attendance: { p10: 200, p50: 400, p90: 600 }
    },
    {
      score: 75,
      city: { name: "Większy rynek" },
      attendance: { p10: 500, p50: 900, p90: 1200 }
    }
  ];
  const economics = {
    fixedCosts: 30000,
    venueCost: 0,
    artistFee: 0,
    ticketPrice: 100,
    ticketFeesPercent: 0,
    variableCostPerAttendee: 20,
    ancillaryRevenuePerAttendee: 0
  };

  const ranking = buildFinancialRanking(analyses, economics);

  assert.equal(ranking[0].analysis.city.name, "Większy rynek");
  assert.equal(ranking[0].financials.scenarios.p50.profit, 42000);
  assert.equal(ranking[1].financials.scenarios.p50.profit, 2000);
});

test("returns an empty financial ranking for invalid input", () => {
  assert.deepEqual(buildFinancialRanking([], {}), []);
  assert.deepEqual(buildFinancialRanking(null, {}), []);
});

test("exports the financial ranking as semicolon separated CSV", () => {
  const csv = createRankingCsv([{
    analysis: {
      artist: { name: 'Artysta "Test"' },
      city: { name: "Warszawa" },
      score: 82,
      attendance: { p50: 1500 },
      recommendation: "Rozważ venue na 1300–2000 osób",
      verdict: "Mocny kandydat"
    },
    financials: {
      breakEvenAttendance: 300,
      scenarios: { p50: { profit: 120000, roi: 200 } }
    }
  }]);

  assert.match(csv, /"Pozycja";"Artysta";"Miasto"/);
  assert.match(csv, /"Artysta ""Test""";"Warszawa";"82";"1500"/);
  assert.match(csv, /"300";"120000";"200";"1300–2000 osób"/);
});
