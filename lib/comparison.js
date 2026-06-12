import { calculateFinancialProjection } from "./financial.js";

export const compareAnalyses = (analyses) => {
  if (!Array.isArray(analyses) || analyses.length === 0) return [];

  return [...analyses].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    // Secondary sort: projected attendance
    const leftP50 = left.attendance?.p50 || 0;
    const rightP50 = right.attendance?.p50 || 0;
    if (rightP50 !== leftP50) {
      return rightP50 - leftP50;
    }
    // Tertiary sort: population
    return (right.city?.population || 0) - (left.city?.population || 0);
  });
};

export const buildFinancialRanking = (analyses, economics) => {
  if (!Array.isArray(analyses) || analyses.length === 0) return [];

  return analyses
    .map((analysis) => ({
      analysis,
      financials: calculateFinancialProjection({
        ...economics,
        attendance: analysis.attendance
      })
    }))
    .sort((left, right) => {
      const profitDifference =
        right.financials.scenarios.p50.profit - left.financials.scenarios.p50.profit;
      if (profitDifference !== 0) return profitDifference;

      const roiDifference =
        right.financials.scenarios.p50.roi - left.financials.scenarios.p50.roi;
      if (roiDifference !== 0) return roiDifference;

      const scoreDifference = right.analysis.score - left.analysis.score;
      if (scoreDifference !== 0) return scoreDifference;

      const attendanceDifference =
        (right.analysis.attendance?.p50 || 0) - (left.analysis.attendance?.p50 || 0);
      if (attendanceDifference !== 0) return attendanceDifference;

      return left.analysis.city.name.localeCompare(right.analysis.city.name, "pl");
    });
};

export const createRankingCsv = (ranking) => {
  const headers = [
    "Pozycja",
    "Artysta",
    "Miasto",
    "Score",
    "Prognoza P50",
    "Break-even",
    "Zysk P50 PLN",
    "ROI P50 %",
    "Rekomendowane venue",
    "Werdykt"
  ];
  const rows = ranking.map(({ analysis, financials }, index) => [
    index + 1,
    analysis.artist.name,
    analysis.city.name,
    analysis.score,
    analysis.attendance.p50,
    financials.breakEvenAttendance ?? "",
    financials.scenarios.p50.profit,
    financials.scenarios.p50.roi,
    analysis.recommendation.replace("Rozważ venue na ", ""),
    analysis.verdict
  ]);

  return [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"))
    .join("\r\n");
};
