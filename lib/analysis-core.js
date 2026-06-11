const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const compact = (values) => values.filter(Boolean);

export const normalizeArtist = (artist) => ({
  id: artist.id,
  name: artist.name,
  type: artist.type || "Artysta",
  country: artist.country || artist.area?.name || null,
  disambiguation: artist.disambiguation || null,
  score: Number(artist.score || 0),
  tags: (artist.tags || [])
    .sort((left, right) => (right.count || 0) - (left.count || 0))
    .slice(0, 4)
    .map((tag) => tag.name)
});

export const normalizeCity = (city) => ({
  id: city.id,
  name: city.name,
  country: city.country || null,
  countryCode: city.country_code?.toUpperCase() || null,
  admin: city.admin1 || null,
  latitude: city.latitude,
  longitude: city.longitude,
  population: Number(city.population || 0),
  timezone: city.timezone || null
});

export const buildAnalysis = ({ artist, city, events = [], liveData = false }) => {
  const populationFactor = city.population
    ? clamp(Math.log10(city.population) / 7, 0.45, 1)
    : 0.58;
  const identityFactor = clamp(artist.score / 100, 0.45, 1);
  const metadataFactor = clamp((artist.tags.length + 2) / 6, 0.4, 1);
  const artistEvents = events.filter((event) =>
    event.attractions?.some((name) => name.toLocaleLowerCase() === artist.name.toLocaleLowerCase())
  );
  const competitorEvents = events.filter((event) => !artistEvents.includes(event));
  const eventFactor = liveData ? clamp(artistEvents.length / 3, 0, 1) : 0.35;

  const score = Math.round(clamp(
    42 + identityFactor * 18 + populationFactor * 16 + metadataFactor * 9 + eventFactor * 8,
    45,
    93
  ));

  const baseAttendance = 280 + populationFactor * 720 + identityFactor * 430 + metadataFactor * 240;
  const p50 = Math.round(baseAttendance / 10) * 10;
  const p10 = Math.round((p50 * 0.62) / 10) * 10;
  const p90 = Math.round((p50 * 1.38) / 10) * 10;
  const venueMin = Math.max(200, Math.round((p50 * 0.85) / 100) * 100);
  const venueMax = Math.max(venueMin + 200, Math.round((p90 * 0.95) / 100) * 100);

  let verdict = "Warto sprawdzić ofertę";
  let verdictCopy = "Artysta i rynek zostały zweryfikowane. Prognoza wymaga jeszcze danych sprzedażowych promotera.";

  if (score >= 78) {
    verdict = "Mocny kandydat do shortlisty";
    verdictCopy = "Dopasowanie artysty i wielkość rynku uzasadniają przejście do kalkulacji kosztów oraz terminu.";
  } else if (score < 65) {
    verdict = "Potrzebna ostrożna kalkulacja";
    verdictCopy = "Sygnały bazowe są ograniczone. Zacznij od mniejszego venue i konserwatywnego kosztorysu.";
  }

  const locationLabel = compact([city.admin, city.country]).join(", ");
  const tagsLabel = artist.tags.length ? artist.tags.join(", ") : "brak tagów gatunkowych";

  return {
    score,
    verdict,
    verdictCopy,
    recommendation: `Rozważ venue na ${venueMin}–${venueMax} osób`,
    attendance: { p10, p50, p90 },
    artist,
    city,
    market: {
      population: city.population || null,
      locationLabel,
      competitionCount: liveData ? competitorEvents.length : null,
      artistEventCount: liveData ? artistEvents.length : null
    },
    coverage: liveData ? "live" : "partial",
    signals: [
      {
        title: `Zweryfikowany artysta: ${artist.name}`,
        copy: compact([artist.type, artist.country, artist.disambiguation]).join(" · ") || "Rekord MusicBrainz"
      },
      {
        title: `Profil muzyczny: ${tagsLabel}`,
        copy: "Gatunki pochodzą z otwartej bazy MusicBrainz."
      },
      {
        title: `Rynek: ${city.name}`,
        copy: city.population
          ? `${locationLabel}. Populacja miasta: ${city.population.toLocaleString("pl-PL")}.`
          : `${locationLabel}. Lokalizacja została zweryfikowana geograficznie.`
      }
    ],
    sources: compact([
      { name: "MusicBrainz", kind: "artist" },
      { name: "Open-Meteo Geocoding", kind: "city" },
      liveData ? { name: "Ticketmaster Discovery", kind: "events" } : null
    ])
  };
};
