import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "../src/i18n/locale-context";
import { BigScreenPage } from "../src/features/big-screen";

/**
 * Unit 11's half of the big screen (BSC-002): the page renders the mode the server
 * pushes on `bigScreen:mode` and never decides one itself. `socket.io-client` is
 * mocked so a test can fire events the way the gateway does.
 */
type Handler = (payload: unknown) => void;

const handlers: Record<string, Handler[]> = {};

jest.mock("socket.io-client", () => ({
  io: () => ({
    on: (event: string, handler: Handler) => {
      (handlers[event] ??= []).push(handler);
    },
    disconnect: () => undefined,
  }),
}));

/** Fire a pushed event the way the gateway would, inside React's act scope. */
function fire(event: string, payload: unknown): void {
  act(() => {
    for (const handler of handlers[event] ?? []) handler(payload);
  });
}

function rankingPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    competitionId: "comp-1",
    categoryId: "cat-1",
    categoryName: "Under 8",
    scope: "INDIVIDUAL",
    isFinal: false,
    pageIndex: 0,
    pageCount: 1,
    rows: [
      {
        rank: 1,
        participantId: "p-1",
        participantName: "Ada",
        score: 100,
        completionTimeSeconds: 300,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  for (const key of Object.keys(handlers)) delete handlers[key];
});

function renderScreen() {
  return render(
    <LocaleProvider initialLocale="en">
      <MemoryRouter initialEntries={["/big-screen/token-1"]}>
        <Routes>
          <Route path="/big-screen/:token" element={<BigScreenPage />} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  );
}

describe("big screen display mode", () => {
  it("shows the paused screen when the controller pauses the display", () => {
    renderScreen();
    fire("bigScreen:mode", {
      competitionId: "comp-1",
      mode: "PAUSED",
      targetId: null,
      rotationEnabled: true,
    });
    // A paused screen replaces even a leaderboard that is already on the wire.
    fire("ranking:update", rankingPayload());
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.queryByText("Ada")).not.toBeInTheDocument();
  });

  it("marks the leaderboard final when the mode is FINAL", () => {
    renderScreen();
    fire("ranking:update", rankingPayload());
    expect(screen.getByText("Provisional")).toBeInTheDocument();
    fire("bigScreen:mode", {
      competitionId: "comp-1",
      mode: "FINAL",
      targetId: null,
      rotationEnabled: false,
    });
    expect(screen.getByText("Final")).toBeInTheDocument();
  });

  it("returns to the ranking when the mode goes back to RANKING", () => {
    renderScreen();
    fire("ranking:update", rankingPayload());
    fire("bigScreen:mode", { competitionId: "comp-1", mode: "PAUSED", targetId: null, rotationEnabled: true });
    expect(screen.getByText("Paused")).toBeInTheDocument();
    fire("bigScreen:mode", { competitionId: "comp-1", mode: "RANKING", targetId: null, rotationEnabled: true });
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });

  it("falls through to the ranking for a mode with no screen yet", () => {
    renderScreen();
    fire("ranking:update", rankingPayload());
    // PLAYER_CLOSEUP/TEAM_SPLIT exist in the schema but have no screen: the display
    // must not go blank because of them.
    fire("bigScreen:mode", {
      competitionId: "comp-1",
      mode: "PLAYER_CLOSEUP",
      targetId: "p-1",
      rotationEnabled: false,
    });
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });
});
