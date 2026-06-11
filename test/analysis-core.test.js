import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalysis, normalizeArtist, normalizeCity } from "../lib/analysis-core.js";

test("normalizes and scores verified artist and city data", () => {
  const artist = normalizeArtist({
    id: "artist-id",
    name: "Fred again..",
    type: "Person",
    country: "GB",
    score: 100,
    tags: [{ name: "electronic", count: 8 }, { name: "house", count: 3 }]
  });
  const city = normalizeCity({
    id: 3099434,
    name: "Gdańsk",
    country: "Polska",
    country_code: "PL",
    admin1: "Województwo pomorskie",
    population: 486492,
    latitude: 54.35,
    longitude: 18.65
  });

  const result = buildAnalysis({ artist, city });

  assert.equal(result.artist.name, "Fred again..");
  assert.equal(result.city.name, "Gdańsk");
  assert.equal(result.coverage, "partial");
  assert.ok(result.score >= 45 && result.score <= 93);
  assert.ok(result.attendance.p10 < result.attendance.p50);
  assert.ok(result.attendance.p50 < result.attendance.p90);
});

test("uses Ticketmaster event counts only when live data is available", () => {
  const artist = normalizeArtist({ id: "a", name: "Test Artist", score: 90, tags: [] });
  const city = normalizeCity({ id: 1, name: "Warszawa", country_code: "PL", population: 1800000 });
  const events = [
    { attractions: ["Test Artist"] },
    { attractions: ["Other Artist"] },
    { attractions: ["Another Artist"] }
  ];

  const result = buildAnalysis({ artist, city, events, liveData: true });

  assert.equal(result.coverage, "live");
  assert.equal(result.market.artistEventCount, 1);
  assert.equal(result.market.competitionCount, 2);
});
