import test from "node:test";
import assert from "node:assert/strict";
import {
  findAnalogues,
  mapHeaders,
  normalizeHistoryRows,
  summarizeHistory
} from "../lib/history-import.js";

test("maps common Polish and English column names", () => {
  const mapping = mapHeaders([
    "Artysta",
    "Miasto",
    "Data koncertu",
    "Sprzedane bilety",
    "Ticket Price",
    "Zysk"
  ]);

  assert.equal(mapping.artist, "Artysta");
  assert.equal(mapping.city, "Miasto");
  assert.equal(mapping.date, "Data koncertu");
  assert.equal(mapping.ticketsSold, "Sprzedane bilety");
  assert.equal(mapping.ticketPrice, "Ticket Price");
  assert.equal(mapping.profit, "Zysk");
});

test("normalizes rows and derives revenue and profit", () => {
  const result = normalizeHistoryRows([
    {
      Artysta: "Artist A",
      Miasto: "Gdańsk",
      Data: "15.05.2025",
      "Sprzedane bilety": "1 000",
      "Cena biletu": "120 zł",
      "Koszty stałe": "90 000",
      "Koszty zmienne": "10 000"
    },
    { Artysta: "", Miasto: "Gdańsk", "Sprzedane bilety": 100 }
  ]);

  assert.equal(result.records.length, 1);
  assert.equal(result.rejected, 1);
  assert.equal(result.records[0].date, "2025-05-15");
  assert.equal(result.records[0].revenue, 120000);
  assert.equal(result.records[0].profit, 20000);
});

test("summarizes history and ranks same-artist same-city analogues first", () => {
  const records = [
    { artist: "Artist A", city: "Gdańsk", date: "2025-01-01", ticketsSold: 1000, ticketPrice: 100, profit: 10000 },
    { artist: "Artist A", city: "Warszawa", date: "2025-02-01", ticketsSold: 1200, ticketPrice: 120, profit: 20000 },
    { artist: "Artist B", city: "Gdańsk", date: "2025-03-01", ticketsSold: 800, ticketPrice: 90, profit: -5000 }
  ];
  const summary = summarizeHistory(records);
  const analogues = findAnalogues(records, "Artist A", "Gdańsk");

  assert.equal(summary.count, 3);
  assert.equal(summary.averageAttendance, 1000);
  assert.equal(summary.profitableShare, 2 / 3);
  assert.equal(analogues[0].artist, "Artist A");
  assert.equal(analogues[0].city, "Gdańsk");
  assert.equal(analogues[0].sameArtist, true);
  assert.equal(analogues[0].sameCity, true);
});
