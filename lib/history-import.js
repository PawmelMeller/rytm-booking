const FIELD_ALIASES = {
  artist: ["artist", "artysta", "wykonawca", "headliner"],
  city: ["city", "miasto", "rynek", "market"],
  date: ["date", "data", "eventdate", "datawydarzenia", "datakoncertu"],
  venue: ["venue", "obiekt", "klub", "miejsce"],
  capacity: ["capacity", "pojemnosc", "pojemność", "cap"],
  ticketsSold: ["ticketssold", "sold", "sprzedanebilety", "biletysprzedane", "frekwencja", "attendance"],
  ticketPrice: ["ticketprice", "price", "cenabiletu", "sredniacenabiletu", "średniacenabiletu"],
  revenue: ["revenue", "gross", "przychod", "przychód", "sprzedaz", "sprzedaż"],
  fixedCosts: ["fixedcosts", "kosztystale", "kosztystałe", "kosztcalkowity", "kosztcałkowity"],
  variableCosts: ["variablecosts", "kosztyzmienne"],
  profit: ["profit", "zysk", "wynik", "netprofit"]
};

const simplify = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]/g, "");

const numberValue = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const dateValue = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86400000).toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  const polishDate = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (polishDate) {
    const [, day, month, year] = polishDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

export const mapHeaders = (headers) => {
  const mapping = {};

  for (const header of headers) {
    const normalized = simplify(header);
    const field = Object.entries(FIELD_ALIASES)
      .find(([, aliases]) => aliases.some((alias) => simplify(alias) === normalized))?.[0];
    if (field && !mapping[field]) mapping[field] = header;
  }

  return mapping;
};

export const normalizeHistoryRows = (rows = []) => {
  if (!rows.length) return { records: [], rejected: 0, mapping: {} };
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
  const mapping = mapHeaders(headers);
  const records = [];
  let rejected = 0;

  for (const row of rows) {
    const artist = String(row[mapping.artist] ?? "").trim();
    const city = String(row[mapping.city] ?? "").trim();
    const ticketsSold = numberValue(row[mapping.ticketsSold]);

    if (!artist || !city || ticketsSold === null || ticketsSold < 0) {
      rejected += 1;
      continue;
    }

    const ticketPrice = numberValue(row[mapping.ticketPrice]);
    const revenue = numberValue(row[mapping.revenue])
      ?? (ticketPrice !== null ? ticketsSold * ticketPrice : null);
    const fixedCosts = numberValue(row[mapping.fixedCosts]);
    const variableCosts = numberValue(row[mapping.variableCosts]);
    const profit = numberValue(row[mapping.profit])
      ?? (revenue !== null && fixedCosts !== null
        ? revenue - fixedCosts - (variableCosts || 0)
        : null);

    records.push({
      artist,
      city,
      date: dateValue(row[mapping.date]),
      venue: String(row[mapping.venue] ?? "").trim() || null,
      capacity: numberValue(row[mapping.capacity]),
      ticketsSold: Math.round(ticketsSold),
      ticketPrice,
      revenue,
      fixedCosts,
      variableCosts,
      profit
    });
  }

  return { records, rejected, mapping };
};

const average = (values) => {
  const numbers = values.filter((value) => Number.isFinite(value));
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
};

export const summarizeHistory = (records = []) => {
  const dated = records.map((record) => record.date).filter(Boolean).sort();
  return {
    count: records.length,
    averageAttendance: average(records.map((record) => record.ticketsSold)),
    averageTicketPrice: average(records.map((record) => record.ticketPrice)),
    averageProfit: average(records.map((record) => record.profit)),
    profitableShare: records.some((record) => Number.isFinite(record.profit))
      ? records.filter((record) => Number.isFinite(record.profit) && record.profit >= 0).length
        / records.filter((record) => Number.isFinite(record.profit)).length
      : null,
    dateFrom: dated[0] || null,
    dateTo: dated.at(-1) || null
  };
};

export const findAnalogues = (records = [], artist, city, limit = 3) => {
  const targetArtist = simplify(artist);
  const targetCity = simplify(city);

  return records
    .map((record) => {
      const sameArtist = simplify(record.artist) === targetArtist;
      const sameCity = simplify(record.city) === targetCity;
      const score = (sameArtist ? 3 : 0) + (sameCity ? 2 : 0) + (record.date ? 0.1 : 0);
      return { ...record, similarityScore: score, sameArtist, sameCity };
    })
    .filter((record) => record.similarityScore > 0)
    .sort((left, right) =>
      right.similarityScore - left.similarityScore
      || String(right.date || "").localeCompare(String(left.date || ""))
    )
    .slice(0, limit);
};

export const HISTORY_TEMPLATE_HEADERS = [
  "Artysta",
  "Miasto",
  "Data",
  "Venue",
  "Pojemność",
  "Sprzedane bilety",
  "Cena biletu",
  "Przychód",
  "Koszty stałe",
  "Koszty zmienne",
  "Zysk"
];
