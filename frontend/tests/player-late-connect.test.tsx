import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "../src/i18n/locale-context";
import { PlayerPage } from "../src/features/player";

/**
 * Regression for the stuck-on-countdown bug: a player whose socket connects
 * **after** the server has already taken the round to ACTIVE saw the "the round
 * starts in Xs" screen indefinitely, through a full reload, because
 *   - the page started on `{ kind: "waiting" }`, which knows no `roundId`;
 *   - the `connect` handler only did a REST catch-up when the screen was already
 *     `"active" / "resuming" / "rotation" / "partition"` (or a snapshot was set),
 *     so a `"waiting"` screen fired no read at all and stayed without a round;
 *   - `round:preparation-tick` is one event serving **both** countdowns, and the
 *     handler discriminated by local state (`kind === "waiting"` → preparation)
 *     instead of by the payload, so an ACTIVE tick was rendered as a countdown;
 *   - there was no `round:timer-sync` listener at all.
 *
 * What it now does: on connect (and on an ACTIVE tick while still showing a
 * countdown) it asks `GET /api/gameplay/current-round`, which resolves the round
 * from the session alone and answers with its kind, and reads that round through
 * its own endpoint. All three round kinds, no manual reload.
 *
 * The three round screens are stubbed: this test is about *which* screen is
 * reached, not about what the gameplay feature renders (that is its own suite's
 * concern).
 */

type Handler = (payload: unknown) => void;

const handlers: Record<string, Handler[]> = {};
/** Every fetch the page made, as `[method, url]`, so a test can assert the path taken. */
const fetchLog: string[] = [];
/** URL → canned JSON body. A test fills this before rendering. */
const routes: Record<string, unknown> = {};

jest.mock("socket.io-client", () => ({
  io: () => ({
    on: (event: string, handler: Handler) => {
      (handlers[event] ??= []).push(handler);
    },
    disconnect: () => undefined,
  }),
}));

jest.mock("@/features/gameplay", () => ({
  ActiveRoundScreen: ({ roundId }: { roundId: string }) => (
    <div>individual-round-screen:{roundId}</div>
  ),
  RotationRoundScreen: ({ state }: { state: { roundId: string } }) => (
    <div>rotation-round-screen:{state.roundId}</div>
  ),
  PartitionRoundScreen: ({ state }: { state: { roundId: string } }) => (
    <div>partition-round-screen:{state.roundId}</div>
  ),
}));

/** Fire a pushed event the way the gateway would, inside React's act scope. */
function fire(event: string, payload: unknown): void {
  act(() => {
    for (const handler of handlers[event] ?? []) handler(payload);
  });
}

function question(id: string, sequence: number) {
  return {
    id,
    sequence,
    type: "STANDARD",
    gridRows: 9,
    gridColumns: 9,
    regions: [],
    startingGrid: [],
    points: 10,
  };
}

/**
 * One player session, one fetch mock. The socket handshake is simulated by firing
 * `connect` — the page's own `connect` handler is what has to do the catch-up,
 * which is precisely the code path that was broken.
 */
async function mountPlayerAndConnect(): Promise<void> {
  window.localStorage.setItem(
    "sudoku.session",
    JSON.stringify({
      token: "tok-1",
      deviceId: "dev-1",
      role: "PLAYER",
      accountId: "acc-1",
      sessionExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
      // The real event-day login goes through the entry link, which stores the
      // competition the session is scoped to (BLD-055). That field is the page's
      // first knowledge of whose countdown a pushed tick is; a session mounted
      // without it would not be the shape the backend actually issues.
      competitionId: "comp-1",
    }),
  );

  render(
    <LocaleProvider initialLocale="en">
      <MemoryRouter initialEntries={["/player"]}>
        <PlayerPage />
      </MemoryRouter>
    </LocaleProvider>,
  );

  // The handshake completes after the round is already ACTIVE — the scenario
  // under test. Firing it inside `act` runs the page's `connect` handler.
  fire("connect", undefined);

  // Let the discovery read and the follow-up state read resolve.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  for (const key of Object.keys(handlers)) delete handlers[key];
  for (const key of Object.keys(routes)) delete routes[key];
  fetchLog.length = 0;
  window.localStorage.clear();

  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    fetchLog.push(url);
    const body = routes[url];
    if (body === undefined) {
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }
    return { ok: true, status: 200, json: async () => body } as Response;
  });
});

describe("a player connecting after the round already went ACTIVE", () => {
  it("reaches the Individual round screen without a manual reload", async () => {
    routes["http://localhost:3000/api/gameplay/current-round"] = {
      round: {
        roundId: "round-ind",
        competitionId: "comp-1",
        kind: "individual",
        status: "ACTIVE",
        timer: { remainingSeconds: 400, totalSeconds: 600 },
      },
    };
    routes["http://localhost:3000/api/gameplay/round-ind/state"] = {
      roundId: "round-ind",
      competitionId: "comp-1",
      stageId: "stage-1",
      status: "ACTIVE",
      questions: [question("q1", 1)],
      savedGrids: [],
      timer: { remainingSeconds: 400, totalSeconds: 600 },
      participationState: "ACTIVE",
    };

    await mountPlayerAndConnect();

    expect(await screen.findByText("individual-round-screen:round-ind")).toBeInTheDocument();
    expect(screen.queryByText("Competition room")).not.toBeInTheDocument();
    expect(screen.queryByText("Get ready")).not.toBeInTheDocument();
    expect(fetchLog).toContain("http://localhost:3000/api/gameplay/current-round");
    expect(fetchLog).toContain("http://localhost:3000/api/gameplay/round-ind/state");
  });

  it("reaches the Team rotation screen without a manual reload", async () => {
    routes["http://localhost:3000/api/gameplay/current-round"] = {
      round: {
        roundId: "round-rot",
        competitionId: "comp-1",
        kind: "rotation",
        status: "ACTIVE",
        timer: { remainingSeconds: 300, totalSeconds: 900 },
      },
    };
    routes["http://localhost:3000/api/gameplay/rotation/round-rot/state"] = {
      roundId: "round-rot",
      competitionId: "comp-1",
      stageId: "stage-2",
      teamId: "team-1",
      participantId: "p-1",
      hold: { question: question("q1", 1), grid: Array(81).fill(null) },
      totalQuestionCount: 10,
      correctCount: 0,
      teamScore: 0,
      nextRotationAtMs: Date.now() + 60_000,
      rotationPeriodSeconds: 60,
      totalTimeDeadlineMs: Date.now() + 900_000,
      status: "ACTIVE",
      result: null,
    };

    await mountPlayerAndConnect();

    expect(await screen.findByText("rotation-round-screen:round-rot")).toBeInTheDocument();
    expect(screen.queryByText("Competition room")).not.toBeInTheDocument();
    expect(screen.queryByText("Get ready")).not.toBeInTheDocument();
    // The Individual reader would find nothing for a team round (BLD-040): it must
    // not have been called with this round.
    expect(fetchLog).not.toContain("http://localhost:3000/api/gameplay/round-rot/state");
    expect(fetchLog).toContain("http://localhost:3000/api/gameplay/rotation/round-rot/state");
  });

  it("reaches the Team partition screen without a manual reload", async () => {
    routes["http://localhost:3000/api/gameplay/current-round"] = {
      round: {
        roundId: "round-part",
        competitionId: "comp-1",
        kind: "partition",
        status: "ACTIVE",
        timer: { remainingSeconds: 1200, totalSeconds: 1800 },
      },
    };
    routes["http://localhost:3000/api/gameplay/partition/round-part/state"] = {
      roundId: "round-part",
      competitionId: "comp-1",
      stageId: "stage-2",
      teamId: "team-1",
      participantId: "p-1",
      puzzle: question("q1", 1),
      band: { participantId: "p-1", startRow: 0, endRow: 2 },
      grid: Array(81).fill(null),
      puzzleIndex: 0,
      puzzleCount: 3,
      solvedCount: 0,
      teamScore: 0,
      totalTimeDeadlineMs: Date.now() + 1800_000,
      status: "ACTIVE",
      result: null,
    };

    await mountPlayerAndConnect();

    expect(await screen.findByText("partition-round-screen:round-part")).toBeInTheDocument();
    expect(screen.queryByText("Competition room")).not.toBeInTheDocument();
    expect(screen.queryByText("Get ready")).not.toBeInTheDocument();
    expect(fetchLog).not.toContain("http://localhost:3000/api/gameplay/round-part/state");
    expect(fetchLog).toContain("http://localhost:3000/api/gameplay/partition/round-part/state");
  });
});

describe("a tick that belongs to the running round", () => {
  /**
   * The second half of the bug: the one event serving both countdowns. A page
   * sitting on "waiting" that receives an ACTIVE tick must go and read the round,
   * not paint a countdown that has already ended.
   */
  beforeEach(() => {
    routes["http://localhost:3000/api/gameplay/current-round"] = {
      round: {
        roundId: "round-ind",
        competitionId: "comp-1",
        kind: "individual",
        status: "ACTIVE",
        timer: { remainingSeconds: 400, totalSeconds: 600 },
      },
    };
    routes["http://localhost:3000/api/gameplay/round-ind/state"] = {
      roundId: "round-ind",
      competitionId: "comp-1",
      stageId: "stage-1",
      status: "ACTIVE",
      questions: [question("q1", 1)],
      savedGrids: [],
      timer: { remainingSeconds: 400, totalSeconds: 600 },
      participationState: "ACTIVE",
    };
  });

  it("does not render an ACTIVE tick as a preparation countdown", async () => {
    // Nothing running at connect time, so the page legitimately sits on "waiting".
    routes["http://localhost:3000/api/gameplay/current-round"] = { round: null };
    await mountPlayerAndConnect();
    expect(screen.getByText("Competition room")).toBeInTheDocument();

    // The round then goes ACTIVE while the page is up. It missed the push that
    // named the round; only ticks arrive.
    routes["http://localhost:3000/api/gameplay/current-round"] = {
      round: {
        roundId: "round-ind",
        competitionId: "comp-1",
        kind: "individual",
        status: "ACTIVE",
        timer: { remainingSeconds: 599, totalSeconds: 600 },
      },
    };
    fire("round:preparation-tick", {
      roundId: "round-ind",
      stageId: "stage-1",
      competitionId: "comp-1",
      status: "ACTIVE",
      remainingSeconds: 599,
      totalSeconds: 600,
    });

    expect(await screen.findByText("individual-round-screen:round-ind")).toBeInTheDocument();
    expect(screen.queryByText("Get ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Competition room")).not.toBeInTheDocument();
  });

  it("still renders a PREPARATION tick as the countdown", async () => {
    routes["http://localhost:3000/api/gameplay/current-round"] = { round: null };
    await mountPlayerAndConnect();

    fire("round:preparation-tick", {
      roundId: "round-ind",
      stageId: "stage-1",
      competitionId: "comp-1",
      status: "PREPARATION",
      remainingSeconds: 45,
      totalSeconds: 60,
    });

    expect(await screen.findByText("Get ready")).toBeInTheDocument();
    expect(screen.queryByText("Competition room")).not.toBeInTheDocument();
  });

  it("leaves the countdown alone once the round screen is showing", async () => {
    await mountPlayerAndConnect();
    expect(await screen.findByText("individual-round-screen:round-ind")).toBeInTheDocument();

    const callsAfterConnect = fetchLog.length;
    fire("round:preparation-tick", {
      roundId: "round-ind",
      stageId: "stage-1",
      competitionId: "comp-1",
      status: "ACTIVE",
      remainingSeconds: 399,
      totalSeconds: 600,
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Already on the right screen: an ACTIVE tick must not trigger another
    // discovery read (it arrives four times a second).
    expect(fetchLog.length).toBe(callsAfterConnect);
    expect(screen.getByText("individual-round-screen:round-ind")).toBeInTheDocument();
  });
});

describe("round:timer-sync", () => {
  it("takes a page still on the waiting screen to the running round", async () => {
    routes["http://localhost:3000/api/gameplay/current-round"] = { round: null };
    await mountPlayerAndConnect();
    expect(screen.getByText("Competition room")).toBeInTheDocument();

    routes["http://localhost:3000/api/gameplay/current-round"] = {
      round: {
        roundId: "round-ind",
        competitionId: "comp-1",
        kind: "individual",
        status: "ACTIVE",
        timer: { remainingSeconds: 600, totalSeconds: 600 },
      },
    };
    routes["http://localhost:3000/api/gameplay/round-ind/state"] = {
      roundId: "round-ind",
      competitionId: "comp-1",
      stageId: "stage-1",
      status: "ACTIVE",
      questions: [question("q1", 1)],
      savedGrids: [],
      timer: { remainingSeconds: 600, totalSeconds: 600 },
      participationState: "ACTIVE",
    };

    // `round:timer-sync` carries `status` outright, so the page does not have to
    // infer ACTIVE from a countdown it never saw start.
    fire("round:timer-sync", {
      roundId: "round-ind",
      competitionId: "comp-1",
      status: "ACTIVE",
      mode: "round",
      remainingSeconds: 600,
      totalSeconds: 600,
    });

    expect(await screen.findByText("individual-round-screen:round-ind")).toBeInTheDocument();
    expect(screen.queryByText("Competition room")).not.toBeInTheDocument();
  });
});

describe("no round running", () => {
  it("stays on the waiting screen instead of failing", async () => {
    routes["http://localhost:3000/api/gameplay/current-round"] = { round: null };
    await mountPlayerAndConnect();

    await waitFor(() => {
      expect(fetchLog).toContain("http://localhost:3000/api/gameplay/current-round");
    });
    expect(screen.getByText("Competition room")).toBeInTheDocument();
    // `round: null` is an answer, not an error: nothing may be reported.
    expect(screen.queryByText("Something went wrong. Please try again.")).not.toBeInTheDocument();
  });

  /**
   * A1b (2026-10-23). The gateway pushes `round:preparation-tick` to **every** player
   * in the namespace, not per competition (`gateway.ts`), so the payload carries
   * `competitionId` and the page has to filter on it. Two competitions live at once is
   * the event-day shape: without the filter, a tablet sitting on competition A's
   * waiting screen rendered competition B's remaining seconds. This is the automated
   * half of that proof — the other half is the two genuinely published competitions in
   * `backend/a1-check.ts`.
   */
  it("ignores a preparation tick belonging to another competition", async () => {
    routes["http://localhost:3000/api/gameplay/current-round"] = { round: null };
    await mountPlayerAndConnect();
    expect(screen.getByText("Competition room")).toBeInTheDocument();

    const callsBefore = fetchLog.length;
    fire("round:preparation-tick", {
      roundId: "round-other",
      stageId: "stage-other",
      competitionId: "comp-OTHER",
      status: "PREPARATION",
      remainingSeconds: 45,
      totalSeconds: 60,
    });

    // Not rendered: still on waiting, and no discovery read was triggered by it either
    // (a foreign tick is noise, not a signal that our own round may have started).
    expect(screen.getByText("Competition room")).toBeInTheDocument();
    expect(screen.queryByText("Get ready")).not.toBeInTheDocument();
    expect(fetchLog.length).toBe(callsBefore);
  });

  it("accepts the tick of its own competition right after ignoring a foreign one", async () => {
    routes["http://localhost:3000/api/gameplay/current-round"] = { round: null };
    await mountPlayerAndConnect();

    fire("round:preparation-tick", {
      roundId: "round-other",
      stageId: "stage-other",
      competitionId: "comp-OTHER",
      status: "PREPARATION",
      remainingSeconds: 45,
      totalSeconds: 60,
    });
    fire("round:preparation-tick", {
      roundId: "round-ind",
      stageId: "stage-1",
      competitionId: "comp-1",
      status: "PREPARATION",
      remainingSeconds: 20,
      totalSeconds: 60,
    });

    expect(await screen.findByText("Get ready")).toBeInTheDocument();
  });
});
