import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocaleProvider } from "../src/i18n/locale-context";
import { QuestionPanel } from "../src/features/question";

/**
 * Unit 05 frontend: the controller imports a question file into a category's pool, sees
 * the pool grouped by `QuestionSet`/variant, and assigns exactly 6 questions to one
 * Individual round. A rejected file shows the row-level reasons; a locked round shows the
 * backend's refusal. `fetch` is mocked; no server is contacted.
 */

const CATEGORIES = [{ id: "cat-1", name: "Under 8" }];
const ROUNDS = [
  { id: "round-1", name: "Individual round 1" },
  { id: "round-2", name: "Individual round 2" },
];

function renderPanel() {
  return render(
    <LocaleProvider initialLocale="en">
      <QuestionPanel competitionId="comp-1" categories={CATEGORIES} individualRounds={ROUNDS} />
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

/** Two imported sets of one category, as the pool endpoint returns them (BLD-044). */
function poolBody(roundId: string | null = null) {
  return {
    categoryId: "cat-1",
    groups: [
      {
        questionSet: {
          id: "set-1",
          name: "四宫标准数独",
          questionCount: 4,
          assignedCounts: roundId ? [{ roundId, count: 6 }] : [],
        },
        questions: [1, 2, 3, 4].map((sequence) => ({
          id: `q-${sequence}`,
          sequence,
          variantLabel: "四宫标准数独",
          gridRows: 4,
          gridColumns: 4,
          points: 5,
          roundId: sequence <= 2 ? roundId : null,
        })),
      },
      {
        questionSet: { id: "set-2", name: "四宫对角线数独", questionCount: 2, assignedCounts: [] },
        questions: [5, 6].map((sequence) => ({
          id: `q-${sequence}`,
          sequence,
          variantLabel: "四宫对角线数独",
          gridRows: 4,
          gridColumns: 4,
          points: 8,
          roundId: null,
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

afterEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe("question panel (Unit 05)", () => {
  it("lists the pool grouped by question set, and never shows an answer", async () => {
    mockFetch(poolRoutes(poolBody()));
    renderPanel();

    expect(await screen.findByText(/四宫标准数独 · 4/)).toBeInTheDocument();
    expect(screen.getByText(/四宫对角线数独 · 2/)).toBeInTheDocument();
    // Six rows, one per pooled question, none of them assigned yet.
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(screen.getByText("Selected: 0 / 6")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign the 6 questions" })).toBeDisabled();
  });

  it("says so when the category has no questions yet", async () => {
    mockFetch(poolRoutes({ categoryId: "cat-1", groups: [] }));
    renderPanel();

    expect(
      await screen.findByText("No questions imported into this category yet."),
    ).toBeInTheDocument();
  });

  it("uploads the chosen file and reloads the pool", async () => {
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

    await screen.findByText(/四宫标准数独 · 4/);
    fireEvent.change(screen.getByLabelText("Question file"), { target: { files: [pickFile()] } });
    fireEvent.click(screen.getByRole("button", { name: "Import file" }));

    await waitFor(() => {
      expect(screen.getByText(/Imported · 四宫标准数独 \(4\)/)).toBeInTheDocument();
    });
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

    await screen.findByText(/四宫标准数独 · 4/);
    fireEvent.change(screen.getByLabelText("Question file"), { target: { files: [pickFile()] } });
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

  it("assigns exactly 6 and pre-fills a round that already has its 6", async () => {
    mockFetch([
      ...poolRoutes(poolBody("round-1")),
      {
        method: "POST",
        url: /\/select-questions$/,
        status: 200,
        body: { roundId: "round-2", questionIds: ["q-1", "q-2", "q-3", "q-4", "q-5", "q-6"] },
      },
    ]);
    renderPanel();

    // Round 1 already holds q-1 and q-2, so they arrive ticked (spec Detail 5: a
    // re-selection starts from what is assigned, and replaces it).
    const boxes = (await screen.findAllByRole("checkbox")) as HTMLInputElement[];
    await waitFor(() => expect(boxes.filter((box) => box.checked)).toHaveLength(2));

    fireEvent.change(screen.getByLabelText("Individual round"), { target: { value: "round-2" } });
    await waitFor(() => expect(boxes.filter((box) => box.checked)).toHaveLength(0));

    boxes.forEach((box) => fireEvent.click(box));
    expect(screen.getByText("Selected: 6 / 6")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Assign the 6 questions" }));

    await screen.findByText("The round's 6 questions are set.");
    const fetchMock = global.fetch as jest.Mock;
    const assign = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith("/rounds/round-2/select-questions"),
    );
    expect(JSON.parse(String(assign?.[1]?.body))).toEqual({
      questionIds: ["q-1", "q-2", "q-3", "q-4", "q-5", "q-6"],
    });
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

    const boxes = await screen.findAllByRole("checkbox");
    boxes.forEach((box) => fireEvent.click(box));
    fireEvent.click(screen.getByRole("button", { name: "Assign the 6 questions" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "This round's preparation has begun; its questions can no longer change.",
    );
  });
});
