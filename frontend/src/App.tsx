import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "./i18n/locale-context";
import { LoginPage, RoleHomePage } from "./features/auth";
import { CompetitionSetupPage } from "./features/competition";

/**
 * The app entry (Unit 02): the i18n provider, the router, the login page and the
 * per-role placeholder landing routes. Real feature screens are filled in by later
 * units. There is no global competition-selection screen — the competition link
 * identifies the competition (ARCH-030).
 *
 * Unit 03 adds the controller's competition-creation and publish screen.
 */
export function App() {
  return (
    <LocaleProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/player" element={<RoleHomePage role="PLAYER" />} />
          <Route path="/judge" element={<RoleHomePage role="JUDGE" />} />
          <Route path="/controller" element={<RoleHomePage role="CONTROLLER" />} />
          <Route path="/controller/competition/new" element={<CompetitionSetupPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </LocaleProvider>
  );
}
