const form = document.querySelector("#search-form");
const results = document.querySelector("#results");
const searchSection = document.querySelector("#search-section");
const newSearchButton = document.querySelector("#new-search");

const polishCityForm = (city) => {
  const forms = {
    "gdańsk": "Gdańsku",
    "gdansk": "Gdańsku",
    "warszawa": "Warszawie",
    "kraków": "Krakowie",
    "krakow": "Krakowie",
    "wrocław": "Wrocławiu",
    "wroclaw": "Wrocławiu",
    "poznań": "Poznaniu",
    "poznan": "Poznaniu",
    "łódź": "Łodzi",
    "lodz": "Łodzi",
    "katowice": "Katowicach",
    "sopot": "Sopocie",
    "gdynia": "Gdyni"
  };

  return forms[city.toLocaleLowerCase("pl")] || city;
};

const createSeed = (artist, city) => {
  const text = `${artist}:${city}`.toLocaleLowerCase("pl");
  return [...text].reduce((total, character) => total + character.charCodeAt(0), 0);
};

const formatNumber = (number) => new Intl.NumberFormat("pl-PL").format(number);

const buildAnalysis = (artist, city) => {
  const seed = createSeed(artist, city);
  const score = 61 + (seed % 30);
  const p50 = 650 + (seed % 13) * 85;
  const p10 = Math.round(p50 * 0.66 / 10) * 10;
  const p90 = Math.round(p50 * 1.29 / 10) * 10;
  const audience = (p50 * (15 + (seed % 7))) / 1000;
  const competitionCount = 1 + (seed % 5);
  const growth = 7 + (seed % 19);
  const competition = competitionCount <= 2 ? "Niska" : competitionCount <= 4 ? "Średnia" : "Wysoka";
  const demand = score >= 79 ? "Wysoki" : score >= 68 ? "Dobry" : "Umiarkowany";
  const venueMin = Math.round((p50 * 0.9) / 100) * 100;
  const venueMax = Math.round((p90 * 0.95) / 100) * 100;

  let verdict = "Obiecujący kierunek";
  let verdictCopy = "Rynek wygląda dobrze, ale warto ostrożnie dobrać pojemność venue i termin.";

  if (score >= 80) {
    verdict = "Mocny kandydat";
    verdictCopy = "Lokalny popyt i dynamika artysty wskazują na dobry potencjał wydarzenia.";
  } else if (score < 69) {
    verdict = "Wymaga ostrożności";
    verdictCopy = "Zainteresowanie istnieje, ale rynek może potrzebować mocniejszego wsparcia promocyjnego.";
  }

  return {
    score,
    p10,
    p50,
    p90,
    audience,
    growth,
    competition,
    competitionCount,
    demand,
    venueMin,
    venueMax,
    verdict,
    verdictCopy,
    signals: [
      {
        title: `Wzrost zainteresowania +${growth}%`,
        copy: `Wyszukiwania i aktywność wokół artysty rosną w regionie ${city}.`
      },
      {
        title: competitionCount <= 2 ? "Dobre okno w kalendarzu" : "Konkurencyjny kalendarz",
        copy: `${competitionCount} podobne wydarzenia w analizowanym otoczeniu rynku.`
      },
      {
        title: "Dopasowanie publiczności",
        copy: `Profil słuchaczy artysty pokrywa się z aktywną publicznością koncertową miasta.`
      }
    ]
  };
};

const setText = (selector, value) => {
  document.querySelector(selector).textContent = value;
};

const showAnalysis = (artist, city) => {
  const analysis = buildAnalysis(artist, city);

  setText("#result-artist", artist);
  setText("#result-city", polishCityForm(city));
  setText("#score", analysis.score);
  setText("#verdict", analysis.verdict);
  setText("#verdict-copy", analysis.verdictCopy);
  setText("#recommendation", `Rozważ venue na ${formatNumber(analysis.venueMin)}–${formatNumber(analysis.venueMax)} osób`);
  setText("#demand-value", analysis.demand);
  setText("#demand-change", `+${analysis.growth}% w 90 dni`);
  setText("#audience-value", `${analysis.audience.toFixed(1).replace(".", ",")} tys.`);
  setText("#competition-value", analysis.competition);
  setText("#competition-copy", `${analysis.competitionCount} podobne wydarzenia`);
  setText("#tickets-value", formatNumber(analysis.p50));
  setText("#p10", formatNumber(analysis.p10));
  setText("#p50", formatNumber(analysis.p50));
  setText("#p90", formatNumber(analysis.p90));

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

  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const artist = document.querySelector("#artist").value.trim();
  const city = document.querySelector("#city").value.trim();

  if (!artist || !city) return;

  const button = form.querySelector("button");
  const originalLabel = button.innerHTML;
  button.disabled = true;
  button.querySelector("span").textContent = "Analizuję...";

  window.setTimeout(() => {
    showAnalysis(artist, city);
    button.disabled = false;
    button.innerHTML = originalLabel;
  }, 450);
});

newSearchButton.addEventListener("click", () => {
  searchSection.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => document.querySelector("#artist").focus(), 500);
});
