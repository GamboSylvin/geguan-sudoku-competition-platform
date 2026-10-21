import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocaleProvider } from "../src/i18n/locale-context";
import { SchoolPanel } from "../src/features/competition";

/**
 * BLD-052 frontend: the controller's school panel — list, add, rename, remove.
 * `fetch` is mocked; no server is contacted.
 *
 * The case that matters is the guarded delete: a school that still has participants or
 * a team shows its Remove button **disabled** with the reason next to it, rather than
 * letting the click fail. The counts driving that state come from the list itself.
 */

function schoolRow(
  id: string,
  name: string,
  sequence: number,
  participantCount = 0,
  teamCount = 0,
) {
  return { id, name, sequence, participantCount, teamCount };
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

type Route = { method: string; url: RegExp; status: number; body: unknown };

/**
 * Routes are matched on method + URL rather than queued in call order, because the
 * panel reloads the list after every mutation — a queue would hand the list response
 * to the wrong call.
 */
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

function renderPanel() {
  return render(
    <LocaleProvider initialLocale="en">
      <SchoolPanel competitionId="comp-1" />
    </LocaleProvider>,
  );
}

const LIST_URL = /\/api\/competitions\/comp-1\/schools$/;

afterEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe("school panel (BLD-052)", () => {
  it("lists the schools with the counts that decide whether one can be removed", async () => {
    mockFetch([
      {
        method: "GET",
        url: LIST_URL,
        status: 200,
        body: {
          schools: [
            schoolRow("school-1", "First School", 1),
            schoolRow("school-2", "Used School", 2, 3, 1),
          ],
        },
      },
    ]);
    renderPanel();

    expect(await screen.findByText("First School")).toBeInTheDocument();
    expect(screen.getByText("Used School")).toBeInTheDocument();
    expect(screen.getByText(/3 participants/)).toBeInTheDocument();
    expect(screen.getByText(/1 teams/)).toBeInTheDocument();
  });

  it("renames a school and shows the new name", async () => {
    let list = [schoolRow("school-1", "First School", 1)];
    global.fetch = jest.fn().mockImplementation((input: unknown, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET") {
        return Promise.resolve(jsonResponse(200, { schools: list }));
      }
      if (method === "PATCH" && /\/schools\/school-1$/.test(url)) {
        // State changes at request time, so the reload that follows really does serve
        // the updated list — not one frozen before the click.
        const name = (JSON.parse(String(init?.body)) as { name: string }).name;
        list = [schoolRow("school-1", name, 1)];
        return Promise.resolve(jsonResponse(200, list[0]));
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as unknown as typeof fetch;
    renderPanel();

    await screen.findByText("First School");
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("School name"), {
      target: { value: "Renamed School" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Renamed School")).toBeInTheDocument();
    });
    expect(screen.getByText("School renamed")).toBeInTheDocument();
  });

  it("disables Remove and says why while the school still has participants", async () => {
    mockFetch([
      {
        method: "GET",
        url: LIST_URL,
        status: 200,
        body: { schools: [schoolRow("school-1", "Used School", 1, 2, 0)] },
      },
    ]);
    renderPanel();

    await screen.findByText("Used School");

    const remove = screen.getByRole("button", { name: "Remove" });
    expect(remove).toBeDisabled();
    expect(
      screen.getByText("Still has participants — remove them first."),
    ).toBeInTheDocument();
  });

  it("disables Remove and says why while the school still has a team", async () => {
    mockFetch([
      {
        method: "GET",
        url: LIST_URL,
        status: 200,
        body: { schools: [schoolRow("school-1", "Team School", 1, 0, 1)] },
      },
    ]);
    renderPanel();

    await screen.findByText("Team School");

    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(
      screen.getByText("Still has a team — remove it first."),
    ).toBeInTheDocument();
  });

  it("removes an empty school and drops it from the list", async () => {
    let list = [schoolRow("school-1", "Empty School", 1)];
    global.fetch = jest.fn().mockImplementation((input: unknown, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET") {
        return Promise.resolve(jsonResponse(200, { schools: list }));
      }
      if (method === "DELETE" && /\/schools\/school-1$/.test(url)) {
        list = [];
        return Promise.resolve(jsonResponse(204, null));
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as unknown as typeof fetch;
    renderPanel();

    await screen.findByText("Empty School");
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(screen.getByText("No school yet. Add one below.")).toBeInTheDocument();
    });
    expect(screen.getByText("School removed")).toBeInTheDocument();
  });

  it("reports a duplicate name instead of failing silently", async () => {
    mockFetch([
      {
        method: "GET",
        url: LIST_URL,
        status: 200,
        body: { schools: [schoolRow("school-1", "First School", 1)] },
      },
      {
        method: "POST",
        url: LIST_URL,
        status: 409,
        body: { error: { code: "school.nameTaken" } },
      },
    ]);
    renderPanel();

    await screen.findByText("First School");
    fireEvent.change(screen.getByPlaceholderText("School name"), {
      target: { value: "First School" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add school" }));

    await waitFor(() => {
      expect(
        screen.getByText("A school with this name already exists."),
      ).toBeInTheDocument();
    });
  });
});
