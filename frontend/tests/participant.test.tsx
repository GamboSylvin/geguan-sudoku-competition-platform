import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocaleProvider } from "../src/i18n/locale-context";
import { ParticipantPanel } from "../src/features/participant";

/**
 * Unit 04 frontend: the controller imports one participant `.xlsx` for the whole
 * competition, sees the counts and the freshly issued credentials once, reads a
 * row-level rejection list when the file is refused, and edits / removes a single row
 * afterwards. `fetch` is mocked; no server is contacted.
 *
 * Nothing here forms a team — team building is deferred out of Unit 04 (spec §8 Q10), so
 * the `团队赛` flag is only displayed and counted.
 */

const CATEGORIES = [
  { id: "cat-1", name: "Under 8" },
  { id: "cat-2", name: "Under 12" },
];

function renderPanel() {
  return render(
    <LocaleProvider initialLocale="en">
      <ParticipantPanel competitionId="comp-1" categories={CATEGORIES} />
    </LocaleProvider>,
  );
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

type Route = { method: string; url: RegExp; status: number; body: unknown };

/** Routes on method + URL, and fails loudly on any request a test did not anticipate. */
function mockFetch(routes: Route[]): void {
  global.fetch = jest.fn().mockImplementation((input: unknown, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : String((input as { url: string }).url);
    const method = (init?.method ?? "GET").toUpperCase();
    const route = routes.find(
      (candidate) => candidate.method === method && candidate.url.test(url),
    );
    if (!route) {
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }
    return Promise.resolve(jsonResponse(route.status, route.body));
  }) as unknown as typeof fetch;
}

/** One active participant, as the roster endpoint returns it. Never a password. */
function rosterBody(count = 1) {
  return {
    competitionId: "comp-1",
    participants: [1, 2].slice(0, count).map((n) => ({
      id: `p-${n}`,
      participantNumber: n,
      name: n === 1 ? "张三" : "李四",
      active: true,
      individualEvent: n === 1,
      teamEvent: n === 2,
      categoryId: "cat-1",
      categoryName: "Under 8",
      schoolId: "school-1",
      schoolName: "第一小学",
      teamId: null,
      username: `p${n}`,
    })),
    counts: {
      total: count,
      active: count,
      individualEvent: 1,
      teamEvent: count > 1 ? 1 : 0,
      teamFlaggedBySchool: [
        {
          schoolId: "school-1",
          schoolName: "第一小学",
          categoryId: "cat-1",
          categoryName: "Under 8",
          count: 1,
        },
      ],
    },
  };
}

function rosterRoutes(body: unknown = rosterBody()): Route[] {
  return [{ method: "GET", url: /\/api\/competitions\/comp-1\/participants/, status: 200, body }];
}

/** A committed import that created one student and issued one credential. */
function importBody() {
  return {
    batchId: "batch-1",
    fileId: "file-1",
    status: "COMMITTED",
    created: 1,
    kept: 0,
    replaced: 0,
    deactivated: 0,
    warnings: [{ row: 2, code: "participant.import.noteRowSkipped", message: "skipped" }],
    credentials: [
      {
        participantId: "p-9",
        participantNumber: 9,
        name: "王五",
        schoolName: "第二小学",
        categoryName: "Under 12",
        username: "p9",
        password: "Ab3dEf",
      },
    ],
  };
}

describe("ParticipantPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the roster on mount and shows the flag counts", async () => {
    mockFetch(rosterRoutes(rosterBody(2)));
    renderPanel();

    await waitFor(() => expect(screen.getByText("张三")).toBeTruthy());
    expect(screen.getByText("李四")).toBeTruthy();
    // Both flags are named on the counts line so the organizer can see the split.
    expect(screen.getByText(/Individual event 1 · Team event 1/)).toBeTruthy();
  });

  it("imports a file and shows the issued credential exactly once", async () => {
    mockFetch([
      ...rosterRoutes(),
      {
        method: "POST",
        url: /\/participants\/import/,
        status: 200,
        body: importBody(),
      },
    ]);
    renderPanel();
    await waitFor(() => expect(screen.getByText("张三")).toBeTruthy());

    const input = screen.getByLabelText("Participant file");
    fireEvent.change(input, {
      target: { files: [new File(["x"], "选手信息.xlsx")] },
    });
    fireEvent.click(screen.getByText("Import file"));

    // The plaintext password is on screen because the backend never stores it; the panel
    // says so beside it.
    await waitFor(() => expect(screen.getByText("Ab3dEf")).toBeTruthy());
    expect(screen.getByText(/shown once/)).toBeTruthy();
    // A non-rejecting warning is shown as a warning, not as an error.
    expect(screen.getByText(/An instruction row was skipped\./)).toBeTruthy();
    expect(screen.getByText(/added 1/)).toBeTruthy();
  });

  it("lists the row-level reasons of a rejected file and writes nothing", async () => {
    mockFetch([
      ...rosterRoutes(),
      {
        method: "POST",
        url: /\/participants\/import/,
        status: 422,
        body: {
          error: {
            code: "participant.import.unknownCategory",
            details: {
              failures: [
                {
                  row: 3,
                  column: "组别",
                  code: "participant.import.unknownCategory",
                  message: "unknown group",
                },
                {
                  row: 4,
                  column: "姓名",
                  code: "participant.import.nameRequired",
                  message: "empty name",
                },
              ],
            },
          },
        },
      },
    ]);
    renderPanel();
    await waitFor(() => expect(screen.getByText("张三")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Participant file"), {
      target: { files: [new File(["x"], "选手信息.xlsx")] },
    });
    fireEvent.click(screen.getByText("Import file"));

    await waitFor(() =>
      expect(screen.getByText("The file was rejected. Nothing was written:")).toBeTruthy(),
    );
    expect(screen.getByText(/Row 3 · 组别 — This group/)).toBeTruthy();
    expect(screen.getByText(/Row 4 · 姓名 — The name/)).toBeTruthy();
  });

  it("edits one row and shows the new credential when a name change issues one", async () => {
    mockFetch([
      ...rosterRoutes(),
      {
        method: "PATCH",
        url: /\/participants\/p-1/,
        status: 200,
        body: {
          participant: { ...rosterBody().participants[0], name: "赵六" },
          credential: {
            participantId: "p-1",
            participantNumber: 1,
            name: "赵六",
            schoolName: "第一小学",
            categoryName: "Under 8",
            username: "p1-abcd",
            password: "Zz9kLm",
          },
        },
      },
    ]);
    renderPanel();
    await waitFor(() => expect(screen.getByText("张三")).toBeTruthy());

    fireEvent.click(screen.getByText("Edit"));
    const nameInput = screen.getByDisplayValue("张三");
    fireEvent.change(nameInput, { target: { value: "赵六" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(screen.getByText("Zz9kLm")).toBeTruthy());
    expect(screen.getByText("The participant was updated.")).toBeTruthy();
  });

  it("removes one row and refreshes the roster", async () => {
    const removeRoute: Route = {
      method: "DELETE",
      url: /\/participants\/p-1/,
      status: 204,
      body: null,
    };
    mockFetch([...rosterRoutes(), removeRoute]);
    renderPanel();
    await waitFor(() => expect(screen.getByText("张三")).toBeTruthy());

    fireEvent.click(screen.getByText("Remove"));

    await waitFor(() =>
      expect(screen.getByText("The participant was removed from this competition.")).toBeTruthy(),
    );
  });

  it("shows the backend's refusal when the competition is already published", async () => {
    mockFetch([
      ...rosterRoutes(),
      {
        method: "POST",
        url: /\/participants\/import/,
        status: 409,
        body: { error: { code: "participant.import.notAllowedAfterPublish", details: null } },
      },
    ]);
    renderPanel();
    await waitFor(() => expect(screen.getByText("张三")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Participant file"), {
      target: { files: [new File(["x"], "选手信息.xlsx")] },
    });
    fireEvent.click(screen.getByText("Import file"));

    await waitFor(() =>
      expect(screen.getByText(/Participants can only be imported while the competition/)).toBeTruthy(),
    );
  });
});
