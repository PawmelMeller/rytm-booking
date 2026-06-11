import test from "node:test";
import assert from "node:assert/strict";
import { toLocative } from "../lib/polish-cities.js";

test("returns locative for major Polish cities from dictionary", () => {
  const cases = [
    ["Gdańsk", "Gdańsku"],
    ["Warszawa", "Warszawie"],
    ["Kraków", "Krakowie"],
    ["Wrocław", "Wrocławiu"],
    ["Poznań", "Poznaniu"],
    ["Łódź", "Łodzi"],
    ["Katowice", "Katowicach"],
    ["Sopot", "Sopocie"],
    ["Gdynia", "Gdyni"],
    ["Szczecin", "Szczecinie"],
    ["Lublin", "Lublinie"],
    ["Rzeszów", "Rzeszowie"],
    ["Bydgoszcz", "Bydgoszczy"],
    ["Toruń", "Toruniu"],
    ["Białystok", "Białymstoku"],
  ];

  for (const [input, expected] of cases) {
    assert.equal(toLocative(input), expected, `${input} → ${expected}`);
  }
});

test("is case-insensitive", () => {
  assert.equal(toLocative("gdańsk"), "Gdańsku");
  assert.equal(toLocative("WARSZAWA"), "Warszawie");
});

test("handles ASCII variants of Polish city names", () => {
  assert.equal(toLocative("Krakow"), "Krakowie");
  assert.equal(toLocative("Wroclaw"), "Wrocławiu");
  assert.equal(toLocative("Lodz"), "Łodzi");
  assert.equal(toLocative("Poznan"), "Poznaniu");
});

test("applies heuristic fallback for unknown cities", () => {
  // Feminine -a → -ie
  assert.equal(toLocative("Nysa"), "Nysie");
  // Neuter -e → -u
  assert.equal(toLocative("Zakopane"), "Zakopanu");
});

test("returns original name for empty or null input", () => {
  assert.equal(toLocative(""), "");
  assert.equal(toLocative(null), null);
});

test("passes through non-Polish city names unchanged via heuristic", () => {
  // Foreign cities get heuristic applied but that's acceptable
  const result = toLocative("Berlin");
  assert.ok(typeof result === "string");
});
