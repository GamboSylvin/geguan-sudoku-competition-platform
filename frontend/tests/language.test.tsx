import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App";
import { LocaleProvider } from "../src/i18n/locale-context";
import {
  LanguageSwitcher,
  readStoredLocale,
} from "../src/i18n/LanguageSwitcher";
import { DEFAULT_LOCALE } from "../src/i18n";

/**
 * BLD-053: the platform was bilingual on paper only. The catalogues existed,
 * `setLocale` existed, but nothing on screen let anyone change language, and the
 * default was English even though the event's audience is in mainland China (U-68).
 *
 * The three behaviors verified here are exactly what was asked for: a fresh mount
 * renders in Chinese, the switcher changes the text on click, and the choice
 * survives a remount.
 */

const STORAGE_KEY = "sudoku-arena.locale";

afterEach(() => {
  window.localStorage.clear();
});

describe("language switching (BLD-053)", () => {
  it("renders Chinese by default on a fresh mount with no stored choice", () => {
    expect(readStoredLocale()).toBeNull();
    expect(DEFAULT_LOCALE).toBe("zh");

    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <LanguageSwitcher />
        </MemoryRouter>
      </LocaleProvider>,
    );

    // The button's own label is in its own language, so it proves nothing by itself:
    // check the active state via `aria-pressed`, which must land on Chinese.
    expect(screen.getByRole("button", { name: "中文" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("switches the rendered text when a language is clicked", () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <LanguageSwitcher />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(screen.getByRole("button", { name: "中文" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("en");
  });

  it("keeps the chosen language across a remount", () => {
    const first = render(
      <LocaleProvider initialLocale={readStoredLocale() ?? undefined}>
        <MemoryRouter initialEntries={["/login"]}>
          <LanguageSwitcher />
        </MemoryRouter>
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    first.unmount();

    // The remount reproduces what `App.tsx` does: the language comes from storage.
    render(
      <LocaleProvider initialLocale={readStoredLocale() ?? undefined}>
        <MemoryRouter initialEntries={["/login"]}>
          <LanguageSwitcher />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(readStoredLocale()).toBe("en");
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("is absent from the player route, where a tablet tap would switch language mid-round", () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={["/player"]}>
          <LanguageSwitcher />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(screen.queryByRole("group", { name: "Language / 语言" })).toBeNull();
  });

  it("is absent from the big screen, which is a shared passive display", () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={["/big-screen/abc123"]}>
          <LanguageSwitcher />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(screen.queryByRole("group", { name: "Language / 语言" })).toBeNull();
  });

  it("is present on a controller route", () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={["/controller"]}>
          <LanguageSwitcher />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(screen.getByRole("group", { name: "Language / 语言" })).toBeInTheDocument();
  });

  it("ignores a stored value that is not a known locale", () => {
    window.localStorage.setItem(STORAGE_KEY, "de");
    expect(readStoredLocale()).toBeNull();
  });

  it("is wired into the app itself, not only exported", () => {
    render(<App />);

    // `/` lands on the redirect to `/login`, a route where the switcher appears.
    expect(screen.getByRole("group", { name: "Language / 语言" })).toBeInTheDocument();
  });
});
