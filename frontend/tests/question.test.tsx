import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LocaleProvider } from "../src/i18n/locale-context";
import { QuestionPanel } from "../src/features/question";

/**
 * Unit 05 frontend: the controller imports a question file into a category's pool and
 * assigns **every** round its own questions — Individual 1 and 2, Team 1 and 2 — through
 * one collapsible block per round (BLD-040, revised 2026-10-19). Each block carries its
 * own upload and its own expected count, closes itself on success and says the round is
 * set up. A rejected file shows the row-level reasons; a locked round shows the backend's
 * refusal. `fetch` is mocked; no server is contacted.
 */

const CATEGORIES = [{ id: "cat-1", name: "Under 8" }];
const ROUNDS = [
  { id: "round-1", name: "Individual round 1", questionCount: 6 },
  { id: "round-2", name: "Individual round 2", questionCount: 6 },
  { id: "team-1", name: "Team round 1", questionCount: 10 },
  { id: "team-2", name: "Team round 2", questionCount: 3 },
];

function renderPanel() {
  return render(
    <LocaleProvider initialLocale="en">
      <QuestionPanel competitionId="comp-1" categories={CATEGORIES} rounds={ROUNDS} />
    </LocaleProvider>,
  );
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

type Route = {
  method: string;
  url: RegExp;
  status: number;
  /** A body, or a function producing one — so a route can answer differently after a write. */
  body: unknown | (() => unknown);
};

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
    const body = typeof route.body === "function" ? route.body() : route.body;
    return Promise.resolve(jsonResponse(route.status, body));
  }) as unknown as typeof fetch;
}

/**
 * Two imported sets of one category, as the pool endpoint returns them (BLD-044).
 * `assignedTo` is the round holding questions; `assignedUpTo` how many of them it holds.
 */
function poolBody(assignedTo: string | null = null, assignedUpTo = 2) {
  return {
    categoryId: "cat-1",
    groups: [
      {
        questionSet: {
          id: "set-1",
          name: "四宫标准数独",
          questionCount: 4,
          assignedCounts: assignedTo ? [{ roundId: assignedTo, count: Math.min(assignedUpTo, 4) }] : [],
        },
        questions: [1, 2, 3, 4].map((sequence) => ({
          id: `q-${sequence}`,
          sequence,
          variantLabel: "四宫标准数独",
          gridRows: 4,
          gridColumns: 4,
          points: 5,
          roundId: sequence <= assignedUpTo ? assignedTo : null,
        })),
      },
      {
        questionSet: {
          id: "set-2",
          name: "四宫对角线数独",
          questionCount: 2,
          assignedCounts: assignedUpTo >= 5 && assignedTo ? [{ roundId: assignedTo, count: 2 }] : [],
        },
        questions: [5, 6].map((sequence) => ({
          id: `q-${sequence}`,
          sequence,
          variantLabel: "四宫对角线数独",
          gridRows: 4,
          gridColumns: 4,
          points: 8,
          roundId: assignedUpTo >= 5 ? assignedTo : null,
        })),
      },
    ],
  };
}

function poolRoutes(body: unknown): Route[] {
  return [{ method: "GET", url: /\/questions\/pool$/, status: 200, body }];
}

function pickFile(): File {
  return new File(["bytes"], "questions.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * One round's block, by the `data-testid` the component puts on it. Looking the block up
 * by its header text instead would be ambiguous: the overview strip repeats every round
 * name, so `getByText` matches twice.
 */
function blockOf(roundId: string): HTMLElement {
  return screen.getByTestId(`round-block-${roundId}`);
}

/** Open a round's block, as the controller does before uploading anything. */
function openBlock(roundId: string): HTMLElement {
  const block = blockOf(roundId);
  fireEvent.click(within(block).getByRole("button", { name: "Set up" }));
  return block;
}

afterEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe("question panel (Unit 05)", () => {
  it("offers a block for all four rounds, each with its own expected count", async () => {
    mockFetch(poolRoutes(poolBody()));
    renderPanel();

    // A Team round is not an Individual round's 6: the header states what each wants.
    await waitFor(() => expect(blockOf("team-1")).toBeInTheDocument());
    expect(within(blockOf("team-1")).getByText(/0 \/ 10/)).toBeInTheDocument();
    expect(within(blockOf("team-2")).getByText(/0 \/ 3/)).toBeInTheDocument();
    expect(within(blockOf("round-1")).getByText(/0 \/ 6/)).toBeInTheDocument();
    // Nothing is set up yet, and no block is open — no checkbox is on screen.
    expect(screen.getAllByText(/not set up/)).toHaveLength(4);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("lists the pool grouped by question set once a block is open, and never shows an answer", async () => {
    mockFetch(poolRoutes(poolBody()));
    renderPanel();

    await screen.findByText(/Rounds in this category/);
    openBlock("round-1");

    expect(await screen.findByText(/四宫标准数独 · 4/)).toBeInTheDocument();
    expect(screen.getByText(/四宫对角线数独 · 2/)).toBeInTheDocument();
    // Six rows, one per pooled question, none of them assigned yet.
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(screen.getByText("Selected: 0 / 6")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add the 6 questions" })).toBeDisabled();
  });

  it("says so when the category has no questions yet", async () => {
    mockFetch(poolRoutes({ categoryId: "cat-1", groups: [] }));
    renderPanel();

    expect(
      await screen.findByText("No questions imported into this category yet."),
    ).toBeInTheDocument();
  });

  it("uploads the chosen file into that round's own block and reloads the pool", async () => {
    mockFetch([
      ...poolRoutes(poolBody()),
      {
        method: "POST",
        url: /\/questions\/import$/,
        status: 200,
        body: { questionSetId: "set-1", variantLabel: "四宫标准数独", questionCount: 4 },
      },
    ]);
    renderPanel();

    await screen.findByText(/Rounds in this category/);
    openBlock("round-1");
    // The file input is the block's own, labelled with the round it belongs to.
    fireEvent.change(
      screen.getByLabelText("Question file · Individual round 1"),
      { target: { files: [pickFile()] } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Import file" }));

    await waitFor(() => {
      expect(screen.getByText(/Imported · 四宫标准数独 \(4\)/)).toBeInTheDocument();
    });
    // After an upload the block narrows to what that file just added, so the controller
    // selects "the puzzles from my file" rather than hunting them in the whole pool.
    expect(screen.getByText("From the file you just uploaded")).toBeInTheDocument();
    expect(screen.queryByText(/四宫对角线数独 · 2/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    // And a button widens it back, which is how an already-set-up round is re-selected.
    fireEvent.click(screen.getByRole("button", { name: "Show the whole pool" }));
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(6));

    const fetchMock = global.fetch as jest.Mock;
    const upload = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith("/questions/import"),
    );
    expect(upload?.[1]?.body).toBeInstanceOf(FormData);
    // The browser writes the multipart boundary, so the client must not set a
    // content-type of its own on an upload.
    expect(new Headers(upload?.[1]?.headers as HeadersInit).get("content-type")).toBeNull();
  });

  it("names every rejected row when the file fails validation", async () => {
    mockFetch([
      ...poolRoutes(poolBody()),
      {
        method: "POST",
        url: /\/questions\/import$/,
        status: 422,
        body: {
          error: {
            code: "question.import.gridsNotComplementary",
            details: {
              failures: [
                {
                  row: 3,
                  column: "*给定数字",
                  code: "question.import.gridsNotComplementary",
                  message: "The given cells and the answers do not cover the grid exactly once.",
                },
              ],
            },
          },
        },
      },
    ]);
    renderPanel();

    await screen.findByText(/Rounds in this category/);
    openBlock("round-1");
    fireEvent.change(screen.getByLabelText("Question file · Individual round 1"), {
      target: { files: [pickFile()] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import file" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The file was rejected");
    // The row number is shown and the reason is translated from its code, so a Chinese
    // controller reads Chinese (never the backend's English-only message).
    expect(alert).toHaveTextContent("Row 3");
    expect(alert).toHaveTextContent(
      "The given cells and the answers don't cover the grid exactly once.",
    );
  });

  it("closes the block and reports the round as set up once the questions are added", async () => {
    // The pool the panel re-reads after the write must show the new assignment, otherwise
    // the header has nothing to count and still reads "not set up".
    let assigned = false;
    mockFetch([
      {
        method: "GET",
        url: /\/questions\/pool$/,
        status: 200,
        body: () => poolBody(assigned ? "round-1" : null, assigned ? 6 : 2),
      },
      {
        method: "POST",
        url: /\/select-questions$/,
        status: 200,
        body: () => {
          assigned = true;
          return {
            roundId: "round-1",
            questionIds: ["q-1", "q-2", "q-3", "q-4", "q-5", "q-6"],
          };
        },
      },
    ]);
    renderPanel();

    await screen.findByText(/Rounds in this category/);
    openBlock("round-1");

    const boxes = screen.getAllByRole("checkbox");
    boxes.forEach((box) => fireEvent.click(box));
    expect(screen.getByText("Selected: 6 / 6")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add the 6 questions" }));

    await screen.findByText("Individual round 1 is set up.");
    // The block closed on its own: no checkbox left, and its header now offers to change
    // the questions rather than to set them up.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(within(blockOf("round-1")).getByRole("button", { name: "Change questions" })).toBeInTheDocument();
    expect(within(blockOf("round-1")).getByText(/6 \/ 6/)).toBeInTheDocument();

    const fetchMock = global.fetch as jest.Mock;
    const assign = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith("/rounds/round-1/select-questions"),
    );
    expect(JSON.parse(String(assign?.[1]?.body))).toEqual({
      questionIds: ["q-1", "q-2", "q-3", "q-4", "q-5", "q-6"],
    });
  });

  it("pre-fills a round that already holds questions, so re-selecting starts from them", async () => {
    mockFetch(poolRoutes(poolBody("round-1")));
    renderPanel();

    await screen.findByText(/Rounds in this category/);
    // Round 1 already holds q-1 and q-2 — its header counts them, and opening the block
    // arrives with them ticked (spec Detail 5: a re-selection replaces what is assigned).
    expect(within(blockOf("round-1")).getByText(/2 \/ 6/)).toBeInTheDocument();
    openBlock("round-1");

    await waitFor(() => {
      const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
      expect(boxes.filter((box) => box.checked)).toHaveLength(2);
    });
    expect(screen.getByText("Selected: 2 / 6")).toBeInTheDocument();
    // A question held by another round says so rather than looking free to take.
    expect(screen.queryAllByText("in another round")).toHaveLength(0);
  });

  it("marks a question that another round already holds", async () => {
    mockFetch(poolRoutes(poolBody("round-2")));
    renderPanel();

    await screen.findByText(/Rounds in this category/);
    openBlock("round-1");

    expect((await screen.findAllByText("in another round")).length).toBe(2);
  });

  it("shows the backend's refusal when the round's preparation has begun", async () => {
    mockFetch([
      ...poolRoutes(poolBody()),
      {
        method: "POST",
        url: /\/select-questions$/,
        status: 409,
        body: { error: { code: "question.selection.locked" } },
      },
    ]);
    renderPanel();

    await screen.findByText(/Rounds in this category/);
    openBlock("round-1");
    screen.getAllByRole("checkbox").forEach((box) => fireEvent.click(box));
    fireEvent.click(screen.getByRole("button", { name: "Add the 6 questions" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "This round's preparation has begun; its questions can no longer change.",
    );
    // The block stays open on a failure, so the controller can correct and retry.
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
  });
});
