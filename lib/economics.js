const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const money = (value) => Math.round(value * 100) / 100;

export const calculateBreakEven = ({
  fixedCosts,
  ticketPrice,
  ticketFeesPercent,
  variableCostPerAttendee,
  ancillaryRevenuePerAttendee,
  attendance
}) => {
  const fixed = Math.max(0, finiteNumber(fixedCosts));
  const price = Math.max(0, finiteNumber(ticketPrice));
  const feesPercent = Math.min(100, Math.max(0, finiteNumber(ticketFeesPercent)));
  const variableCost = Math.max(0, finiteNumber(variableCostPerAttendee));
  const ancillaryRevenue = Math.max(0, finiteNumber(ancillaryRevenuePerAttendee));
  const netTicketRevenue = price * (1 - feesPercent / 100);
  const contributionPerAttendee = netTicketRevenue + ancillaryRevenue - variableCost;

  const breakEvenAttendance = contributionPerAttendee > 0
    ? Math.ceil(fixed / contributionPerAttendee)
    : null;

  const scenario = (headcount) => {
    const people = Math.max(0, Math.round(finiteNumber(headcount)));
    const revenue = people * (netTicketRevenue + ancillaryRevenue);
    const variableCosts = people * variableCost;
    const profit = revenue - variableCosts - fixed;

    return {
      attendance: people,
      revenue: money(revenue),
      variableCosts: money(variableCosts),
      profit: money(profit)
    };
  };

  return {
    inputs: {
      fixedCosts: fixed,
      ticketPrice: price,
      ticketFeesPercent: feesPercent,
      variableCostPerAttendee: variableCost,
      ancillaryRevenuePerAttendee: ancillaryRevenue
    },
    netTicketRevenue: money(netTicketRevenue),
    contributionPerAttendee: money(contributionPerAttendee),
    breakEvenAttendance,
    scenarios: {
      p10: scenario(attendance?.p10),
      p50: scenario(attendance?.p50),
      p90: scenario(attendance?.p90)
    }
  };
};
