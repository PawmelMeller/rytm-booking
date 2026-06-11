/**
 * Reusable autocomplete component.
 * Attaches a dropdown to an input field with debounced suggestions,
 * keyboard navigation (↑↓ Enter Esc), and click-away dismissal.
 */

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

/**
 * @param {object} options
 * @param {HTMLInputElement} options.input
 * @param {(query: string) => Promise<Array<{label: string, sub?: string, value: string}>>} options.fetchSuggestions
 * @param {(item: {label: string, sub?: string, value: string}) => void} options.onSelect
 */
export const createAutocomplete = ({ input, fetchSuggestions, onSelect }) => {
  const field = input.closest(".field");
  let dropdown = null;
  let items = [];
  let activeIndex = -1;
  let debounceTimer = null;
  let abortController = null;
  let requestSequence = 0;

  const createDropdown = () => {
    if (dropdown) return dropdown;
    dropdown = document.createElement("div");
    dropdown.className = "autocomplete-dropdown";
    dropdown.setAttribute("role", "listbox");
    field.append(dropdown);
    return dropdown;
  };

  const destroyDropdown = () => {
    if (dropdown) {
      dropdown.remove();
      dropdown = null;
    }
    items = [];
    activeIndex = -1;
  };

  const renderItems = (suggestions) => {
    const dd = createDropdown();
    dd.replaceChildren();
    items = [];
    activeIndex = -1;

    if (suggestions.length === 0) {
      destroyDropdown();
      return;
    }

    suggestions.forEach((suggestion, index) => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      item.setAttribute("role", "option");
      item.textContent = suggestion.label;

      if (suggestion.sub) {
        const sub = document.createElement("small");
        sub.textContent = suggestion.sub;
        item.append(sub);
      }

      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectItem(index);
      });

      dd.append(item);
      items.push(item);
    });
  };

  const setActive = (index) => {
    items.forEach((item) => item.classList.remove("autocomplete-item--active"));
    activeIndex = index;
    if (index >= 0 && index < items.length) {
      items[index].classList.add("autocomplete-item--active");
      items[index].scrollIntoView({ block: "nearest" });
    }
  };

  const selectItem = (index) => {
    const suggestion = currentSuggestions[index];
    if (suggestion) {
      input.value = suggestion.value;
      onSelect?.(suggestion);
      destroyDropdown();
    }
  };

  let currentSuggestions = [];

  const handleInput = () => {
    const query = input.value.trim();

    if (query.length < MIN_CHARS) {
      destroyDropdown();
      return;
    }

    clearTimeout(debounceTimer);
    abortController?.abort();
    const sequence = ++requestSequence;

    debounceTimer = setTimeout(async () => {
      abortController = new AbortController();
      try {
        const suggestions = await fetchSuggestions(query);
        if (abortController.signal.aborted || sequence !== requestSequence) return;
        currentSuggestions = suggestions;
        renderItems(suggestions);
      } catch {
        destroyDropdown();
      }
    }, DEBOUNCE_MS);
  };

  const handleKeydown = (event) => {
    if (!dropdown) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(activeIndex + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectItem(activeIndex);
    } else if (event.key === "Escape") {
      destroyDropdown();
    }
  };

  const handleBlur = () => {
    // Small delay to allow mousedown on items to fire first
    setTimeout(destroyDropdown, 150);
  };

  input.addEventListener("input", handleInput);
  input.addEventListener("keydown", handleKeydown);
  input.addEventListener("blur", handleBlur);

  return { destroy: () => {
    input.removeEventListener("input", handleInput);
    input.removeEventListener("keydown", handleKeydown);
    input.removeEventListener("blur", handleBlur);
    destroyDropdown();
  }};
};

/* ── Suggestion fetchers ── */

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
};

export const fetchArtistSuggestions = async (query) => {
  const artistQuery = encodeURIComponent(`artist:"${query.replaceAll('"', '\\"')}"`);
  const data = await fetchJson(
    `https://musicbrainz.org/ws/2/artist/?query=${artistQuery}&fmt=json&limit=5`
  );
  if (!data?.artists?.length) return [];

  return data.artists.map((artist) => ({
    label: artist.name,
    sub: [artist.type, artist.country, artist.disambiguation].filter(Boolean).join(" · ") || undefined,
    value: artist.name
  }));
};

export const fetchCitySuggestions = async (query) => {
  const data = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=pl&format=json`
  );
  if (!data?.results?.length) return [];

  return data.results.map((city) => ({
    label: city.name,
    sub: [city.admin1, city.country].filter(Boolean).join(", ") +
         (city.population ? ` · ${city.population.toLocaleString("pl-PL")} mieszk.` : ""),
    value: city.name
  }));
};
