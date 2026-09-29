import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "./i18n/locale-context";
import { PlaceholderPage } from "./PlaceholderPage";

/**
 * The app entry (Unit 01): the i18n provider, the router and a single placeholder
 * route. Real routes and feature folders are filled in by later units; the
 * skeleton contains no feature code.
 */
export function App() {
  return (
    <LocaleProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PlaceholderPage />} />
          <Route path="*" element={<PlaceholderPage />} />
        </Routes>
      </BrowserRouter>
    </LocaleProvider>
  );
}
