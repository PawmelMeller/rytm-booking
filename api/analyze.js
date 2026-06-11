import { buildAnalysis, normalizeArtist, normalizeCity } from "../lib/analysis-core.js";

const json = (response, status, body) => {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  response.json(body);
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Upstream API returned ${response.status}`);
  }
  return response.json();
};

const findArtist = async (name) => {
  const query = encodeURIComponent(`artist:"${name.replaceAll('"', '\\"')}"`);
  const data = await fetchJson(
    `https://musicbrainz.org/ws/2/artist/?query=${query}&fmt=json&limit=5`,
    { headers: { "User-Agent": "RytmBooking/1.0 (https://github.com/PawmelMeller/rytm-booking)" } }
  );
  return data.artists?.[0] ? normalizeArtist(data.artists[0]) : null;
};

const findCity = async (name) => {
  const data = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=pl&format=json`
  );
  return data.results?.[0] ? normalizeCity(data.results[0]) : null;
};

const findEvents = async (artist, city) => {
  if (!process.env.TICKETMASTER_API_KEY) return { events: [], liveData: false };

  const params = new URLSearchParams({
    apikey: process.env.TICKETMASTER_API_KEY,
    city: city.name,
    countryCode: city.countryCode || "PL",
    classificationName: "music",
    size: "50",
    sort: "date,asc",
    locale: "*"
  });
  const data = await fetchJson(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
  const events = (data._embedded?.events || []).map((event) => ({
    id: event.id,
    name: event.name,
    date: event.dates?.start?.localDate || null,
    venue: event._embedded?.venues?.[0]?.name || null,
    url: event.url || null,
    attractions: (event._embedded?.attractions || []).map((item) => item.name)
  }));

  return { events, liveData: true };
};

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return json(response, 405, { error: "Dozwolona jest tylko metoda GET." });
  }

  const artistName = String(request.query.artist || "").trim();
  const cityName = String(request.query.city || "").trim();

  if (artistName.length < 2 || cityName.length < 2) {
    return json(response, 400, { error: "Podaj artystę i miasto, minimum 2 znaki." });
  }

  try {
    const [artist, city] = await Promise.all([findArtist(artistName), findCity(cityName)]);
    if (!artist) return json(response, 404, { error: "Nie znaleziono artysty w MusicBrainz." });
    if (!city) return json(response, 404, { error: "Nie znaleziono miasta." });

    const { events, liveData } = await findEvents(artist, city);
    return json(response, 200, buildAnalysis({ artist, city, events, liveData }));
  } catch (error) {
    console.error(error);
    return json(response, 502, { error: "Nie udało się pobrać danych zewnętrznych. Spróbuj ponownie." });
  }
}
