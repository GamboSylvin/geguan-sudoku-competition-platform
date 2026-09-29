import { render, screen } from "@testing-library/react";
import { PlaceholderPage } from "../src/PlaceholderPage";
import { LocaleProvider } from "../src/i18n/locale-context";

/**
 * The first passing Jest test for the frontend (Unit 01, acceptance criterion 6).
 * It renders the placeholder page through the i18n scaffold and checks the
 * English copy resolves — proving React, the translation mechanism and the test
 * tooling are wired together.
 */
describe("placeholder page", () => {
  it("renders the translated title", () => {
    render(
      <LocaleProvider initialLocale="en">
        <PlaceholderPage />
      </LocaleProvider>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Sudoku Arena",
    );
  });
});
