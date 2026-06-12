const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const money = (value) => Math.round(value * 100) / 100;

export const calculateFinancialProjection = ({
  fixedCosts,
  venueCost,
  artistFee,
  ticketPrice,
  ticketFeesPercent,
  variableCostPerAttendee,
  ancillaryRevenuePerAttendee,
  attendance
}) => {
  const fixed = Math.max(0, finiteNumber(fixedCosts));
  const venue = Math.max(0, finiteNumber(venueCost));
  const artist = Math.max(0, finiteNumber(artistFee));
  const price = Math.max(0, finiteNumber(ticketPrice));
  const feesPercent = Math.min(100, Math.max(0, finiteNumber(ticketFeesPercent)));
  const variableCost = Math.max(0, finiteNumber(variableCostPerAttendee));
  const ancillaryRevenue = Math.max(0, finiteNumber(ancillaryRevenuePerAttendee));

  const totalFixedCosts = fixed + venue + artist;
  const netTicketRevenue = price * (1 - feesPercent / 100);
  const contributionPerAttendee = netTicketRevenue + ancillaryRevenue - variableCost;

  const breakEvenAttendance = contributionPerAttendee > 0
    ? Math.ceil(totalFixedCosts / contributionPerAttendee)
    : null;

  const getScenarioDetails = (headcount) => {
    const people = Math.max(0, Math.round(finiteNumber(headcount)));
    const ticketRevenue = people * netTicketRevenue;
    const ancillaryRev = people * ancillaryRevenue;
    const totalRevenue = ticketRevenue + ancillaryRev;
    const variableCosts = people * variableCost;
    const totalCosts = totalFixedCosts + variableCosts;
    const profit = totalRevenue - totalCosts;
    const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;

    return {
      attendance: people,
      ticketRevenue: money(ticketRevenue),
      ancillaryRevenue: money(ancillaryRev),
      totalRevenue: money(totalRevenue),
      fixedCosts: money(totalFixedCosts),
      variableCosts: money(variableCosts),
      totalCosts: money(totalCosts),
      profit: money(profit),
      roi: money(roi)
    };
  };

  return {
    inputs: {
      fixedCosts: fixed,
      venueCost: venue,
      artistFee: artist,
      ticketPrice: price,
      ticketFeesPercent: feesPercent,
      variableCostPerAttendee: variableCost,
      ancillaryRevenuePerAttendee: ancillaryRevenue
    },
    totalFixedCosts,
    netTicketRevenue: money(netTicketRevenue),
    contributionPerAttendee: money(contributionPerAttendee),
    breakEvenAttendance,
    scenarios: {
      p10: getScenarioDetails(attendance?.p10),
      p50: getScenarioDetails(attendance?.p50),
      p90: getScenarioDetails(attendance?.p90)
    }
  };
};
