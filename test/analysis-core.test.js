import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnalysis,
  normalizeArtist,
  normalizeArtistHistory,
  normalizeCity
} from "../lib/analysis-core.js";

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

test("uses verified MusicBrainz history when market events are unavailable", () => {
  const artist = normalizeArtist({ id: "a", name: "Test Artist", score: 90, tags: [] });
  const city = normalizeCity({ id: 1, name: "Gdańsk", country_code: "PL", population: 487371 });
  const artistHistory = {
    documentedCount: 2,
    events: [
      { id: "e2", name: "Recent Show", date: "2025-04-10", venue: "Venue B" },
      { id: "e1", name: "Older Show", date: "2024-02-10", venue: "Venue A" }
    ]
  };

  const result = buildAnalysis({ artist, city, artistHistory });

  assert.equal(result.market.documentedArtistEvents, 2);
  assert.equal(result.market.latestArtistEvent.name, "Recent Show");
  assert.match(result.signals[1].title, /Historia live: 2/);
  assert.match(result.signals[1].copy, /Venue B/);
});

test("filters MusicBrainz search results by the verified artist id", () => {
  const history = normalizeArtistHistory([
    {
      id: "match",
      name: "Matching Event",
      "life-span": { begin: "2025-01-10" },
      relations: [
        { artist: { id: "verified-artist" } },
        { place: { name: "Venue One" } }
      ]
    },
    {
      id: "other",
      name: "Wrong Artist",
      "life-span": { begin: "2026-01-10" },
      relations: [{ artist: { id: "another-artist" } }]
    }
  ], "verified-artist", 2);

  assert.equal(history.documentedCount, 1);
  assert.equal(history.events[0].name, "Matching Event");
  assert.equal(history.events[0].venue, "Venue One");
});
