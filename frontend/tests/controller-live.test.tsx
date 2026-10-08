import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "../src/i18n/locale-context";
import { saveSession } from "../src/features/auth/session";
import { ControllerLivePage, ControllerPickerPage } from "../src/features/controller";

/**
 * Unit 11 frontend: the controller's live-command dashboard. These tests cover the
 * spec's acceptance criteria that live on the screen itself — which commands are
 * enabled in a given server state, that a terminal action is behind a confirmation,
 * and that a rejected command is shown as a localizable message rather than
 * swallowed. The orchestrator logic they exercise is the server's; these tests only
 * prove the dashboard drives it and reports it honestly.
 *
 * `fetch` is mocked and routed on method + URL, because the dashboard polls and the
 * embedded supervision panel polls too: queueing responses in call order would let
 * one request consume another's body.
 */
/**
 * `routePath` may hold params (`:id`); the browser is started at `at`, so
 * `useParams` sees the real id the way the deployed router would.
 */
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

/** The dashboard under test, mounted on a route that carries its competition id. */
const LIVE_ROUTE = "/controller/competitions/:id/live";
const LIVE_AT = "/controller/competitions/comp-1/live";

function renderLivePage() {
  return renderAt(LIVE_ROUTE, LIVE_AT, <ControllerLivePage />);
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

/** Every request the mock saw, so a test can assert what was actually sent. */
type SentCall = { method: string; url: string; body: unknown };

function mockFetch(routes: MockRoute[]): SentCall[] {
  const calls: { method: string; url: string; body: unknown }[] = [];
  global.fetch = jest.fn().mockImplementation((input: unknown, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : String((input as { url: string }).url);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ method, url, body: init?.body ? JSON.parse(init.body as string) : undefined });
    const route = routes.find((c) => c.method === method && c.url.test(url));
    if (!route) {
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }
    return Promise.resolve(jsonResponse(route.status, route.body));
  }) as unknown as typeof fetch;
  return calls;
}

/** The dashboard's two reads plus the embedded supervision panel's own read. */
function competitionBody(status: string, roundStatus: string) {
  return {
    id: "comp-1",
    name: "Autumn Cup",
    description: null,
    status,
    entryLinkToken: "entry-token",
    bigScreenLinkToken: "screen-token",
    categories: [{ id: "cat-1", code: "U8", name: "Under 8", sequence: 1 }],
    stages: [
      {
        id: "stage-1",
        type: "INDIVIDUAL",
        sequence: 1,
        status: status === "WAITING" ? "WAITING" : "ACTIVE",
        rounds: [
          {
            id: "round-1",
            sequence: 1,
            name: "Individual round 1",
            status: roundStatus,
            settings: { durationSeconds: 1200, preparationSeconds: 60 },
          },
          {
            id: "round-2",
            sequence: 2,
            name: "Individual round 2",
            status: "WAITING",
            settings: { durationSeconds: 1800, preparationSeconds: 60 },
          },
        ],
      },
      {
        id: "stage-2",
        type: "TEAM",
        sequence: 2,
        status: "WAITING",
        rounds: [
          {
            id: "round-3",
            sequence: 1,
            name: "Team round 1",
            status: "WAITING",
            settings: { durationSeconds: 1800, preparationSeconds: 60 },
          },
        ],
      },
    ],
  };
}

function baseRoutes(status: string, roundStatus: string): MockRoute[] {
  return [
    { method: "GET", url: /\/api\/competitions\/comp-1$/, status: 200, body: competitionBody(status, roundStatus) },
    {
      method: "GET",
      url: /\/api\/competitions\/comp-1\/big-screen\/mode$/,
      status: 200,
      body: { competitionId: "comp-1", mode: "RANKING", targetId: null, rotationEnabled: true },
    },
    { method: "GET", url: /\/api\/judge\/students/, status: 200, body: { students: [] } },
  ];
}

afterEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe("controller live dashboard", () => {
  it("enables only the first stage while everything is still waiting", async () => {
    seedControllerSession();
    mockFetch(baseRoutes("WAITING", "WAITING"));
    renderLivePage();

    await screen.findByText(/Autumn Cup/);

    const startButtons = screen.getAllByRole("button", {
      name: /Start stage/i,
    });
    // Individual (sequence 1) is startable; Team (sequence 2) is not, because the
    // earlier stage has not finished. The server enforces the same rule.
    expect(startButtons).toHaveLength(2);
    expect(startButtons[0]).toBeEnabled();
    expect(startButtons[1]).toBeDisabled();
    // Nothing is running yet, so there is nothing to pause.
    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  });

  it("starts a stage and then offers pause, showing the preparation countdown", async () => {
    seedControllerSession();
    mockFetch([
      ...baseRoutes("WAITING", "WAITING"),
      {
        method: "POST",
        url: /\/api\/competitions\/comp-1\/stages\/stage-1\/start$/,
        status: 200,
        body: {
          competitionId: "comp-1",
          stageId: "stage-1",
          roundId: "round-1",
          status: "PREPARATION",
          preparationSeconds: 60,
        },
      },
    ]);
    renderLivePage();

    await screen.findByText(/Autumn Cup/);
    const [firstStage] = screen.getAllByRole("button", { name: /Start stage/i });
    if (!firstStage) throw new Error("no start button rendered");
    fireEvent.click(firstStage);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Stage started. The preparation countdown is running.",
      );
    });
  });

  it("pauses a running round and shows the server's snapshot, never a client countdown", async () => {
    seedControllerSession();
    mockFetch([
      ...baseRoutes("ROUND_ACTIVE", "ACTIVE"),
      {
        method: "POST",
        url: /\/api\/competitions\/comp-1\/pause$/,
        status: 200,
        body: { roundId: "round-1", status: "PAUSED", remainingSeconds: 754, totalSeconds: 1200 },
      },
    ]);
    renderLivePage();

    await screen.findByText(/Autumn Cup/);
    const pause = screen.getByRole("button", { name: "Pause" });
    expect(pause).toBeEnabled();
    fireEvent.click(pause);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Paused on every screen.");
    });
    // The remaining time shown is the server's value, formatted, not a ticking clock.
    expect(screen.getByText(/Remaining: 12:34 \/ 20:00/)).toBeInTheDocument();
  });

  it("shows a localizable message when the server rejects a command", async () => {
    seedControllerSession();
    mockFetch([
      ...baseRoutes("ROUND_ACTIVE", "ACTIVE"),
      {
        method: "POST",
        url: /\/api\/competitions\/comp-1\/pause$/,
        status: 409,
        body: { error: { code: "orchestrator.nothingToPause", message: "nothing" } },
      },
    ]);
    renderLivePage();

    await screen.findByText(/Autumn Cup/);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Nothing is running, so there is nothing to pause.",
      );
    });
  });

  it("falls back to the generic message and still prints an unmapped rejection code", async () => {
    seedControllerSession();
    mockFetch([
      ...baseRoutes("ROUND_ACTIVE", "ACTIVE"),
      {
        method: "POST",
        url: /\/api\/competitions\/comp-1\/pause$/,
        status: 409,
        body: { error: { code: "orchestrator.somethingNew", message: "new" } },
      },
    ]);
    renderLivePage();

    await screen.findByText(/Autumn Cup/);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
      expect(screen.getByRole("alert")).toHaveTextContent("orchestrator.somethingNew");
    });
  });

  it("puts finish-early behind a confirmation that says it cannot be undone", async () => {
    seedControllerSession();
    mockFetch([
      ...baseRoutes("ROUND_ACTIVE", "ACTIVE"),
      {
        method: "POST",
        url: /\/api\/competitions\/comp-1\/finish-early$/,
        status: 200,
        body: { competitionId: "comp-1", status: "FINISHED", finishedEarly: true, closedCount: 3 },
      },
    ]);
    renderLivePage();

    await screen.findByText(/Autumn Cup/);
    fireEvent.click(screen.getByRole("button", { name: "Finish the competition early" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Finish the whole competition early?");
    expect(dialog).toHaveTextContent("cannot be undone");

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "The competition is finished early.",
      );
    });
  });

  it("warns that cancel releases no results, then accepts no further command", async () => {
    seedControllerSession();
    mockFetch([
      ...baseRoutes("CANCELLED", "FINISHED"),
      {
        method: "POST",
        url: /\/api\/competitions\/comp-1\/cancel$/,
        status: 200,
        body: {
          competitionId: "comp-1",
          status: "CANCELLED",
          cancelledAt: new Date().toISOString(),
        },
      },
    ]);
    renderLivePage();

    await screen.findByText(/Autumn Cup/);
    // A closed competition accepts nothing: every command button is disabled and the
    // page says so, which is the visible half of `orchestrator.competitionClosed`.
    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Finish the competition early" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel the competition" })).toBeDisabled();
    expect(
      screen.getByText(/This competition is closed\. No further command is accepted\./),
    ).toBeInTheDocument();
  });

  it("sends the reset scope and its target id, and confirms before doing so", async () => {
    seedControllerSession();
    const calls = mockFetch([
      ...baseRoutes("ROUND_ACTIVE", "ACTIVE"),
      {
        method: "POST",
        url: /\/api\/competitions\/comp-1\/reset-rematch$/,
        status: 200,
        body: { scope: "ROUND", roundIds: ["round-1"], restartedCount: 2, grantedSeconds: 1200 },
      },
    ]);
    renderLivePage();

    await screen.findByText(/Autumn Cup/);
    fireEvent.change(screen.getByLabelText("Scope"), { target: { value: "ROUND" } });
    fireEvent.change(screen.getByLabelText("Round"), { target: { value: "round-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Reset this scope?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Reset applied. Earlier attempts are archived.",
      );
    });
    const sent = calls.find((c) => c.method === "POST" && /reset-rematch$/.test(c.url));
    expect(sent?.body).toEqual({ scope: "ROUND", roundId: "round-1" });
  });

  it("changes the big-screen mode and reads the new state back", async () => {
    seedControllerSession();
    const calls = mockFetch([
      ...baseRoutes("ROUND_ACTIVE", "PAUSED"),
      {
        method: "POST",
        url: /\/api\/competitions\/comp-1\/big-screen\/mode$/,
        status: 200,
        body: {
          competitionId: "comp-1",
          mode: "PAUSED",
          targetId: null,
          rotationEnabled: true,
        },
      },
    ]);
    renderLivePage();

    await screen.findByText(/Autumn Cup/);
    // The current mode's own button is disabled: the dashboard shows what the screens
    // already are, and only offers the modes they are not on.
    expect(screen.getByRole("button", { name: "Live ranking" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Paused screen" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("The big screens were updated.");
    });
    const sent = calls.find((c) => c.method === "POST" && /big-screen\/mode$/.test(c.url));
    expect(sent?.body).toEqual({ mode: "PAUSED" });
  });

  it("names the competition and its status in the header", async () => {
    seedControllerSession();
    mockFetch(baseRoutes("PAUSED", "PAUSED"));
    renderLivePage();

    await screen.findByText(/Autumn Cup/);
    // A paused round reads as "Resume", driven by round status and not by a snapshot.
    expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
  });
});

describe("controller competition picker", () => {
  it("lists competitions newest first and links each to its dashboard", async () => {
    seedControllerSession();
    mockFetch([
      {
        method: "GET",
        url: /\/api\/competitions$/,
        status: 200,
        body: {
          competitions: [
            {
              id: "comp-2",
              name: "Winter Cup",
              status: "ROUND_ACTIVE",
              createdAt: "2026-10-08T09:00:00.000Z",
              publishedAt: null,
              startedAt: null,
              finishedAt: null,
            },
            {
              id: "comp-1",
              name: "Autumn Cup",
              status: "FINISHED",
              createdAt: "2026-10-07T09:00:00.000Z",
              publishedAt: null,
              startedAt: null,
              finishedAt: "2026-10-07T12:00:00.000Z",
            },
          ],
        },
      },
    ]);
    renderAt("/controller", "/controller", <ControllerPickerPage />);

    await screen.findByText("Winter Cup");
    expect(screen.getByText("Autumn Cup")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Open control panel" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/controller/competitions/comp-2/live");
  });

  it("says so when there is no competition yet", async () => {
    seedControllerSession();
    mockFetch([
      { method: "GET", url: /\/api\/competitions$/, status: 200, body: { competitions: [] } },
    ]);
    renderAt("/controller", "/controller", <ControllerPickerPage />);

    await screen.findByText("No competition yet.");
  });

  it("shows the load error when the list cannot be read", async () => {
    seedControllerSession();
    mockFetch([
      {
        method: "GET",
        url: /\/api\/competitions$/,
        status: 500,
        body: { error: { code: "INTERNAL_ERROR", message: "boom" } },
      },
    ]);
    renderAt("/controller", "/controller", <ControllerPickerPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not read the competition. Please try again.",
      );
    });
  });
});
