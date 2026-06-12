import {
  buildAnalysis,
  normalizeArtist,
  normalizeArtistHistory,
  normalizeCity
} from "./lib/analysis-core.js";
import { calculateFinancialProjection } from "./lib/financial.js";
import { buildFinancialRanking, createRankingCsv } from "./lib/comparison.js";
import {
  readEconomicsFromParams,
  writeEconomicsToParams
} from "./lib/scenario-state.js";
import {
  findAnalogues,
  HISTORY_TEMPLATE_HEADERS,
  normalizeHistoryRows,
  summarizeHistory
} from "./lib/history-import.js";
import { toLocative } from "./lib/polish-cities.js";
import { createAutocomplete, fetchArtistSuggestions, fetchCitySuggestions } from "./lib/autocomplete.js";

const form = document.querySelector("#search-form");
const results = document.querySelector("#results");
const searchSection = document.querySelector("#search-section");
const skeleton = document.querySelector("#skeleton");
const newSearchButton = document.querySelector("#new-search");
const shareAnalysisButton = document.querySelector("#share-analysis");
const toastContainer = document.querySelector("#toast-container");
const historyFileInput = document.querySelector("#history-file");
const historyClearButton = document.querySelector("#history-clear");
const historyTemplateButton = document.querySelector("#history-template");
const economicsInputs = {
  venueCost: document.querySelector("#venue-cost"),
  artistFee: document.querySelector("#artist-fee"),
  fixedCosts: document.querySelector("#fixed-costs"),
  ticketPrice: document.querySelector("#ticket-price"),
  ticketFeesPercent: document.querySelector("#ticket-fees"),
  variableCostPerAttendee: document.querySelector("#variable-cost"),
  ancillaryRevenuePerAttendee: document.querySelector("#ancillary-revenue")
};
let currentAnalysis = null;
let urlUpdateTimer = null;
let historyRecords = [];
let historyFileName = null;
const HISTORY_STORAGE_KEY = "rytm.promoterHistory.v1";
const HISTORY_FILE_SIZE_LIMIT = 10 * 1024 * 1024;
const HISTORY_PARSE_ROW_LIMIT = 5000;
const TOP_POLISH_CITIES = [
  "Warszawa",
  "Kraków",
  "Wrocław",
  "Łódź",
  "Poznań",
  "Gdańsk",
  "Szczecin",
  "Lublin",
  "Bydgoszcz",
  "Białystok"
];

/* ── Toast notifications ── */

const showToast = (message, type = "error") => {
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toastContainer.append(toast);

  window.setTimeout(() => {
    toast.classList.add("leaving");
    toast.addEventListener("animationend", () => toast.remove());
  }, 4000);
};

/* ── Skeleton loading ── */

const showSkeleton = () => {
  results.hidden = true;
  document.querySelector("#comparison").hidden = true;
  skeleton.hidden = false;
  skeleton.scrollIntoView({ behavior: "smooth", block: "start" });
};

const hideSkeleton = () => {
  skeleton.hidden = true;
};

/* ── Formatting helpers ── */

const formatNumber = (number) => new Intl.NumberFormat("pl-PL").format(number);
const formatCurrency = (number) => new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0
}).format(number);
const formatPercent = (number) => `${Math.round(number * 100)}%`;

const setProfit = (selector, value) => {
  const element = document.querySelector(selector);
  element.textContent = formatCurrency(value);
  element.classList.toggle("profit-positive", value >= 0);
  element.classList.toggle("profit-negative", value < 0);
};

const economicsValues = () => Object.fromEntries(
  Object.entries(economicsInputs).map(([field, input]) => [field, input.value])
);

const updateScenarioUrl = () => {
  if (!currentAnalysis) return;
  const url = new URL(window.location.href);
  writeEconomicsToParams(url.searchParams, economicsValues());
  window.history.replaceState({}, "", url);
};

const scheduleScenarioUrlUpdate = () => {
  window.clearTimeout(urlUpdateTimer);
  urlUpdateTimer = window.setTimeout(updateScenarioUrl, 180);
};

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Błąd HTTP ${response.status}`);
  }
  return response.json();
};

const saveHistory = () => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({
      fileName: historyFileName,
      records: historyRecords.slice(0, 2000)
    }));
  } catch {
    showToast("Nie udało się zapisać historii w przeglądarce.", "error");
  }
};

const restoreHistory = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "null");
    if (Array.isArray(saved?.records)) {
      historyRecords = saved.records;
      historyFileName = saved.fileName || "Zapisana historia";
    }
  } catch {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }
};

/* ── Data fetching ── */

const fetchDirectAnalysis = async (artistName, cityName) => {
  const artistQuery = encodeURIComponent(`artist:"${artistName.replaceAll('"', '\\"')}"`);
  const [artistData, cityData] = await Promise.all([
    fetchJson(`https://musicbrainz.org/ws/2/artist/?query=${artistQuery}&fmt=json&limit=5`),
    fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=pl&format=json`)
  ]);

  if (!artistData.artists?.[0]) throw new Error("Nie znaleziono artysty w MusicBrainz.");
  if (!cityData.results?.[0]) throw new Error("Nie znaleziono miasta.");

  const artist = normalizeArtist(artistData.artists[0]);
  await new Promise((resolve) => window.setTimeout(resolve, 1100));
  const eventQuery = encodeURIComponent(`artist:"${artist.name.replaceAll('"', '\\"')}"`);
  const eventData = await fetchJson(
    `https://musicbrainz.org/ws/2/event?query=${eventQuery}&fmt=json&limit=100`
  );

  return buildAnalysis({
    artist,
    city: normalizeCity(cityData.results[0]),
    artistHistory: normalizeArtistHistory(eventData.events, artist.id, eventData.count)
  });
};

const requestAnalysis = async (artist, city) => {
  if (!window.location.hostname.endsWith("github.io")) {
    try {
      return await fetchJson(`/api/analyze?artist=${encodeURIComponent(artist)}&city=${encodeURIComponent(city)}`);
    } catch (error) {
      if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) throw error;
    }
  }

  return fetchDirectAnalysis(artist, city);
};

/* ── Render results ── */

const setText = (selector, value) => {
  document.querySelector(selector).textContent = value;
};

const renderSpotify = (spotify) => {
  const link = document.querySelector("#spotify-link");
  const followersInput = document.querySelector("#spotify-followers-input");
  const popularityInput = document.querySelector("#spotify-popularity-input");
  const popularityLabel = document.querySelector("#spotify-popularity-label");

  if (!spotify?.artist) {
    setText("#spotify-title", spotify?.configured
      ? "Nie znaleziono zgodnego profilu"
      : "Integracja gotowa na klucze API");
    
    if (document.activeElement !== followersInput) followersInput.value = "";
    if (document.activeElement !== popularityInput) {
      popularityInput.value = 50;
      popularityLabel.textContent = "50/100";
    }
    
    setText("#spotify-genres", "—");
    setText("#spotify-note", spotify?.configured
      ? "Spotify jest połączone, ale wyszukiwanie nie zwróciło pewnego dopasowania."
      : "Dodaj SPOTIFY_CLIENT_ID i SPOTIFY_CLIENT_SECRET na serwerze. Wpisz wartości wyżej, aby symulować popularność i obserwujących.");
    link.hidden = true;
    return;
  }

  setText("#spotify-title", spotify.artist.name);
  
  if (document.activeElement !== followersInput) {
    followersInput.value = Number.isFinite(spotify.artist.followers) ? spotify.artist.followers : "";
  }
  if (document.activeElement !== popularityInput) {
    const popularity = Number.isFinite(spotify.artist.popularity) ? spotify.artist.popularity : 50;
    popularityInput.value = popularity;
    popularityLabel.textContent = `${popularity}/100`;
  }

  setText("#spotify-genres", spotify.artist.genres.slice(0, 4).join(", ") || "Brak danych");
  setText("#spotify-note", "Od lutego 2026 r. Spotify w Development Mode nie udostępnia pól obserwujących i popularności. Wpisz je ręcznie powyżej, aby symulować wpływ na scoring i frekwencję.");
  link.href = spotify.artist.url;
  link.hidden = !spotify.artist.url;
};

let currentComparisonAnalyses = null;
let currentComparisonRanking = [];

const showComparison = (analyses) => {
  currentComparisonAnalyses = analyses;
  currentComparisonRanking = buildFinancialRanking(analyses, economicsValues());
  const artistName = currentComparisonRanking[0].analysis.artist.name;

  setText("#comparison-artist-title", `Porównanie miast dla artysty: ${artistName}`);
  setText("#comparison-count", `${currentComparisonRanking.length} miast`);

  const tbody = document.querySelector("#comparison-tbody");
  tbody.replaceChildren();

  currentComparisonRanking.forEach(({ analysis, financials: ecoResult }, index) => {
    const tr = document.createElement("tr");
    if (index === 0) {
      tr.className = "comparison-winner";
    }

    const tdCity = document.createElement("td");
    tdCity.textContent = analysis.city.name;

    const tdScore = document.createElement("td");
    tdScore.textContent = analysis.score;

    const tdP50 = document.createElement("td");
    tdP50.textContent = `${formatNumber(analysis.attendance.p50)} osób`;

    const tdVenue = document.createElement("td");
    tdVenue.textContent = analysis.recommendation.replace("Rozważ venue na ", "");

    const tdBE = document.createElement("td");
    tdBE.textContent = ecoResult.breakEvenAttendance === null
      ? "Nieosiągalny"
      : `${formatNumber(ecoResult.breakEvenAttendance)}`;

    const tdProfit = document.createElement("td");
    const p50Profit = ecoResult.scenarios.p50.profit;
    tdProfit.textContent = formatCurrency(p50Profit);
    tdProfit.className = p50Profit >= 0 ? "profit-positive" : "profit-negative";

    const tdRoi = document.createElement("td");
    const p50Roi = ecoResult.scenarios.p50.roi;
    tdRoi.textContent = `${p50Roi > 0 ? "+" : ""}${p50Roi}%`;
    tdRoi.className = `roi-cell ${p50Roi >= 0 ? "profit-positive" : "profit-negative"}`;

    const tdVerdict = document.createElement("td");
    tdVerdict.textContent = analysis.verdict;

    tr.append(tdCity, tdScore, tdP50, tdVenue, tdBE, tdProfit, tdRoi, tdVerdict);
    tbody.append(tr);
  });

  hideSkeleton();
  results.hidden = true;
  document.querySelector("#comparison").hidden = false;
  document.querySelector("#comparison").scrollIntoView({ behavior: "smooth", block: "start" });
};

const requestAnalysesWithLimit = async (artist, cities, concurrency = 3) => {
  const results = new Array(cities.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < cities.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await requestAnalysis(artist, cities[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, cities.length) }, () => worker())
  );
  return results;
};

const renderEconomics = () => {
  const comparisonEl = document.querySelector("#comparison");
  if (comparisonEl && !comparisonEl.hidden && currentComparisonAnalyses) {
    showComparison(currentComparisonAnalyses);
    scheduleScenarioUrlUpdate();
    return;
  }

  if (!currentAnalysis) return;
  const result = calculateFinancialProjection({
    fixedCosts: economicsInputs.fixedCosts.value,
    venueCost: economicsInputs.venueCost.value,
    artistFee: economicsInputs.artistFee.value,
    ticketPrice: economicsInputs.ticketPrice.value,
    ticketFeesPercent: economicsInputs.ticketFeesPercent.value,
    variableCostPerAttendee: economicsInputs.variableCostPerAttendee.value,
    ancillaryRevenuePerAttendee: economicsInputs.ancillaryRevenuePerAttendee.value,
    attendance: currentAnalysis.attendance
  });

  setText("#break-even-attendance", result.breakEvenAttendance === null
    ? "Nieosiągalny"
    : formatNumber(result.breakEvenAttendance));
  setText("#net-ticket-revenue", formatCurrency(result.netTicketRevenue));
  setText("#contribution-per-head", formatCurrency(result.contributionPerAttendee));

  for (const key of ["p10", "p50", "p90"]) {
    const scenario = result.scenarios[key];
    setProfit(`#profit-${key}`, scenario.profit);
    setText(`#profit-${key}-attendance`, `${formatNumber(scenario.attendance)} osób`);
    
    // Update detailed table row cells
    setText(`#table-attendance-${key}`, formatNumber(scenario.attendance));
    setText(`#table-ticket-${key}`, formatCurrency(scenario.ticketRevenue));
    setText(`#table-ancillary-${key}`, formatCurrency(scenario.ancillaryRevenue));
    setText(`#table-rev-${key}`, formatCurrency(scenario.totalRevenue));
    setText(`#table-fixed-${key}`, formatCurrency(scenario.fixedCosts));
    setText(`#table-var-${key}`, formatCurrency(scenario.variableCosts));
    setText(`#table-costs-${key}`, formatCurrency(scenario.totalCosts));
    
    const profitEl = document.querySelector(`#table-profit-${key}`);
    profitEl.textContent = formatCurrency(scenario.profit);
    profitEl.className = scenario.profit >= 0 ? "profit-positive" : "profit-negative";
    
    const roiEl = document.querySelector(`#table-roi-${key}`);
    roiEl.textContent = `${scenario.roi > 0 ? "+" : ""}${scenario.roi}%`;
    roiEl.className = `roi-value ${scenario.roi >= 0 ? "profit-positive" : "profit-negative"}`;
  }

  const realProfit = result.scenarios.p50.profit;
  const status = document.querySelector("#economics-status");
  status.textContent = realProfit >= 0 ? "P50 powyżej zera" : "P50 poniżej zera";
  status.classList.toggle("is-positive", realProfit >= 0);
  status.classList.toggle("is-negative", realProfit < 0);
  scheduleScenarioUrlUpdate();
};

const renderHistory = () => {
  const empty = document.querySelector("#history-empty");
  const resultsElement = document.querySelector("#history-results");
  const hasHistory = historyRecords.length > 0;
  empty.hidden = hasHistory;
  resultsElement.hidden = !hasHistory;
  historyClearButton.hidden = !hasHistory;
  if (!hasHistory) return;

  const summary = summarizeHistory(historyRecords);
  setText("#history-count", formatNumber(summary.count));
  setText("#history-attendance", summary.averageAttendance === null
    ? "—"
    : formatNumber(Math.round(summary.averageAttendance)));
  setText("#history-profit", summary.averageProfit === null
    ? "—"
    : formatCurrency(summary.averageProfit));
  setText("#history-profitable", summary.profitableShare === null
    ? "—"
    : formatPercent(summary.profitableShare));
  setText("#history-file-name", historyFileName || "Historia promotera");
  setText("#history-date-range", summary.dateFrom && summary.dateTo
    ? `${summary.dateFrom} – ${summary.dateTo}`
    : "Brak kompletnych dat");

  const analogues = currentAnalysis
    ? findAnalogues(historyRecords, currentAnalysis.artist.name, currentAnalysis.city.name)
    : [];
  setText("#analogues-title", currentAnalysis
    ? `${currentAnalysis.artist.name} / ${currentAnalysis.city.name}`
    : "Uruchom analizę artysty i miasta");

  const analoguesContainer = document.querySelector("#analogues-list");
  analoguesContainer.replaceChildren();

  if (!analogues.length) {
    const emptyAnalogue = document.createElement("p");
    emptyAnalogue.className = "analogues-empty";
    emptyAnalogue.textContent = "Brak wydarzeń z tym artystą lub miastem w zaimportowanej historii.";
    analoguesContainer.append(emptyAnalogue);
    setText("#history-benchmark", "Brak analogów");
    return;
  }

  const benchmark = Math.round(
    analogues.reduce((sum, record) => sum + record.ticketsSold, 0) / analogues.length
  );
  setText("#history-benchmark", `Benchmark: ${formatNumber(benchmark)} biletów`);

  analogues.forEach((record) => {
    const item = document.createElement("div");
    item.className = "analogue-item";
    const identity = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const metrics = document.createElement("div");
    const attendance = document.createElement("strong");
    const profit = document.createElement("span");

    title.textContent = `${record.artist} · ${record.city}`;
    meta.textContent = [record.date, record.venue].filter(Boolean).join(" · ") || "Brak daty i venue";
    attendance.textContent = `${formatNumber(record.ticketsSold)} biletów`;
    profit.textContent = Number.isFinite(record.profit) ? formatCurrency(record.profit) : "Brak wyniku";
    profit.className = Number.isFinite(record.profit) && record.profit < 0 ? "analogue-loss" : "";

    identity.append(title, meta);
    metrics.append(attendance, profit);
    item.append(identity, metrics);
    analoguesContainer.append(item);
  });
};

const parseHistoryFile = async (file) => {
  if (!window.XLSX) throw new Error("Moduł arkuszy nie został załadowany.");
  if (file.size > HISTORY_FILE_SIZE_LIMIT) {
    throw new Error("Plik jest za duży. Maksymalny rozmiar to 10 MB.");
  }
  const data = await file.arrayBuffer();
  const workbook = window.XLSX.read(data, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Plik nie zawiera arkusza.");
  const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: true
  });
  return normalizeHistoryRows(rows.slice(0, HISTORY_PARSE_ROW_LIMIT));
};

const showAnalysis = (analysis) => {
  currentAnalysis = analysis;
  const { artist, city } = analysis;
  const competitionCount = analysis.market.competitionCount;
  const competitionLabel = competitionCount === null
    ? "Brak danych"
    : competitionCount <= 2 ? "Niska" : competitionCount <= 5 ? "Średnia" : "Wysoka";
  const demand = analysis.score >= 78 ? "Wysoki" : analysis.score >= 65 ? "Dobry" : "Umiarkowany";

  setText("#result-artist", artist.name);
  setText("#result-city", toLocative(city.name));
  setText("#score", analysis.score);
  setText("#verdict", analysis.verdict);
  setText("#verdict-copy", analysis.verdictCopy);
  setText("#recommendation", analysis.recommendation.replace(/\d+/g, (value) => formatNumber(Number(value))));
  setText("#demand-value", demand);
  setText("#demand-change", "model kierunkowy");
  setText("#audience-value", city.population ? formatNumber(city.population) : "Brak danych");
  setText("#audience-copy", analysis.market.locationLabel || "zweryfikowana lokalizacja");
  if (competitionCount === null) {
    setText("#competition-label", "Historia live");
    setText("#competition-value", formatNumber(analysis.market.documentedArtistEvents || 0));
    setText("#competition-copy", "potwierdzonych wydarzeń");
  } else {
    setText("#competition-label", "Konkurencja");
    setText("#competition-value", competitionLabel);
    setText("#competition-copy", `${competitionCount} wydarzeń muzycznych`);
  }
  setText("#tickets-value", formatNumber(analysis.attendance.p50));
  setText("#p10", formatNumber(analysis.attendance.p10));
  setText("#p50", formatNumber(analysis.attendance.p50));
  setText("#p90", formatNumber(analysis.attendance.p90));
  setText("#coverage", analysis.coverage === "live" ? "Dane live" : "Dane częściowe");
  setText("#updated", `Źródła: ${analysis.sources.map((source) => source.name).join(", ")}`);
  renderSpotify(analysis.spotify);
  renderHistory();

  document.querySelector(".score-ring").style.setProperty("--score", analysis.score);
  const signalsContainer = document.querySelector("#signals");
  signalsContainer.replaceChildren();

  analysis.signals.forEach((signal) => {
    const card = document.createElement("div");
    const head = document.createElement("div");
    const dot = document.createElement("i");
    const title = document.createElement("strong");
    const copy = document.createElement("p");

    card.className = "signal";
    head.className = "signal-head";
    title.textContent = signal.title;
    copy.textContent = signal.copy;
    head.append(dot, title);
    card.append(head, copy);
    signalsContainer.append(card);
  });

  hideSkeleton();
  results.hidden = false;
  renderEconomics();
  results.scrollIntoView({ behavior: "smooth", block: "start" });
};

/* ── Form submission ── */

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const artist = document.querySelector("#artist").value.trim();
  const cityInputs = Array.from(document.querySelectorAll(".city-input"));
  const cityNames = cityInputs.map(input => input.value.trim()).filter(val => val.length >= 2);

  if (!artist || cityNames.length === 0) return;

  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button.innerHTML;
  button.disabled = true;
  button.querySelector("span").textContent = "Analizuję...";

  showSkeleton();

  try {
    if (cityNames.length === 1) {
      const analysis = await requestAnalysis(artist, cityNames[0]);
      showAnalysis(analysis);

      const url = new URL(window.location.href);
      url.searchParams.set("artist", artist);
      url.searchParams.set("city", cityNames[0]);
      url.searchParams.delete("cities");
      window.history.replaceState({}, "", url);
    } else {
      const analyses = await requestAnalysesWithLimit(artist, cityNames);
      showComparison(analyses);

      const url = new URL(window.location.href);
      url.searchParams.set("artist", artist);
      url.searchParams.set("cities", cityNames.join(","));
      url.searchParams.delete("city");
      window.history.replaceState({}, "", url);
    }
  } catch (error) {
    hideSkeleton();
    showToast(error.message || "Nie udało się przeprowadzić analizy.", "error");
  } finally {
    button.disabled = false;
    button.innerHTML = originalLabel;
  }
});

newSearchButton.addEventListener("click", () => {
  searchSection.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => document.querySelector("#artist").focus(), 500);
});

shareAnalysisButton.addEventListener("click", async () => {
  if (!currentAnalysis) return;
  updateScenarioUrl();

  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("Link do analizy został skopiowany.", "success");
  } catch {
    showToast("Nie udało się skopiować linku. Skopiuj adres z paska przeglądarki.", "error");
  }
});

historyFileInput.addEventListener("change", async () => {
  const file = historyFileInput.files?.[0];
  if (!file) return;

  try {
    const imported = await parseHistoryFile(file);
    if (!imported.records.length) {
      throw new Error("Nie znaleziono poprawnych wierszy. Wymagane są: artysta, miasto i sprzedane bilety.");
    }
    historyRecords = imported.records.slice(0, 2000);
    historyFileName = file.name;
    saveHistory();
    renderHistory();
    const rejectedNote = imported.rejected ? ` Odrzucono: ${imported.rejected}.` : "";
    showToast(`Zaimportowano ${historyRecords.length} wydarzeń.${rejectedNote}`, "success");
  } catch (error) {
    showToast(error.message || "Nie udało się odczytać pliku.", "error");
  } finally {
    historyFileInput.value = "";
  }
});

historyClearButton.addEventListener("click", () => {
  historyRecords = [];
  historyFileName = null;
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  renderHistory();
  showToast("Historia została usunięta z tej przeglądarki.", "success");
});

historyTemplateButton.addEventListener("click", () => {
  const example = [
    HISTORY_TEMPLATE_HEADERS,
    ["Przykładowy artysta", "Gdańsk", "2025-05-15", "Klub", 1200, 950, 129, 122550, 85000, 12000, 25550]
  ];
  const csv = example
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rytm-szablon-historii.csv";
  link.click();
  URL.revokeObjectURL(url);
});

createAutocomplete({
  input: document.querySelector("#artist"),
  fetchSuggestions: fetchArtistSuggestions,
  onSelect: () => document.querySelector(".city-input").focus()
});

Object.values(economicsInputs).forEach((input) => {
  input.addEventListener("input", renderEconomics);
});

createAutocomplete({
  input: document.querySelector(".city-input"),
  fetchSuggestions: fetchCitySuggestions
});

const addCityField = (value = "", focus = true) => {
  const container = document.querySelector("#cities-container");
  const count = container.querySelectorAll(".city-field-wrapper").length;
  if (count >= 10) {
    showToast("Możesz dodać maksymalnie 10 miast do porównania.", "error");
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "city-field-wrapper";

  const label = document.createElement("label");
  label.className = "field city-field";
  label.style.width = "100%";
  label.style.paddingBottom = "4px";

  const spanLabel = document.createElement("span");
  spanLabel.className = "field-label";
  spanLabel.textContent = `Miasto ${count + 1}`;

  const wrap = document.createElement("span");
  wrap.className = "input-wrap";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z");
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "10");
  circle.setAttribute("r", "2.5");
  svg.append(path, circle);

  const input = document.createElement("input");
  input.className = "city-input";
  input.type = "text";
  input.placeholder = "np. Kraków";
  input.autocomplete = "off";
  input.required = true;
  input.value = value;

  wrap.append(svg, input);
  label.append(spanLabel, wrap);
  wrapper.append(label);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-city-btn";
  removeBtn.ariaLabel = "Usuń miasto";

  const removeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  removeSvg.setAttribute("viewBox", "0 0 24 24");
  removeSvg.setAttribute("fill", "none");
  removeSvg.setAttribute("stroke", "currentColor");
  removeSvg.setAttribute("stroke-width", "2.5");
  removeSvg.setAttribute("stroke-linecap", "round");
  removeSvg.setAttribute("stroke-linejoin", "round");

  const removePath1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  removePath1.setAttribute("x1", "18");
  removePath1.setAttribute("y1", "6");
  removePath1.setAttribute("x2", "6");
  removePath1.setAttribute("y2", "18");
  const removePath2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  removePath2.setAttribute("x1", "6");
  removePath2.setAttribute("y1", "6");
  removePath2.setAttribute("x2", "18");
  removePath2.setAttribute("y2", "18");
  removeSvg.append(removePath1, removePath2);
  removeBtn.append(removeSvg);

  removeBtn.addEventListener("click", () => {
    wrapper.remove();
    const wrappers = container.querySelectorAll(".city-field-wrapper");
    wrappers.forEach((w, index) => {
      if (index > 0) {
        w.querySelector(".field-label").textContent = `Miasto ${index + 1}`;
      } else {
        w.querySelector(".field-label").textContent = `Miasto`;
      }
    });
  });

  wrapper.append(removeBtn);
  container.append(wrapper);

  createAutocomplete({
    input: input,
    fetchSuggestions: fetchCitySuggestions
  });

  if (focus) input.focus();
};

document.querySelector("#add-city-btn").addEventListener("click", () => addCityField(""));

document.querySelector("#top-cities-btn").addEventListener("click", () => {
  const artist = document.querySelector("#artist").value.trim();
  if (!artist) {
    showToast("Najpierw wpisz artystę.", "error");
    document.querySelector("#artist").focus();
    return;
  }

  const container = document.querySelector("#cities-container");
  const wrappers = Array.from(container.querySelectorAll(".city-field-wrapper"));
  wrappers.slice(1).forEach((wrapper) => wrapper.remove());
  document.querySelector(".city-input").value = TOP_POLISH_CITIES[0];
  TOP_POLISH_CITIES.slice(1).forEach((city) => addCityField(city, false));
  form.requestSubmit();
});

document.querySelector("#new-search-comparison").addEventListener("click", () => {
  searchSection.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => document.querySelector("#artist").focus(), 500);
});

document.querySelector("#share-comparison").addEventListener("click", async () => {
  if (!currentComparisonAnalyses) return;
  const url = new URL(window.location.href);
  url.searchParams.set("artist", document.querySelector("#artist").value.trim());
  const cities = Array.from(document.querySelectorAll(".city-input"))
    .map(input => input.value.trim())
    .filter(val => val.length >= 2);
  url.searchParams.set("cities", cities.join(","));
  writeEconomicsToParams(url.searchParams, economicsValues());
  window.history.replaceState({}, "", url);

  try {
    await navigator.clipboard.writeText(url.href);
    showToast("Link do porównania został skopiowany.", "success");
  } catch {
    showToast("Nie udało się skopiować linku. Skopiuj adres z paska przeglądarki.", "error");
  }
});

document.querySelector("#export-comparison").addEventListener("click", () => {
  if (!currentComparisonRanking.length) return;

  const csv = createRankingCsv(currentComparisonRanking);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rytm-ranking-${currentComparisonRanking[0].analysis.artist.name
    .toLocaleLowerCase("pl-PL")
    .replaceAll(/[^a-z0-9ąćęłńóśźż]+/gi, "-")
    .replace(/^-|-$/g, "")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Ranking CSV został pobrany.", "success");
});

const recalculateAndShow = () => {
  if (!currentAnalysis) return;
  const updated = buildAnalysis({
    artist: currentAnalysis.artist,
    city: currentAnalysis.city,
    artistHistory: currentAnalysis.artistHistory || { events: [], documentedCount: 0 },
    events: currentAnalysis.events || [],
    liveData: currentAnalysis.coverage === "live",
    spotify: currentAnalysis.spotify
  });
  showAnalysis(updated);
};

const spotifyFollowersInput = document.querySelector("#spotify-followers-input");
const spotifyPopularityInput = document.querySelector("#spotify-popularity-input");
const spotifyPopularityLabel = document.querySelector("#spotify-popularity-label");

spotifyFollowersInput.addEventListener("input", () => {
  if (!currentAnalysis) return;
  if (!currentAnalysis.spotify) {
    currentAnalysis.spotify = { configured: true, artist: {} };
  }
  if (!currentAnalysis.spotify.artist) {
    currentAnalysis.spotify.artist = {};
  }
  currentAnalysis.spotify.artist.followers = Number(spotifyFollowersInput.value) || 0;
  recalculateAndShow();
});

spotifyPopularityInput.addEventListener("input", () => {
  if (!currentAnalysis) return;
  if (!currentAnalysis.spotify) {
    currentAnalysis.spotify = { configured: true, artist: {} };
  }
  if (!currentAnalysis.spotify.artist) {
    currentAnalysis.spotify.artist = {};
  }
  const popularity = Number(spotifyPopularityInput.value);
  currentAnalysis.spotify.artist.popularity = popularity;
  spotifyPopularityLabel.textContent = `${popularity}/100`;
  recalculateAndShow();
});

/* ── URL params auto-search ── */

const initialParams = new URLSearchParams(window.location.search);
const initialArtist = initialParams.get("artist");
const initialCity = initialParams.get("city");
const initialCities = initialParams.get("cities") ? initialParams.get("cities").split(",") : null;
const initialEconomics = readEconomicsFromParams(initialParams);

restoreHistory();
renderHistory();

for (const [field, value] of Object.entries(initialEconomics)) {
  economicsInputs[field].value = value;
}

if (initialArtist) {
  document.querySelector("#artist").value = initialArtist;
  if (initialCity) {
    document.querySelector(".city-input").value = initialCity;
    form.requestSubmit();
  } else if (initialCities && initialCities.length > 0) {
    document.querySelector(".city-input").value = initialCities[0];
    for (let i = 1; i < initialCities.length; i++) {
      addCityField(initialCities[i]);
    }
    form.requestSubmit();
  }
}
