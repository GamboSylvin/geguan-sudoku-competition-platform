import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "../src/i18n/locale-context";
import { PlayerPage } from "../src/features/player";

/**
 * BLD-058: the platform is bilingual, but a player logged in on `/player` had no way
 * to change language — BLD-053's fixed switcher renders `null` on that route, on the
 * reasoning that flipping every string mid-grid would be a bad surprise.
 *
 * The compromise implemented here is a control of the player's own, present while
 * choosing is still safe (the waiting and preparation phases) and **absent** once the
 * round is running. Absence rather than disabling, for the same reason BLD-053 chose
 * it: a greyed-out button on a tablet invites repeated taps and explains nothing.
 *
 * The project owner added one requirement of her own: an explicit notice telling the
 * student to pick their language *before* the competition starts, because afterwards
 * it is no longer possible. That text is asserted here in both locales, since a notice
 * nobody can read is not a notice.
 */

type Handler = (payload: unknown) => void;

const handlers: Record<string, Handler[]> = {};
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
  RotationRoundScreen: () => <div>rotation-round-screen</div>,
  PartitionRoundScreen: () => <div>partition-round-screen</div>,
}));

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

/** One player session, mounted and connected. Which phase it lands in is the routes' doing. */
async function mountPlayer(): Promise<void> {
  window.localStorage.setItem(
    "sudoku.session",
    JSON.stringify({
      token: "tok-1",
      deviceId: "dev-1",
      role: "PLAYER",
      accountId: "acc-1",
      sessionExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
      // The real event-day login goes through the entry link, which stores the
      // competition the session is scoped to (BLD-055). The page reads that field
      // before any HTTP answer to know whose countdown a pushed tick is, so a
      // session mounted without it is not the shape the backend issues.
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

  fire("connect", undefined);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Canned answers for a round already ACTIVE, so the page goes straight to gameplay. */
function stubActiveIndividualRound(): void {
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
}

beforeEach(() => {
  for (const key of Object.keys(handlers)) delete handlers[key];
  for (const key of Object.keys(routes)) delete routes[key];
  window.localStorage.clear();

  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = routes[url];
    if (body === undefined) {
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }
    return { ok: true, status: 200, json: async () => body } as Response;
  });
});

describe("the player's own language control (BLD-058)", () => {
  it("is on the waiting screen, with the notice saying it will not be possible later", async () => {
    routes["http://localhost:3000/api/gameplay/current-round"] = { round: null };
    await mountPlayer();

    expect(screen.getByText("Competition room")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Language / 语言" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "中文" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.getByText(
        "Choose your language now — you will not be able to change it once the round starts.",
      ),
    ).toBeInTheDocument();
  });

  it("stays on the preparation screen, the last phase where choosing is safe", async () => {
    routes["http://localhost:3000/api/gameplay/current-round"] = { round: null };
    await mountPlayer();

    fire("round:preparation-tick", {
      roundId: "round-ind",
      stageId: "stage-1",
      competitionId: "comp-1",
      status: "PREPARATION",
      remainingSeconds: 45,
      totalSeconds: 60,
    });

    expect(await screen.findByText("Get ready")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Language / 语言" })).toBeInTheDocument();
  });

  it("disappears once the round is running — absent, not disabled", async () => {
    stubActiveIndividualRound();
    await mountPlayer();

    expect(await screen.findByText("individual-round-screen:round-ind")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Language / 语言" })).not.toBeInTheDocument();
    // Not greyed out either: there is no button left to press.
    expect(screen.queryByRole("button", { name: "中文" })).not.toBeInTheDocument();
  });

  it("changes the language the player sees, and remembers the choice", async () => {
    routes["http://localhost:3000/api/gameplay/current-round"] = { round: null };
    await mountPlayer();

    const chinese = screen.getByRole("button", { name: "中文" });
    act(() => {
      chinese.click();
    });

    // The whole page follows, not just the control: the waiting title is now Chinese.
    expect(await screen.findByText("比赛等候室")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "中文" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The notice is translated too — a warning in a language the student did not pick
    // is not a warning.
    expect(
      screen.getByText("请现在选择语言——比赛开始后将无法更改。"),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("sudoku-arena.locale")).toBe("zh");
  });
});
