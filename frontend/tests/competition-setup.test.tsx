import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "../src/i18n/locale-context";
import { CompetitionSetupPage } from "../src/features/competition";

/**
 * Unit 03 frontend: the controller creates a competition, sees the auto-generated
 * structure, and publishes. A refused publish shows the specific unmet conditions
 * (parsed from the backend's 422 payload); a successful publish shows both links.
 * `fetch` is mocked; no server is contacted.
 *
 * The page is rendered at the create route, so it has no `:id` param: Unit 15's
 * load-an-existing-competition effect stays inert and nothing is fetched on mount.
 */
function renderPage() {
  return render(
    <LocaleProvider initialLocale="en">
      <MemoryRouter initialEntries={["/controller/competition/new"]}>
        <CompetitionSetupPage />
      </MemoryRouter>
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

/** An empty roster, shaped like `ParticipantListView`. */
function emptyRoster() {
  return {
    competitionId: "comp-1",
    participants: [],
    counts: { total: 0, active: 0, individualEvent: 0, teamEvent: 0, teamFlaggedBySchool: [] },
  };
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
    // The participant panel (Unit 04) is also mounted on this screen and loads the
    // roster as soon as a competition exists. Without this route the panel's request
    // throws, it renders its own `role="alert"` beside the one the publish test is
    // about, and `getByRole("alert")` fails on the duplicate. An empty roster is
    // enough: the panel then shows no error of its own.
    {
      method: "GET",
      url: /\/api\/competitions\/comp-1\/participants/,
      status: 200,
      body: emptyRoster(),
    },
    // The schools panel (BLD-052) is also mounted on this screen and loads its list as
    // soon as a competition exists. Without this route the mock throws, the panel
    // renders its own `role="alert"` and the publish test fails on the duplicate.
    {
      method: "GET",
      url: /\/api\/competitions\/comp-1\/schools$/,
      status: 200,
      body: { schools: [] },
    },
    // The judge range panel (report §4c) now also reads the competition's recorded
    // ranges as soon as it mounts. Same failure mode as the two routes above without it.
    {
      method: "GET",
      url: /\/api\/competitions\/comp-1\/judge-assignments$/,
      status: 200,
      body: { assignments: [] },
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
    // A round's name is no longer unique on the page: the structure list carries it, and
    // so does the question panel, which since BLD-040's revision shows one block per
    // round — all four of them, Team included. Matched loosely for that reason.
    expect(screen.getAllByText("Individual round 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Team round 2").length).toBeGreaterThan(0);
    // And the question panel really does offer a block for each of the four rounds.
    expect(screen.getByTestId("round-block-round-1")).toBeInTheDocument();
    expect(screen.getByTestId("round-block-round-4")).toBeInTheDocument();
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
          // Composed by the backend (`shared/links`) — the screen renders these as-is.
          entryLinkUrl: "http://10.0.0.5/player?token=entry-token",
          bigScreenLinkUrl: "http://10.0.0.5/big-screen/screen-token",
        },
      },
    ]);
    renderPage();

    await createCompetition();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(screen.getByText("Published")).toBeInTheDocument();
    });
    // Real, openable addresses — not the raw tokens (report §9a).
    const entry = screen.getByRole("link", { name: "http://10.0.0.5/player?token=entry-token" });
    expect(entry).toHaveAttribute("href", "http://10.0.0.5/player?token=entry-token");
    const bigScreen = screen.getByRole("link", { name: "http://10.0.0.5/big-screen/screen-token" });
    expect(bigScreen).toHaveAttribute("href", "http://10.0.0.5/big-screen/screen-token");
    expect(screen.getAllByRole("button", { name: "Copy link" })).toHaveLength(2);
  });

  it("says the link address is not configured when the server has no PUBLIC_BASE_URL", async () => {
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
          entryLinkUrl: "",
          bigScreenLinkUrl: "",
        },
      },
    ]);
    renderPage();

    await createCompetition();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(screen.getByText("Published")).toBeInTheDocument();
    });
    // No dead link and no raw token: an explanation instead.
    expect(
      screen.getAllByText(
        "The link address is not configured on this server (PUBLIC_BASE_URL). Set it, then reopen this screen.",
      ),
    ).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /entry-token/ })).not.toBeInTheDocument();
  });
});
