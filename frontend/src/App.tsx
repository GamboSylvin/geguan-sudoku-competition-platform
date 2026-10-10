import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "./i18n/locale-context";
import { LoginPage } from "./features/auth";
import { BigScreenPage } from "./features/big-screen";
import { CompetitionSetupPage } from "./features/competition";
import { ControllerLivePage, ControllerPickerPage } from "./features/controller";
import { JudgeDashboardPage, JudgeLandingPage, JudgeManagementPage } from "./features/judge";
import { PlayerPage } from "./features/player";
import { SchoolRankingPage } from "./features/ranking";
import { ResultsPage } from "./features/results";

/**
 * The app entry (Unit 02): the i18n provider, the router, the login page and the
 * per-role placeholder landing routes. Real feature screens are filled in by later
 * units. There is no global competition-selection screen — the competition link
 * identifies the competition (ARCH-030). The controller's own picker is not that
 * screen: it is the entry to the live dashboard, which one operator drives.
 *
 * Unit 03 adds the controller's competition-creation and publish screen.
 * Unit 06 adds the controller's judge-management screen, the judge range assignment
 * panel (on the setup screen) and the judge's own assignment landing.
 * Unit 07 replaces the player's placeholder landing with the round-runtime page
 * (competition room, preparation, active round, paused/resuming).
 * Unit 10 adds the judge's supervision dashboard at /judge/dashboard.
 * Unit 11 replaces the controller's placeholder landing with the competition picker
 * and adds the live-command dashboard at /controller/competitions/:id/live.
 * Unit 12 adds the controller's results screen at /controller/competitions/:id/results.
 * Unit 15 adds the school leaderboard at /controller/competitions/:id/school-ranking
 * and a setup route for an existing competition at /controller/competitions/:id/setup
 * (where a copied competition lands, since it has to be published again).
 */
export function App() {
  return (
    <LocaleProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="/judge" element={<JudgeLandingPage />} />
          <Route path="/judge/dashboard" element={<JudgeDashboardPage />} />
          <Route path="/controller" element={<ControllerPickerPage />} />
          <Route path="/controller/competitions" element={<ControllerPickerPage />} />
          <Route
            path="/controller/competitions/:id/live"
            element={<ControllerLivePage />}
          />
          <Route
            path="/controller/competitions/:id/results"
            element={<ResultsPage />}
          />
          <Route path="/controller/competition/new" element={<CompetitionSetupPage />} />
          <Route
            path="/controller/competitions/:id/setup"
            element={<CompetitionSetupPage />}
          />
          <Route
            path="/controller/competitions/:id/school-ranking"
            element={<SchoolRankingPage />}
          />
          <Route path="/controller/judges" element={<JudgeManagementPage />} />
          <Route path="/big-screen/:token" element={<BigScreenPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </LocaleProvider>
  );
}
