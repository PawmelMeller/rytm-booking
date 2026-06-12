export const ECONOMICS_QUERY_PARAMS = {
  fixedCosts: "fc",
  ticketPrice: "tp",
  ticketFeesPercent: "tf",
  variableCostPerAttendee: "vc",
  ancillaryRevenuePerAttendee: "ar"
};

const finiteParam = (value) => {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

export const readEconomicsFromParams = (searchParams) => {
  const values = {};

  for (const [field, param] of Object.entries(ECONOMICS_QUERY_PARAMS)) {
    const value = finiteParam(searchParams.get(param));
    if (value !== null) values[field] = value;
  }

  return values;
};

export const writeEconomicsToParams = (searchParams, values) => {
  for (const [field, param] of Object.entries(ECONOMICS_QUERY_PARAMS)) {
    const value = finiteParam(values[field]);
    if (value === null) {
      searchParams.delete(param);
    } else {
      searchParams.set(param, String(value));
    }
  }

  return searchParams;
};
