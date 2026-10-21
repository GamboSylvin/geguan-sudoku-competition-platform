import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "../src/i18n/locale-context";
import { EnterPage, LoginPage, RoleHomePage } from "../src/features/auth";
import { peekEntryToken, peekEntryRoleHint } from "../src/features/auth/session";

/**
 * Hole D (2026-10-20): the ONE entry link, `/enter?token=…`, used by a student and by a
 * judge alike. It is not a screen — it remembers the token and hands over to the login
 * page, which asks the server what the link points at so it can say which event is being
 * entered. `fetch` is mocked; no server is contacted.
 *
 * The role gate is what forced a route of its own: `/player` bounces anyone whose session
 * is not PLAYER *before* the token could have any effect, so a judge opening that path
 * would silently lose the competition the link named.
 */
const COMPETITION_NAME = "杭州数独邀请赛";

function renderAt(path: string) {
  return render(
    <LocaleProvider initialLocale="en">
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/enter" element={<EnterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/player" element={<RoleHomePage role="PLAYER" />} />
          <Route path="/judge" element={<RoleHomePage role="JUDGE" />} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  );
}

/** A mock answering only the public name lookup; anything else 404s. */
function mockNameLookup() {
  return jest.fn(async (url: string) => {
    if (url.endsWith(`/api/auth/entry-link/${encodeURIComponent("tok-1")}`)) {
      return { ok: true, status: 200, json: async () => ({ competitionName: COMPETITION_NAME }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  jest.restoreAllMocks();
});

describe("the unified entry link (hole D)", () => {
  it("remembers the token, sets no role hint, and hands over to login", async () => {
    global.fetch = mockNameLookup() as unknown as typeof fetch;
    renderAt("/enter?token=tok-1");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Player" })).toBeInTheDocument();
    });

    expect(peekEntryToken()).toBe("tok-1");
    // No hint on purpose: one address serves both roles, so the picker shows the choice.
    expect(peekEntryRoleHint()).toBeNull();
  });

  it("names the competition above the role picker", async () => {
    global.fetch = mockNameLookup() as unknown as typeof fetch;
    renderAt("/enter?token=tok-1");

    await waitFor(() => {
      expect(screen.getByText(`Welcome to ${COMPETITION_NAME}`)).toBeInTheDocument();
    });
  });

  it("renders the ordinary login when the token names no competition", async () => {
    global.fetch = mockNameLookup() as unknown as typeof fetch;
    renderAt("/enter?token=not-a-real-token");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Player" })).toBeInTheDocument();
    });
    expect(screen.queryByText(/Welcome to/)).not.toBeInTheDocument();
  });

  it("sends the token with a JUDGE login, not only a player one", async () => {
    const calls: { url: string; body: string }[] = [];
    global.fetch = (async (url: string, init?: { body?: string }) => {
      const asText = String(url);
      if (asText.includes("/api/auth/entry-link/")) {
        return { ok: true, status: 200, json: async () => ({ competitionName: COMPETITION_NAME }) };
      }
      calls.push({ url: asText, body: init?.body ?? "" });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          token: "tok",
          deviceId: "dev",
          role: "JUDGE",
          accountId: "acc-1",
          sessionExpiresAt: new Date().toISOString(),
        }),
      };
    }) as unknown as typeof fetch;

    renderAt("/enter?token=tok-1");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Judge" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Judge" }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "judge-1" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Judge home" })).toBeInTheDocument();
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain("/api/auth/judge/login");
    expect(JSON.parse(calls[0]!.body)).toEqual({
      username: "judge-1",
      password: "secret",
      entryLinkToken: "tok-1",
    });
  });

  it("consumes the token on the login that succeeds, not before", async () => {
    global.fetch = (async (url: string) => {
      const asText = String(url);
      if (asText.includes("/api/auth/entry-link/")) {
        return { ok: true, status: 200, json: async () => ({ competitionName: COMPETITION_NAME }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          token: "tok",
          deviceId: "dev",
          role: "PLAYER",
          accountId: "acc-1",
          sessionExpiresAt: new Date().toISOString(),
        }),
      };
    }) as unknown as typeof fetch;

    renderAt("/enter?token=tok-1");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Player" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Player" }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "player-1" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Player home" })).toBeInTheDocument();
    });
    expect(peekEntryToken()).toBeNull();
  });

  it("skips login entirely for an already-open session, landing on that role's home", async () => {
    global.fetch = mockNameLookup() as unknown as typeof fetch;
    window.localStorage.setItem(
      "sudoku.session",
      JSON.stringify({
        token: "tok",
        deviceId: "dev",
        role: "JUDGE",
        accountId: "acc-1",
        sessionExpiresAt: new Date().toISOString(),
      }),
    );

    renderAt("/enter?token=tok-1");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Judge home" })).toBeInTheDocument();
    });
    // Discarded, not kept: nothing will verify it, and a later unrelated login must not
    // be scoped by a stale competition.
    expect(peekEntryToken()).toBeNull();
  });
});
