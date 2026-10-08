import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocaleProvider } from "../src/i18n/locale-context";
import { CompetitionSetupPage } from "../src/features/competition";

/**
 * Unit 03 frontend: the controller creates a competition, sees the auto-generated
 * structure, and publishes. A refused publish shows the specific unmet conditions
 * (parsed from the backend's 422 payload); a successful publish shows both links.
 * `fetch` is mocked; no server is contacted.
 */
function renderPage() {
  return render(
    <LocaleProvider initialLocale="en">
      <CompetitionSetupPage />
    </LocaleProvider>,
  );
}

function createdBody() {
  return {
    id: "comp-1",
    name: "Autumn Cup",
    description: null,
    status: "CREATED",
    entryLinkToken: "entry-token",
    bigScreenLinkToken: "screen-token",
    categories: [{ id: "cat-1", code: "U8", name: "Under 8", sequence: 1 }],
    stages: [
      {
        id: "stage-1",
        type: "INDIVIDUAL",
        sequence: 1,
        status: "PENDING",
        rounds: [
          {
            id: "round-1",
            sequence: 1,
            name: "Individual round 1",
            status: "PENDING",
            settings: { durationSeconds: 1200 },
          },
          {
            id: "round-2",
            sequence: 2,
            name: "Individual round 2",
            status: "PENDING",
            settings: { durationSeconds: 1800 },
          },
        ],
      },
      {
        id: "stage-2",
        type: "TEAM",
        sequence: 2,
        status: "PENDING",
        rounds: [
          {
            id: "round-3",
            sequence: 1,
            name: "Team round 1",
            status: "PENDING",
            settings: { durationSeconds: 1800 },
          },
          {
            id: "round-4",
            sequence: 2,
            name: "Team round 2",
            status: "PENDING",
            settings: { durationSeconds: 1800 },
          },
        ],
      },
    ],
    scoringConfiguration: { schoolCoefficient: "0.6", rankingCycleSeconds: 180 },
  };
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/**
 * `CompetitionSetupPage` also mounts the judge-range panel (Unit 06), which fetches
 * the judge list on mount. Routing the mock on method + URL — instead of queueing
 * responses in call order — keeps that extra request from consuming the response
 * meant for publish, and fails loudly on any request a test did not anticipate.
 */
type Route = { method: string; url: RegExp; status: number; body: unknown };

function mockFetch(routes: Route[]): void {
  global.fetch = jest.fn().mockImplementation((input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String((input as { url: string }).url);
    const method = (init?.method ?? "GET").toUpperCase();
    const route = routes.find((candidate) => candidate.method === method && candidate.url.test(url));
    if (!route) {
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }
    return Promise.resolve(jsonResponse(route.status, route.body));
  }) as unknown as typeof fetch;
}

function baseRoutes(): Route[] {
  return [
    { method: "GET", url: /\/api\/judges$/, status: 200, body: { judges: [] } },
    { method: "POST", url: /\/api\/competitions$/, status: 201, body: createdBody() },
    // The question panel (Unit 05) is mounted on this screen and loads the selected
    // category's pool as soon as a competition exists.
    {
      method: "GET",
      url: /\/questions\/pool$/,
      status: 200,
      body: { categoryId: "cat-1", groups: [] },
    },
  ];
}

async function createCompetition() {
  fireEvent.change(screen.getByLabelText("Competition name"), {
    target: { value: "Autumn Cup" },
  });
  fireEvent.change(screen.getByLabelText("Code"), { target: { value: "U8" } });
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Under 8" } });
  fireEvent.click(screen.getByRole("button", { name: "Create competition" }));
  await screen.findByRole("heading", { name: "Autumn Cup" });
}

afterEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe("competition setup page", () => {
  it("creates a competition and shows the auto-generated structure with its defaults", async () => {
    mockFetch(baseRoutes());
    renderPage();

    await createCompetition();

    // Two stages, four rounds, each round's default duration shown.
    expect(screen.getByText("INDIVIDUAL")).toBeInTheDocument();
    expect(screen.getByText("TEAM")).toBeInTheDocument();
    // "Individual round 1" appears in the structure list and again as an option of the
    // question panel's round picker (Unit 5), so it is matched loosely here.
    expect(screen.getAllByText("Individual round 1").length).toBeGreaterThan(0);
    expect(screen.getByText("Team round 2")).toBeInTheDocument();
    const durations = screen.getAllByLabelText("Duration (seconds)") as HTMLInputElement[];
    expect(durations.map((input) => input.value)).toEqual(["1200", "1800", "1800", "1800"]);
  });

  it("names every unmet condition when publish is refused", async () => {
    mockFetch([
      ...baseRoutes(),
      {
        method: "POST",
        url: /\/api\/competitions\/comp-1\/publish$/,
        status: 422,
        body: {
          error: {
            code: "competition.notReady",
            details: {
              unmet: [
                { key: "competition.readiness.participantsRequired", message: "Participants are required" },
                { key: "competition.readiness.questionsRequired", message: "Questions are required" },
              ],
            },
          },
        },
      },
    ]);
    renderPage();

    await createCompetition();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Not ready to publish");
    });
    expect(screen.getByText("Participants are required")).toBeInTheDocument();
    expect(screen.getByText("Questions are required")).toBeInTheDocument();
  });

  it("shows both links after a successful publish", async () => {
    mockFetch([
      ...baseRoutes(),
      {
        method: "POST",
        url: /\/api\/competitions\/comp-1\/publish$/,
        status: 200,
        body: {
          id: "comp-1",
          status: "WAITING",
          publishedAt: new Date().toISOString(),
          entryLinkToken: "entry-token",
          bigScreenLinkToken: "screen-token",
        },
      },
    ]);
    renderPage();

    await createCompetition();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(screen.getByText("Published")).toBeInTheDocument();
    });
    expect(screen.getByText("entry-token")).toBeInTheDocument();
    expect(screen.getByText("screen-token")).toBeInTheDocument();
  });
});
