/**
 * Polish city name → locative case (miejscownik).
 * Used in UI headings like "Fred again.. w Gdańsku".
 */
const LOCATIVE = {
  "białystok": "Białymstoku",
  "bielsko-biała": "Bielsku-Białej",
  "bydgoszcz": "Bydgoszczy",
  "bytom": "Bytomiu",
  "chorzów": "Chorzowie",
  "częstochowa": "Częstochowie",
  "dąbrowa górnicza": "Dąbrowie Górniczej",
  "elbląg": "Elblągu",
  "gdańsk": "Gdańsku",
  "gdynia": "Gdyni",
  "gliwice": "Gliwicach",
  "gorzów wielkopolski": "Gorzowie Wielkopolskim",
  "grudziądz": "Grudziądzu",
  "jastrzębie-zdrój": "Jastrzębiu-Zdroju",
  "jelenia góra": "Jeleniej Górze",
  "kalisz": "Kaliszu",
  "katowice": "Katowicach",
  "kielce": "Kielcach",
  "koszalin": "Koszalinie",
  "kraków": "Krakowie",
  "krakow": "Krakowie",
  "legnica": "Legnicy",
  "lublin": "Lublinie",
  "łódź": "Łodzi",
  "lodz": "Łodzi",
  "nowy sącz": "Nowym Sączu",
  "olsztyn": "Olsztynie",
  "opole": "Opolu",
  "ostrów wielkopolski": "Ostrowie Wielkopolskim",
  "płock": "Płocku",
  "poznań": "Poznaniu",
  "poznan": "Poznaniu",
  "radom": "Radomiu",
  "ruda śląska": "Rudzie Śląskiej",
  "rybnik": "Rybniku",
  "rzeszów": "Rzeszowie",
  "słupsk": "Słupsku",
  "sosnowiec": "Sosnowcu",
  "sopot": "Sopocie",
  "szczecin": "Szczecinie",
  "tarnów": "Tarnowie",
  "toruń": "Toruniu",
  "tychy": "Tychach",
  "wałbrzych": "Wałbrzychu",
  "warszawa": "Warszawie",
  "włocławek": "Włocławku",
  "wrocław": "Wrocławiu",
  "wroclaw": "Wrocławiu",
  "zabrze": "Zabrzu",
  "zielona góra": "Zielonej Górze",
  "żory": "Żorach"
};

/**
 * Heuristic fallback for cities not in the dictionary.
 * Applies common Polish locative endings.
 */
const heuristicLocative = (name) => {
  const lower = name.toLocaleLowerCase("pl");

  // Feminine -a → -ie  (Warszawa → Warszawie already in dict, but covers unknowns)
  if (lower.endsWith("a") && !lower.endsWith("ia")) {
    return name.slice(0, -1) + "ie";
  }
  // Feminine -ia → -ii
  if (lower.endsWith("ia")) {
    return name.slice(0, -1) + "i";
  }
  // Neuter -e → -u  (Opole → Opolu)
  if (lower.endsWith("e")) {
    return name.slice(0, -1) + "u";
  }
  // Plural -ce/-le → -cach/-lach  (Katowice → Katowicach, Kielce → Kielcach)
  if (lower.endsWith("ce")) {
    return name.slice(0, -1) + "ach";
  }
  // Plural -y → -ach  (Tychy → Tychach)
  if (lower.endsWith("y")) {
    return name.slice(0, -1) + "ach";
  }
  // Masculine consonant → +ie  (Lublin → Lublinie — not perfect but decent fallback)
  const lastChar = lower.slice(-1);
  if (!"aeiouyąęó".includes(lastChar)) {
    return name + "ie";
  }

  return name;
};

/**
 * Convert a Polish city name to its locative case form.
 * Falls back to heuristic rules, then to the original name for non-Polish cities.
 * @param {string} cityName
 * @returns {string}
 */
export const toLocative = (cityName) => {
  if (!cityName) return cityName;
  const key = cityName.toLocaleLowerCase("pl");
  return LOCATIVE[key] || heuristicLocative(cityName);
};
