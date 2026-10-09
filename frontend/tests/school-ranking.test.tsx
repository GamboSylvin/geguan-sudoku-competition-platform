import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "../src/i18n/locale-context";
import { saveSession } from "../src/features/auth/session";
import { SchoolRankingPage } from "../src/features/ranking";

/**
 * Unit 15 frontend: the controller's school-leaderboard screen.
 *
 * What these tests hold the screen to is the half of the spec that lives in the
 * browser: the exact decimal total is rendered **as the string the server sent**
 * (a screen that did `Number(schoolTotal)` would silently reintroduce the float
 * imprecision SCR-013 forbids), one leaderboard per category with two categories
 * never mixed (EVT-002), an incomplete category shown as provisional rather than
 * as an error, the tie-break note appearing only where two totals are genuinely
 * equal, and a rejection surfaced as a localizable message.
 *
 * `fetch` is mocked and routed on method + URL, the Unit 11/12 harness's pattern.
 */

const ROUTE = "/controller/competitions/:id/school-ranking";
const AT = "/controller/competitions/comp-1/school-ranking";

function renderSchoolRankingPage(): ReturnType<typeof render> {
  return renderAt(ROUTE, AT, <SchoolRankingPage />);
}

/** `routePath` may hold params (`:id`); the browser starts at `at` so `useParams` works. */
function renderAt(routePath: string, at: string, element: ReactElement) {
  return render(
    <LocaleProvider initialLocale="en">
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  );
}

/** A controller session, so every request carries the token headers the API expects. */
function seedControllerSession(): void {
  saveSession({
    token: "session-token",
    deviceId: "device-1",
    role: "CONTROLLER",
    accountId: "account-1",
    sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

type MockRoute = { method: string; url: RegExp; status: number; body: unknown };

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

type SentCall = { method: string; url: string };

function mockFetch(routes: MockRoute[]): SentCall[] {
  const calls: SentCall[] = [];
  global.fetch = jest.fn().mockImplementation((input: unknown, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : String((input as { url: string }).url);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ method, url });
    const route = routes.find((c) => c.method === method && c.url.test(url));
    if (!route) {
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }
    return Promise.resolve(jsonResponse(route.status, route.body));
  }) as unknown as typeof fetch;
  return calls;
}

/** The competition read the screen uses to learn which categories to rank. */
const COMPETITION_BODY = {
  id: "comp-1",
  name: "Spring Meet",
  categories: [
    { id: "cat-u8", code: "U8", name: "Under 8", sequence: 1 },
    { id: "cat-u12", code: "U12", name: "Under 12", sequence: 2 },
  ],
};

/**
 * U8's leaderboard. The `schoolTotal` strings are deliberately ones a float could
 * not produce: `3 × 0.6` is `1.7999999999999998` in IEEE-754 but exactly `1.8`.
 */
const U8_RANKING = {
  categoryId: "cat-u8",
  isFinal: true,
  schoolCoefficient: "0.6",
  rows: [
    {
      rank: 1,
      schoolId: "school-a",
      schoolName: "Alpha",
      individualSum: 3,
      teamRound1Score: 0,
      teamRound2Score: 0,
      schoolTotal: "1.8",
      completionTimeSeconds: 90,
      countedPlayers: 2,
      isComplete: true,
    },
    {
      rank: 2,
      schoolId: "school-b",
      schoolName: "Beta",
      individualSum: 2,
      teamRound1Score: 0,
      teamRound2Score: 0,
      schoolTotal: "1.2",
      completionTimeSeconds: 70,
      countedPlayers: 1,
      isComplete: true,
    },
  ],
};

/** U12 is still incomplete: provisional rows, `isFinal: false`, no error. */
const U12_RANKING = {
  categoryId: "cat-u12",
  isFinal: false,
  schoolCoefficient: "0.6",
  rows: [
    {
      rank: 1,
      schoolId: "school-a",
      schoolName: "Alpha",
      individualSum: 10,
      teamRound1Score: 0,
      teamRound2Score: 0,
      schoolTotal: "6",
      completionTimeSeconds: 120,
      countedPlayers: 2,
      isComplete: false,
    },
  ],
};

/** Two U8 schools with an equal total and an equal summed time — a shared rank. */
const TIED_RANKING = {
  categoryId: "cat-u8",
  isFinal: true,
  schoolCoefficient: "0.6",
  rows: [
    { ...U8_RANKING.rows[0], rank: 1 },
    {
      rank: 1,
      schoolId: "school-b",
      schoolName: "Beta",
      individualSum: 3,
      teamRound1Score: 0,
      teamRound2Score: 0,
      schoolTotal: "1.8",
      completionTimeSeconds: 90,
      countedPlayers: 2,
      isComplete: true,
    },
  ],
};

function defaultRoutes(u8: unknown = U8_RANKING, u12: unknown = U12_RANKING): MockRoute[] {
  return [
    { method: "GET", url: /\/api\/competitions\/comp-1$/, status: 200, body: COMPETITION_BODY },
    { method: "GET", url: /cat-u8\/school-ranking$/, status: 200, body: u8 },
    { method: "GET", url: /cat-u12\/school-ranking$/, status: 200, body: u12 },
  ];
}

beforeEach(() => {
  seedControllerSession();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("school leaderboard screen (Unit 15)", () => {
  it("renders the exact decimal total as the string the server sent", async () => {
    mockFetch(defaultRoutes());
    renderSchoolRankingPage();

    // "1.8" and not "1.7999999999999998": the screen must never re-parse it.
    await waitFor(() => expect(screen.getByText("1.8")).toBeInTheDocument());
    expect(screen.getByText("1.2")).toBeInTheDocument();
    expect(screen.queryByText("1.7999999999999998")).not.toBeInTheDocument();
  });

  it("reads one leaderboard per category and never mixes them", async () => {
    const calls = mockFetch(defaultRoutes());
    renderSchoolRankingPage();

    await waitFor(() => expect(screen.getByText("1.8")).toBeInTheDocument());
    // One ranking read per category (EVT-002), each on its own path.
    const rankingCalls = calls.filter((c) => c.url.includes("school-ranking"));
    expect(rankingCalls).toHaveLength(2);
    expect(rankingCalls.some((c) => c.url.includes("cat-u8"))).toBe(true);
    expect(rankingCalls.some((c) => c.url.includes("cat-u12"))).toBe(true);
    // Both categories get their own section.
    expect(screen.getByText("U8 — Under 8")).toBeInTheDocument();
    expect(screen.getByText("U12 — Under 12")).toBeInTheDocument();
  });

  it("shows an incomplete category as provisional, not as an error", async () => {
    mockFetch(defaultRoutes());
    renderSchoolRankingPage();

    await waitFor(() =>
      expect(screen.getByText("Final · School coefficient: 0.6")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("Provisional — some schools are still missing results · School coefficient: 0.6"),
    ).toBeInTheDocument();
    expect(screen.getByText("incomplete")).toBeInTheDocument();
    // No alert is raised for a category that simply is not finished yet.
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("marks a shared rank where the total and the summed time are both equal", async () => {
    // U12 is emptied here so the only rank cells on the page are U8's two.
    mockFetch(defaultRoutes(TIED_RANKING, { ...U12_RANKING, rows: [] }));
    renderSchoolRankingPage();

    await waitFor(() =>
      expect(
        screen.getAllByText("equal total and equal submission time — rank shared"),
      ).toHaveLength(1),
    );
    // Both rows carry rank 1, because the server said so — the screen never re-ranks.
    expect(screen.getAllByText("1")).toHaveLength(2);
  });

  it("surfaces a rejection as a localizable message", async () => {
    mockFetch([
      {
        method: "GET",
        url: /\/api\/competitions\/comp-1$/,
        status: 403,
        body: { error: { code: "competition.forbidden" } },
      },
    ]);
    renderSchoolRankingPage();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Something went wrong. Please try again. (competition.forbidden)",
      ),
    );
  });

  it("re-reads on refresh", async () => {
    const calls = mockFetch(defaultRoutes());
    renderSchoolRankingPage();

    await waitFor(() => expect(screen.getByText("1.8")).toBeInTheDocument());
    const before = calls.filter((c) => c.url.includes("school-ranking")).length;

    fireEvent.click(screen.getByText("Refresh"));
    await waitFor(() =>
      expect(calls.filter((c) => c.url.includes("school-ranking")).length).toBe(before + 2),
    );
  });
});
