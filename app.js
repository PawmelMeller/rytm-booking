import {
  buildAnalysis,
  normalizeArtist,
  normalizeArtistHistory,
  normalizeCity
} from "./lib/analysis-core.js";
import { calculateBreakEven } from "./lib/economics.js";
import {
  readEconomicsFromParams,
  writeEconomicsToParams
} from "./lib/scenario-state.js";
import { toLocative } from "./lib/polish-cities.js";
import { createAutocomplete, fetchArtistSuggestions, fetchCitySuggestions } from "./lib/autocomplete.js";

const form = document.querySelector("#search-form");
const results = document.querySelector("#results");
const searchSection = document.querySelector("#search-section");
const skeleton = document.querySelector("#skeleton");
const newSearchButton = document.querySelector("#new-search");
const shareAnalysisButton = document.querySelector("#share-analysis");
const toastContainer = document.querySelector("#toast-container");
const economicsInputs = {
  fixedCosts: document.querySelector("#fixed-costs"),
  ticketPrice: document.querySelector("#ticket-price"),
  ticketFeesPercent: document.querySelector("#ticket-fees"),
  variableCostPerAttendee: document.querySelector("#variable-cost"),
  ancillaryRevenuePerAttendee: document.querySelector("#ancillary-revenue")
};
let currentAnalysis = null;
let urlUpdateTimer = null;

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
  if (!spotify?.artist) {
    setText("#spotify-title", spotify?.configured
      ? "Nie znaleziono zgodnego profilu"
      : "Integracja gotowa na klucze API");
    setText("#spotify-followers", "—");
    setText("#spotify-popularity", "—");
    setText("#spotify-genres", "—");
    setText("#spotify-note", spotify?.configured
      ? "Spotify jest połączone, ale wyszukiwanie nie zwróciło pewnego dopasowania."
      : "Dodaj SPOTIFY_CLIENT_ID i SPOTIFY_CLIENT_SECRET na serwerze. Spotify nie wpływa na scoring.");
    link.hidden = true;
    return;
  }

  setText("#spotify-title", spotify.artist.name);
  setText("#spotify-followers", formatNumber(spotify.artist.followers));
  setText("#spotify-popularity", `${spotify.artist.popularity}/100`);
  setText("#spotify-genres", spotify.artist.genres.slice(0, 4).join(", ") || "Brak danych");
  setText("#spotify-note", "Surowe pola katalogowe Spotify. Popularność i obserwujący są przez Spotify oznaczone jako pola deprecated i nie wpływają na model.");
  link.href = spotify.artist.url;
  link.hidden = !spotify.artist.url;
};

const renderEconomics = () => {
  if (!currentAnalysis) return;
  const result = calculateBreakEven({
    fixedCosts: economicsInputs.fixedCosts.value,
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
  }

  const realProfit = result.scenarios.p50.profit;
  const status = document.querySelector("#economics-status");
  status.textContent = realProfit >= 0 ? "P50 powyżej zera" : "P50 poniżej zera";
  status.classList.toggle("is-positive", realProfit >= 0);
  status.classList.toggle("is-negative", realProfit < 0);
  scheduleScenarioUrlUpdate();
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
  const city = document.querySelector("#city").value.trim();

  if (!artist || !city) return;

  const button = form.querySelector("button");
  const originalLabel = button.innerHTML;
  button.disabled = true;
  button.querySelector("span").textContent = "Analizuję...";

  showSkeleton();

  try {
    const analysis = await requestAnalysis(artist, city);
    showAnalysis(analysis);
    const url = new URL(window.location.href);
    url.searchParams.set("artist", artist);
    url.searchParams.set("city", city);
    window.history.replaceState({}, "", url);
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

createAutocomplete({
  input: document.querySelector("#artist"),
  fetchSuggestions: fetchArtistSuggestions,
  onSelect: () => document.querySelector("#city").focus()
});

Object.values(economicsInputs).forEach((input) => {
  input.addEventListener("input", renderEconomics);
});

createAutocomplete({
  input: document.querySelector("#city"),
  fetchSuggestions: fetchCitySuggestions
});

/* ── URL params auto-search ── */

const initialParams = new URLSearchParams(window.location.search);
const initialArtist = initialParams.get("artist");
const initialCity = initialParams.get("city");
const initialEconomics = readEconomicsFromParams(initialParams);

for (const [field, value] of Object.entries(initialEconomics)) {
  economicsInputs[field].value = value;
}

if (initialArtist && initialCity) {
  document.querySelector("#artist").value = initialArtist;
  document.querySelector("#city").value = initialCity;
  form.requestSubmit();
}
