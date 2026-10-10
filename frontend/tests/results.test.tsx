import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "../src/i18n/locale-context";
import { saveSession } from "../src/features/auth/session";
import { ResultsPage } from "../src/features/results";
import * as resultsApi from "../src/features/results/resultsApi";

/**
 * Unit 12 frontend: the controller's results screen. These tests cover the half of
 * the spec's acceptance criteria that lives on the screen itself — that the scores
 * are shown with Unit 09's rank beside them, that a correction cannot be submitted
 * without a reason, that a rejection is shown as a localizable message rather than
 * swallowed, that the export button drives the download, that the purge date is
 * announced, and that a cancelled competition shows the gate instead of any number
 * (the check Unit 11 deferred to this unit). The purge itself is schedule-driven on
 * the server and has no control here, so there is deliberately nothing to test for
 * triggering one.
 *
 * `fetch` is mocked and routed on method + URL, the Unit 11 harness's pattern, and
 * `downloadExport` is mocked whole because jsdom has no object URLs and no real
 * file saving — the screen's job is to call it and report the filename it returns.
 */

const ROUTE = "/controller/competitions/:id/results";
const AT = "/controller/competitions/comp-1/results";

function renderResultsPage() {
  return renderAt(ROUTE, AT, <ResultsPage />);
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

type SentCall = { method: string; url: string; body: unknown };

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
    calls.push({ method, url, body: init?.body ? JSON.parse(init.body as string) : undefined });
    const route = routes.find((c) => c.method === method && c.url.test(url));
    if (!route) {
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }
    return Promise.resolve(jsonResponse(route.status, route.body));
  }) as unknown as typeof fetch;
  return calls;
}

/** One participant's result row, as the backend builds it. */
function row(participantId: string, name: string, overrides: Partial<resultsApi.ResultsRowView> = {}) {
  return {
    participantId,
    participantName: name,
    participantNumber: participantId === "p-1" ? 1 : 2,
    roundId: "round-1",
    score: 40,
    bonus: 10,
    totalScore: 50,
    completionTimeSeconds: 600,
    submissionType: "MANUAL",
    submittedAt: "2026-10-07T12:00:00.000Z",
    rank: 1,
    ...overrides,
  };
}

/** A finished competition with one category, one Individual stage, one round. */
function resultsBody(status: string, overrides: Partial<resultsApi.ResultsView> = {}) {
  return {
    competitionId: "comp-1",
    name: "Autumn Cup",
    status,
    finishedEarly: false,
    finishedAt: "2026-10-07T14:00:00.000Z",
    cancelledAt: null,
    categories: [
      {
        categoryId: "cat-1",
        code: "U8",
        name: "Under 8",
        sequence: 1,
        stages: [
          {
            stageId: "stage-1",
            type: "INDIVIDUAL",
            sequence: 1,
            status: "FINISHED",
            name: "Individual",
            rounds: [
              {
                roundId: "round-1",
                sequence: 1,
                name: "Individual round 1",
                status: "FINISHED",
                rows: [row("p-1", "Alice"), row("p-2", "Bob", { totalScore: 30, rank: 2 })],
              },
            ],
          },
        ],
      },
    ],
    rankings: {
      "cat-1": [
        {
          rank: 1,
          participantId: "p-1",
          participantName: "Alice",
          score: 50,
          completionTimeSeconds: 600,
        },
        {
          rank: 2,
          participantId: "p-2",
          participantName: "Bob",
          score: 30,
          completionTimeSeconds: 700,
        },
      ],
    },
    purge: {
      competitionId: "comp-1",
      purgeAt: "2026-10-22T14:00:00.000Z",
      status: "SCHEDULED",
      executedAt: null,
    },
    ...overrides,
  };
}

function correctionsBody(corrections: unknown[] = []) {
  return { competitionId: "comp-1", corrections };
}

/** The two reads the screen makes on mount. */
function baseRoutes(status: string = "FINISHED", body: unknown = resultsBody(status)): MockRoute[] {
  return [
    { method: "GET", url: /\/api\/competitions\/comp-1\/results$/, status: 200, body },
    {
      method: "GET",
      url: /\/api\/competitions\/comp-1\/corrections$/,
      status: 200,
      body: correctionsBody(),
    },
  ];
}

/** The export goes through `downloadExport`, which jsdom cannot really perform. */
function stubDownload(fileName = "results-comp-1.xlsx") {
  return jest
    .spyOn(resultsApi, "downloadExport")
    .mockImplementation(async () => fileName);
}

afterEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe("results screen", () => {
  it("shows the scores with Unit 09's rank beside every row, and the leaderboard", async () => {
    seedControllerSession();
    mockFetch(baseRoutes());
    renderResultsPage();

    await screen.findByText("Autumn Cup");
    // The leaderboard is the first table; the round detail tables follow it. Both come
    // from the same read, so the rank shown beside a row is Unit 09's, never a recompute.
    const [leaderboard, ...detailTables] = screen.getAllByRole("table");
    if (!leaderboard) throw new Error("no table rendered");
    expect(within(leaderboard).getByText("Alice")).toBeInTheDocument();
    expect(within(leaderboard).getByText("Bob")).toBeInTheDocument();

    const detail = detailTables[0];
    if (!detail) throw new Error("no detail table rendered");
    const aliceDetail = within(detail)
      .getAllByRole("row")
      .find((r) => r.textContent?.includes("Alice"));
    expect(aliceDetail).toBeDefined();
    if (!aliceDetail) throw new Error("no detail row rendered");
    // Raw score, bonus, total, the completion time formatted, and the submission type.
    expect(within(aliceDetail).getByText("40")).toBeInTheDocument();
    expect(within(aliceDetail).getByText("10")).toBeInTheDocument();
    expect(within(aliceDetail).getByText("50")).toBeInTheDocument();
    expect(within(aliceDetail).getByText("10:00")).toBeInTheDocument();
    expect(within(aliceDetail).getByText("Manual")).toBeInTheDocument();
  });

  it("announces the purge date as information, with no control to run it", async () => {
    seedControllerSession();
    mockFetch(baseRoutes());
    renderResultsPage();

    await screen.findByText("Autumn Cup");
    expect(
      screen.getByText(/This competition's student data will be permanently purged on/),
    ).toBeInTheDocument();
    // The purge is schedule-driven on the server: there is no button for it here.
    expect(screen.queryByRole("button", { name: /purge/i })).toBeNull();
  });

  it("refuses to submit a correction with no reason, and says the reason is mandatory", async () => {
    seedControllerSession();
    const calls = mockFetch(baseRoutes());
    renderResultsPage();

    await screen.findByText("Autumn Cup");
    const [correct] = screen.getAllByRole("button", { name: "Correct" });
    if (!correct) throw new Error("no correct button rendered");
    fireEvent.click(correct);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("The reason is mandatory");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save correction" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "A reason is required to correct a score.",
      );
    });
    // Nothing was sent: the screen refuses locally before the server has to.
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("sends the correction with its target, round, new score and reason", async () => {
    seedControllerSession();
    const calls = mockFetch([
      ...baseRoutes(),
      {
        method: "POST",
        url: /\/api\/competitions\/comp-1\/corrections$/,
        status: 201,
        body: {
          correctionId: "corr-1",
          competitionId: "comp-1",
          targetType: "PARTICIPANT",
          targetId: "p-1",
          roundId: "round-1",
          oldScore: "50",
          newScore: "55",
          reason: "A cell was miscounted.",
          correctedAt: "2026-10-08T09:00:00.000Z",
          ranking: null,
        },
      },
    ]);
    renderResultsPage();

    await screen.findByText("Autumn Cup");
    const [correct] = screen.getAllByRole("button", { name: "Correct" });
    if (!correct) throw new Error("no correct button rendered");
    fireEvent.click(correct);

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("New total score"), {
      target: { value: "55" },
    });
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "A cell was miscounted." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save correction" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "The score was corrected and the ranking recalculated.",
      );
    });
    const sent = calls.find((c) => c.method === "POST");
    expect(sent?.body).toEqual({
      targetType: "PARTICIPANT",
      targetId: "p-1",
      roundId: "round-1",
      newScore: 55,
      reason: "A cell was miscounted.",
    });
  });

  it("shows a localizable message when the server rejects a correction", async () => {
    seedControllerSession();
    mockFetch([
      ...baseRoutes(),
      {
        method: "POST",
        url: /\/api\/competitions\/comp-1\/corrections$/,
        status: 422,
        body: { error: { code: "results.unsupportedTargetType", message: "no" } },
      },
    ]);
    renderResultsPage();

    await screen.findByText("Autumn Cup");
    const [correct] = screen.getAllByRole("button", { name: "Correct" });
    if (!correct) throw new Error("no correct button rendered");
    fireEvent.click(correct);

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Because." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save correction" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Only a participant's score can be corrected for now.",
      );
    });
  });

  it("falls back to the generic message and still prints an unmapped rejection code", async () => {
    seedControllerSession();
    mockFetch([
      {
        method: "GET",
        url: /\/api\/competitions\/comp-1\/results$/,
        status: 500,
        body: { error: { code: "results.somethingNew", message: "new" } },
      },
    ]);
    renderResultsPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
      expect(screen.getByRole("alert")).toHaveTextContent("results.somethingNew");
    });
  });

  it("downloads the export and reports the server's filename", async () => {
    seedControllerSession();
    const download = stubDownload("results-comp-1-2026.xlsx");
    mockFetch(baseRoutes());
    renderResultsPage();

    await screen.findByText("Autumn Cup");
    fireEvent.click(screen.getByRole("button", { name: "Export .xlsx" }));

    await waitFor(() => {
      expect(download).toHaveBeenCalledWith("comp-1");
      expect(screen.getByRole("status")).toHaveTextContent(
        "Export downloaded (results-comp-1-2026.xlsx)",
      );
    });
  });

  it("shows the correction history when there is one", async () => {
    seedControllerSession();
    mockFetch([
      { method: "GET", url: /\/api\/competitions\/comp-1\/results$/, status: 200, body: resultsBody("FINISHED") },
      {
        method: "GET",
        url: /\/api\/competitions\/comp-1\/corrections$/,
        status: 200,
        body: correctionsBody([
          {
            id: "corr-1",
            targetType: "PARTICIPANT",
            targetId: "p-1",
            roundId: "round-1",
            oldScore: "50",
            newScore: "55",
            reason: "A cell was miscounted.",
            correctedByAccountId: "account-1",
            correctedAt: "2026-10-08T09:00:00.000Z",
          },
        ]),
      },
    ]);
    renderResultsPage();

    await screen.findByText("Correction history");
    expect(screen.getByText("50 → 55")).toBeInTheDocument();
    expect(screen.getByText("A cell was miscounted.")).toBeInTheDocument();
  });

  it("shows the cancelled gate and disables every write for a cancelled competition", async () => {
    seedControllerSession();
    mockFetch([
      // The results read is rejected by the gate: this unit enforces what Unit 11 deferred.
      {
        method: "GET",
        url: /\/api\/competitions\/comp-1\/results$/,
        status: 403,
        body: { error: { code: "results.competitionCancelled", message: "cancelled" } },
      },
      {
        method: "GET",
        url: /\/api\/competitions\/comp-1\/corrections$/,
        status: 403,
        body: { error: { code: "results.competitionCancelled", message: "cancelled" } },
      },
    ]);
    renderResultsPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "This competition was cancelled, so no result is released",
      );
    });
    // No numbers at all: the export button is disabled with no results to export.
    expect(screen.getByRole("button", { name: "Export .xlsx" })).toBeDisabled();
    expect(screen.queryByText("Alice")).toBeNull();
  });

  it("disables correction and export when the loaded competition is itself cancelled", async () => {
    seedControllerSession();
    mockFetch([
      {
        method: "GET",
        url: /\/api\/competitions\/comp-1\/results$/,
        status: 200,
        body: resultsBody("CANCELLED", {
          finishedAt: null,
          cancelledAt: "2026-10-07T14:00:00.000Z",
          purge: {
            competitionId: "comp-1",
            purgeAt: "2026-10-22T14:00:00.000Z",
            status: "SCHEDULED",
            executedAt: null,
          },
        }),
      },
      {
        method: "GET",
        url: /\/api\/competitions\/comp-1\/corrections$/,
        status: 403,
        body: { error: { code: "results.competitionCancelled", message: "cancelled" } },
      },
    ]);
    renderResultsPage();

    await screen.findByText("Autumn Cup");
    expect(screen.getByRole("button", { name: "Export .xlsx" })).toBeDisabled();
    for (const correct of screen.getAllByRole("button", { name: "Correct" })) {
      expect(correct).toBeDisabled();
    }
    // The purge countdown still runs from `cancelledAt`, so the notice is still shown.
    expect(
      screen.getByText(/This competition's student data will be permanently purged on/),
    ).toBeInTheDocument();
  });
});
