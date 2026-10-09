/**
 * ranking feature folder. Unit 15 fills it with the controller's school-leaderboard
 * screen: one ranking per category, the exact decimal total, and the tie-break note
 * where SCR-020's summed submission time decided the order. The screen reads only —
 * the server owns the rank and the total (invariant 8).
 */
export { SchoolRankingPage } from "./SchoolRankingPage";
export {
  fetchSchoolRanking,
  fetchCompetitionCategories,
  SchoolRankingApiError,
} from "./schoolRankingApi";
export type {
  SchoolCategoryRankingView,
  SchoolRankingRowView,
  SchoolRankingCategoryView,
} from "./schoolRankingApi";
