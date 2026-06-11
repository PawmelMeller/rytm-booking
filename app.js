import {
  buildAnalysis,
  normalizeArtist,
  normalizeArtistHistory,
  normalizeCity
} from "./lib/analysis-core.js";
import { toLocative } from "./lib/polish-cities.js";
import { createAutocomplete, fetchArtistSuggestions, fetchCitySuggestions } from "./lib/autocomplete.js";

const form = document.querySelector("#search-form");
const results = document.querySelector("#results");
const searchSection = document.querySelector("#search-section");
const skeleton = document.querySelector("#skeleton");
const newSearchButton = document.querySelector("#new-search");
const toastContainer = document.querySelector("#toast-container");

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

const showAnalysis = (analysis) => {
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

createAutocomplete({
  input: document.querySelector("#artist"),
  fetchSuggestions: fetchArtistSuggestions,
  onSelect: () => document.querySelector("#city").focus()
});

createAutocomplete({
  input: document.querySelector("#city"),
  fetchSuggestions: fetchCitySuggestions
});

/* ── URL params auto-search ── */

const initialParams = new URLSearchParams(window.location.search);
const initialArtist = initialParams.get("artist");
const initialCity = initialParams.get("city");

if (initialArtist && initialCity) {
  document.querySelector("#artist").value = initialArtist;
  document.querySelector("#city").value = initialCity;
  form.requestSubmit();
}
