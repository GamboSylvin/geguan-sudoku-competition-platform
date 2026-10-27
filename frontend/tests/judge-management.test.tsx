import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "../src/i18n/locale-context";
import { JudgeManagementPage } from "../src/features/judge/JudgeManagementPage";

/**
 * The 2026-10-26 additions to the judge-management screen: the permanent Delete with its
 * pre-deletion warning, and the list-usability controls (search, status filter, count,
 * paging). `fetch` is mocked; no server is contacted.
 *
 * What the delete cases assert is the guard the server deliberately does not have: a
 * permanent deletion is accepted at any time and destroys the judge's accounts and every
 * range it holds, so the confirmation dialog is the only thing standing between a
 * controller and an unrecoverable loss. The tests therefore pin the dialog's content —
 * every range named, the confirm button disarmed until the ranges have actually been read
 * — and not just that a request went out.
 */

function judge(id: string, name: string, active: boolean) {
  return { id, name, active, createdAt: "2026-10-26T00:00:00.000Z" };
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

type Route = { method: string; url: RegExp; status: number; body: unknown };

/** Matched on method + URL, not queued: the page reloads the list after every mutation. */
function mockFetch(routes: Route[]): void {
  global.fetch = jest.fn().mockImplementation((input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
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

function renderPage() {
  return render(
    <LocaleProvider initialLocale="en">
      <MemoryRouter>
        <JudgeManagementPage />
      </MemoryRouter>
    </LocaleProvider>,
  );
}

const LIST_URL = /\/api\/judges$/;

afterEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe("permanent deletion of a judge", () => {
  it("names every competition and range about to be destroyed before confirming", async () => {
    mockFetch([
      {
        method: "GET",
        url: LIST_URL,
        status: 200,
        body: { judges: [judge("judge-1", "Loulou", true)] },
      },
      {
        method: "GET",
        url: /\/api\/judges\/judge-1\/assignments$/,
        status: 200,
        body: {
          assignments: [
            {
              id: "a-1",
              competitionId: "comp-1",
              judgeId: "judge-1",
              fromParticipantNumber: 1,
              toParticipantNumber: 40,
              assignedAt: "2026-10-26T00:00:00.000Z",
              assignedByAccountId: null,
              competitionName: "Spring Open",
            },
          ],
        },
      },
    ]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Permanently delete this judge?")).toBeInTheDocument();
    expect(within(dialog).getByText(/The judge record “Loulou”/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Their login account and every device registered to it/),
    ).toBeInTheDocument();
    // The dialog opens before the ranges are known, so wait for them rather than
    // asserting on the state of the first render.
    await waitFor(() => {
      expect(
        within(dialog).getByText("Spring Open — participants #1–#40"),
      ).toBeInTheDocument();
    });
    expect(
      within(dialog).getByText(/leaves those participants unsupervised/),
    ).toBeInTheDocument();
  });

  it("keeps the confirm button disarmed until the ranges have been read", async () => {
    // `!` is sound: the Promise executor runs synchronously, so this is assigned before
    // the await below can resolve.
    let releaseResolve!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseResolve = resolve;
    });
    global.fetch = jest.fn().mockImplementation((input: unknown, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && LIST_URL.test(url)) {
        return Promise.resolve(jsonResponse(200, { judges: [judge("judge-1", "Loulou", true)] }));
      }
      if (method === "GET" && /\/assignments$/.test(url)) {
        // The warning must not be issued on a guess: while this read is in flight the
        // dialog cannot yet say what will be destroyed, so it cannot offer the button.
        return gate.then(() => jsonResponse(200, { assignments: [] }));
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as unknown as typeof fetch;
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Permanently delete" })).toBeDisabled();

    releaseResolve();
    await waitFor(() => {
      expect(within(dialog).getByRole("button", { name: "Permanently delete" })).toBeEnabled();
    });
  });

  it("says so when the judge holds no range at all", async () => {
    mockFetch([
      {
        method: "GET",
        url: LIST_URL,
        status: 200,
        body: { judges: [judge("judge-1", "Loulou", true)] },
      },
      {
        method: "GET",
        url: /\/api\/judges\/judge-1\/assignments$/,
        status: 200,
        body: { assignments: [] },
      },
    ]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");

    await waitFor(() => {
      expect(
        within(dialog).getByText("They hold no supervision range on any competition."),
      ).toBeInTheDocument();
    });
    expect(within(dialog).queryByText(/Ranges that will be deleted/)).not.toBeInTheDocument();
  });

  it("destroys the judge, reports the name and drops the row from the list", async () => {
    let judges = [judge("judge-1", "Loulou", true), judge("judge-2", "Bob", true)];
    global.fetch = jest.fn().mockImplementation((input: unknown, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && LIST_URL.test(url)) {
        return Promise.resolve(jsonResponse(200, { judges }));
      }
      if (method === "GET" && /\/assignments$/.test(url)) {
        return Promise.resolve(jsonResponse(200, { assignments: [] }));
      }
      if (method === "DELETE" && /\/api\/judges\/judge-1\/permanent$/.test(url)) {
        judges = judges.filter((j) => j.id !== "judge-1");
        return Promise.resolve(
          jsonResponse(200, {
            id: "judge-1",
            name: "Loulou",
            competitions: [],
            assignmentsDeleted: 0,
            accountsDeleted: 1,
          }),
        );
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as unknown as typeof fetch;
    renderPage();

    const rows = await screen.findAllByText(/Loulou|Bob/);
    expect(rows.length).toBeGreaterThan(0);
    const lou = screen.getByText(/^Loulou/).closest("li");
    fireEvent.click(within(lou as HTMLElement).getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByRole("button", { name: "Permanently delete" })).toBeEnabled();
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Permanently delete" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Judge “Loulou” permanently deleted.",
      );
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/^Loulou/)).not.toBeInTheDocument();
    });
  });

  it("reports a failure in the dialog and leaves it open", async () => {
    mockFetch([
      {
        method: "GET",
        url: LIST_URL,
        status: 200,
        body: { judges: [judge("judge-1", "Loulou", true)] },
      },
      {
        method: "GET",
        url: /\/api\/judges\/judge-1\/assignments$/,
        status: 200,
        body: { assignments: [] },
      },
      {
        method: "DELETE",
        url: /\/api\/judges\/judge-1\/permanent$/,
        status: 500,
        body: { error: { code: "error" } },
      },
    ]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByRole("button", { name: "Permanently delete" })).toBeEnabled();
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Permanently delete" }));

    await waitFor(() => {
      expect(
        within(dialog).getByText("The judge could not be deleted. Please try again."),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("list usability", () => {
  /**
   * 120 rows: enough to cross the 50-per-page boundary twice and to prove the count, the
   * filter and the search all read from the same filtered list rather than from each
   * other's stale copy.
   */
  function manyJudges(active: number, inactive: number) {
    return [
      ...Array.from({ length: active }, (_, i) => judge(`a-${i}`, `Active ${i}`, true)),
      ...Array.from({ length: inactive }, (_, i) => judge(`i-${i}`, `Retired ${i}`, false)),
    ];
  }

  it("defaults to active judges, counts them, and pages 50 at a time", async () => {
    mockFetch([
      {
        method: "GET",
        url: LIST_URL,
        status: 200,
        body: { judges: manyJudges(120, 7) },
      },
    ]);
    renderPage();

    await screen.findByText("Active 0");
    expect(screen.getByText("120 of 127 judges")).toBeInTheDocument();
    expect(screen.queryByText("Retired 0")).not.toBeInTheDocument();

    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(50);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Active 50")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(20);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("switches to the deactivated judges and back to all of them", async () => {
    mockFetch([
      {
        method: "GET",
        url: LIST_URL,
        status: 200,
        body: { judges: manyJudges(3, 2) },
      },
    ]);
    renderPage();

    await screen.findByText("Active 0");
    fireEvent.click(screen.getByRole("button", { name: "Deactivated" }));

    await waitFor(() => {
      expect(screen.getByText("Retired 0")).toBeInTheDocument();
    });
    expect(screen.getByText("2 of 5 judges")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => {
      expect(screen.getByText("5 of 5 judges")).toBeInTheDocument();
    });
    expect(screen.getByText("Active 0")).toBeInTheDocument();
    expect(screen.getByText("Retired 0")).toBeInTheDocument();
  });

  it("searches by name, case-insensitively, and says so when nothing matches", async () => {
    mockFetch([
      {
        method: "GET",
        url: LIST_URL,
        status: 200,
        body: { judges: [judge("j-1", "Loulou", true), judge("j-2", "Bob", true)] },
      },
    ]);
    renderPage();

    await screen.findByText("Loulou");
    fireEvent.change(screen.getByPlaceholderText("Search by name"), {
      target: { value: "lou" },
    });

    await waitFor(() => {
      expect(screen.getByText("1 of 2 judges")).toBeInTheDocument();
    });
    expect(screen.getByText("Loulou")).toBeInTheDocument();
    expect(screen.queryByText(/^Bob/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search by name"), {
      target: { value: "nobody" },
    });
    await waitFor(() => {
      expect(screen.getByText("No judge matches this search.")).toBeInTheDocument();
    });
  });

  it("a newly created judge is visible: the search box is cleared and the page reset", async () => {
    let judges = [judge("j-1", "Loulou", true)];
    global.fetch = jest.fn().mockImplementation((input: unknown, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && LIST_URL.test(url)) {
        return Promise.resolve(jsonResponse(200, { judges }));
      }
      if (method === "POST" && LIST_URL.test(url)) {
        const body = JSON.parse(String(init?.body)) as { name: string };
        const created = {
          ...judge("j-2", body.name, true),
          username: "new-judge-x1",
          password: "abcd2345",
        };
        judges = [...judges, created];
        return Promise.resolve(jsonResponse(201, created));
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as unknown as typeof fetch;
    renderPage();

    await screen.findByText("Loulou");
    fireEvent.change(screen.getByPlaceholderText("Search by name"), {
      target: { value: "Loulou" },
    });
    fireEvent.change(screen.getByLabelText("Judge name"), { target: { value: "Newcomer" } });
    fireEvent.click(screen.getByRole("button", { name: "Create judge" }));

    await waitFor(() => {
      expect(screen.getByText("Newcomer")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("Search by name")).toHaveValue("");
  });
});
