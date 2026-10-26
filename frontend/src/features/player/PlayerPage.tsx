/**
 * The player's round-runtime page (Unit 07). Connects the realtime socket,
 * listens for the round lifecycle events, and renders the right screen for the
 * round's current state: competition room (waiting), preparation (rules +
 * countdown), active round (delegated to `features/gameplay`), paused, and
 * resuming ("3, 2, 1, Start").
 *
 * The page is deliberately simple: the server owns the round state and the
 * timer; this page only mirrors what the server pushes and what the reconnect
 * endpoint returns. There is no local round-state machine beyond "which payload
 * arrived most recently".
 *
 * Visual: mood C, "dark, large, readable" (BLD-054). This is the screen of a tablet
 * lying on a competition table: `bg-gray-900` background, white text, a giant
 * countdown in `tabular-nums` (figures compared at a glance, §3.5). The preparation
 * rules card, which used to be white, moves to the report's dark panel
 * (`bg-gray-800 rounded-lg p-4`): the repository never mixes a white card into a
 * dark screen (§4). No white anywhere on this page — the round screens delegated to
 * `features/gameplay` follow the same mood.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "@/config/env";
import { useLocale } from "@/i18n/locale-context";
import { InlineLanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { loadSession, landingPath, setEntryToken, setEntryRoleHint } from "@/features/auth/session";
import { ActiveRoundScreen, PartitionRoundScreen, RotationRoundScreen } from "@/features/gameplay";
import type { PartitionViewState, RotationViewState } from "@/features/gameplay";

/** Mirrors the backend's round payload shapes; the wire contract is the backend's. */
interface RoundQuestionPayload {
  id: string;
  sequence: number;
  type: "STANDARD" | "VARIANT";
  gridRows: number;
  gridColumns: number;
  regions: unknown;
  startingGrid: unknown;
  points: number;
}

interface PreparationTickPayload {
  roundId: string;
  stageId: string;
  competitionId: string;
  /**
   * Which countdown this tick belongs to — one event serves both, so the server
   * says. Reading this instead of the local screen is what keeps a player who
   * connects after the round went ACTIVE from being shown a countdown that has
   * already ended.
   */
  status: "WAITING" | "PREPARATION" | "ACTIVE" | "PAUSED" | "FINISHED";
  remainingSeconds: number;
  totalSeconds: number;
}

/**
 * The payload pushed on `round:timer-sync`, at each timer start. Carries `status`,
 * so it says PREPARATION vs ACTIVE outright instead of leaving the client to infer
 * it from its own screen.
 */
interface TimerSyncPayload {
  roundId: string;
  competitionId: string;
  status: "WAITING" | "PREPARATION" | "ACTIVE" | "PAUSED" | "FINISHED";
  mode: "preparation" | "round";
  remainingSeconds: number;
  totalSeconds: number;
}

/**
 * What `GET /api/gameplay/current-round` returns. This is how a socket that
 * connects after the round already started learns which round it is in: the push
 * that names it (`round:started`, `rotation:deal`, `partition:deal`) fires once, at
 * the transition, and the ticks cannot substitute for it because they go to the
 * whole player namespace and therefore also carry other competitions' rounds.
 */
interface CurrentRoundPayload {
  round: {
    roundId: string;
    competitionId: string;
    kind: "individual" | "rotation" | "partition";
    status: "WAITING" | "PREPARATION" | "ACTIVE" | "PAUSED" | "FINISHED";
    timer: { remainingSeconds: number; totalSeconds: number } | null;
  } | null;
}

/**
 * What `GET /api/gameplay/competition` returns: which competition this session is
 * in, who the caller is inside it, and what is coming.
 *
 * This is the waiting screen's only source of a name. The entry token that carried
 * the competition id is consumed and deleted by exactly one login, the stored
 * session never held one, and a player session can reach nothing outside the
 * gameplay module — so before this route existed the screen could show only two
 * static strings. Every field is nullable except `programme`; null renders as the
 * bare waiting screen rather than an error, because "nothing has started yet" is
 * the normal state here, not a failure.
 */
interface MyCompetitionPayload {
  competition: {
    id: string;
    name: string;
    description: string | null;
    status: string;
  } | null;
  participant: {
    name: string;
    participantNumber: number;
    individualEvent: boolean;
    teamEvent: boolean;
  } | null;
  category: { id: string; code: string; name: string } | null;
  school: { name: string } | null;
  programme: {
    stageId: string;
    stageType: "INDIVIDUAL" | "TEAM";
    stageSequence: number;
    stageStatus: "WAITING" | "PREPARATION" | "ACTIVE" | "PAUSED" | "FINISHED";
    rounds: {
      roundId: string;
      name: string;
      sequence: number;
      status: "WAITING" | "PREPARATION" | "ACTIVE" | "PAUSED" | "FINISHED";
      kind: "individual" | "rotation" | "partition";
      totalSeconds: number | null;
    }[];
  }[];
}

interface RoundStartedPayload {
  roundId: string;
  stageId: string;
  competitionId: string;
  /**
   * The category this payload was built for. The server emits one payload per
   * category, each to only that category's room, so a socket never receives one that
   * is not its own — the field is here to keep the client's type honest about what is
   * on the wire, not to filter with (a client-side filter would still mean another
   * category's questions crossed the connection).
   */
  categoryId: string;
  durationSeconds: number;
  questions: RoundQuestionPayload[];
}

interface RoundPausedPayload {
  roundId: string;
  competitionId: string;
  pausedRemainingSeconds: number;
}

interface RoundResumedPayload {
  roundId: string;
  competitionId: string;
  resumesAtMs: number;
  resumeCountdownSeconds: number;
  pausedRemainingSeconds: number;
}

/**
 * Unit 13: the three rotation pushes, all addressed to this one tablet's room.
 * `deal` and `rotated` share a shape — one client handler covers the initial deal,
 * the timed rotation, the post-submit refill and the stale-hold refresh.
 */
interface RotationPushPayload {
  roundId: string;
  competitionId: string;
  stageId: string;
  teamId: string;
  participantId: string;
  hold: { question: RoundQuestionPayload; grid: (number | null)[] } | null;
  totalQuestionCount: number;
  correctCount: number;
  teamScore: number;
  nextRotationAtMs: number;
  rotationPeriodSeconds: number;
  totalTimeDeadlineMs: number | null;
  /** Only on `rotation:rotated`. */
  reason?: "ROTATION" | "REFILL" | "STALE_HOLD" | "RECONNECT";
}

interface RotationEndedPushPayload {
  roundId: string;
  competitionId: string;
  stageId: string;
  teamId: string;
  reason: "ALL_CORRECT" | "TIME_LIMIT";
  correctCount: number;
  score: number;
  completionTimeSeconds: number | null;
}

/** What `GET /api/gameplay/rotation/:roundId/state` returns for this tablet. */
interface RotationTabletStatePayload extends Omit<RotationPushPayload, "reason"> {
  status: "ACTIVE" | "FINISHED";
  result: RotationEndedPushPayload | null;
}

/** Map any of the three rotation sources onto the screen's one view state. */
function toRotationViewState(
  payload: RotationPushPayload | RotationTabletStatePayload,
  ended: RotationEndedPushPayload | null,
  reason?: RotationPushPayload["reason"],
): RotationViewState {
  return {
    roundId: payload.roundId,
    teamId: payload.teamId,
    hold: payload.hold,
    totalQuestionCount: payload.totalQuestionCount,
    correctCount: payload.correctCount,
    teamScore: payload.teamScore,
    nextRotationAtMs: payload.nextRotationAtMs,
    rotationPeriodSeconds: payload.rotationPeriodSeconds,
    totalTimeDeadlineMs: payload.totalTimeDeadlineMs,
    ended: ended
      ? {
          reason: ended.reason,
          correctCount: ended.correctCount,
          score: ended.score,
          completionTimeSeconds: ended.completionTimeSeconds,
        }
      : null,
    rotatedReason: reason,
  };
}

/**
 * Unit 14: the two partition pushes, also addressed to this one tablet's room.
 * `deal` and `puzzle-solved` share a shape — one client handler covers the initial
 * deal, the advance to the next puzzle and the reconnect refresh.
 */
interface PartitionPushPayload {
  roundId: string;
  competitionId: string;
  stageId: string;
  teamId: string;
  participantId: string;
  puzzle: RoundQuestionPayload | null;
  band: { participantId: string; startRow: number; endRow: number } | null;
  grid: (number | null)[];
  puzzleIndex: number;
  puzzleCount: number;
  solvedCount: number;
  teamScore: number;
  totalTimeDeadlineMs: number;
  reason?: "DEAL" | "PUZZLE_SOLVED" | "RECONNECT";
}

interface PartitionEndedPushPayload {
  roundId: string;
  competitionId: string;
  stageId: string;
  teamId: string;
  reason: "ALL_SOLVED" | "TIME_LIMIT";
  solvedCount: number;
  score: number;
  completionTimeSeconds: number | null;
}

/** What `GET /api/gameplay/partition/:roundId/state` returns for this tablet. */
interface PartitionTabletStatePayload extends Omit<PartitionPushPayload, "reason"> {
  status: "ACTIVE" | "FINISHED";
  result: PartitionEndedPushPayload | null;
}

/** Map any of the three partition sources onto the screen's one view state. */
function toPartitionViewState(
  payload: PartitionPushPayload | PartitionTabletStatePayload,
  ended: PartitionEndedPushPayload | null,
  reason?: PartitionPushPayload["reason"],
): PartitionViewState {
  return {
    roundId: payload.roundId,
    teamId: payload.teamId,
    participantId: payload.participantId,
    puzzle: payload.puzzle,
    band: payload.band,
    grid: payload.grid,
    puzzleIndex: payload.puzzleIndex,
    puzzleCount: payload.puzzleCount,
    solvedCount: payload.solvedCount,
    teamScore: payload.teamScore,
    totalTimeDeadlineMs: payload.totalTimeDeadlineMs,
    ended: ended
      ? {
          reason: ended.reason,
          solvedCount: ended.solvedCount,
          score: ended.score,
          completionTimeSeconds: ended.completionTimeSeconds,
        }
      : null,
    solvedReason: reason,
  };
}

interface GameplayStatePayload {
  roundId: string;
  competitionId: string;
  stageId: string;
  status: "WAITING" | "PREPARATION" | "ACTIVE" | "PAUSED" | "FINISHED";
  questions: RoundQuestionPayload[];
  savedGrids: { questionId: string; grid: (number | null)[]; savedAtMs: number }[];
  timer: { remainingSeconds: number; totalSeconds: number } | null;
  /** Unit 08: server-reported state of this player's participation. */
  participationState: "WAITING" | "ACTIVE" | "SUBMITTED" | "AUTO_SUBMITTED" | "RESTARTED";
}

type ScreenState =
  | { kind: "waiting" }
  | { kind: "preparation"; remainingSeconds: number; totalSeconds: number }
  | {
      kind: "active";
      roundId: string;
      competitionId: string;
      durationSeconds: number;
      questions: RoundQuestionPayload[];
      savedGrids: GameplayStatePayload["savedGrids"];
      participationState: GameplayStatePayload["participationState"];
    }
  /**
   * The Team stage's rotation round (Unit 13). One held question at a time, which
   * the server replaces wholesale on every push — there is nothing to merge here.
   */
  | { kind: "rotation"; state: RotationViewState }
  /**
   * The Team stage's partition round (Unit 14). One shared puzzle with only this
   * member's row-band editable; the server replaces the whole view on every push.
   */
  | { kind: "partition"; state: PartitionViewState }
  | { kind: "paused"; pausedRemainingSeconds: number }
  | {
      kind: "resuming";
      resumesAtMs: number;
      resumeCountdownSeconds: number;
      pausedRemainingSeconds: number;
      activeSnapshot: {
        roundId: string;
        competitionId: string;
        durationSeconds: number;
        questions: RoundQuestionPayload[];
        savedGrids: GameplayStatePayload["savedGrids"];
        participationState: GameplayStatePayload["participationState"];
      } | null;
      /** Unit 13: the rotation screen to return to, when this is a team round 1. */
      rotationSnapshot: RotationViewState | null;
      /** Unit 14: the partition screen to return to, when this is a team round 2. */
      partitionSnapshot: PartitionViewState | null;
    };

export function PlayerPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = useMemo(() => loadSession(), []);
  const [screen, setScreen] = useState<ScreenState>({ kind: "waiting" });
  const [error, setError] = useState<string | null>(null);
  /**
   * Which competition this session is in, and who the caller is inside it
   * (report 2026-10-19, hole A). Read once on mount, from the session alone —
   * the entry token that carried the competition id was consumed at login and
   * the stored session never held one, so this fetch is the only way the
   * waiting screen can name the event.
   *
   * Null means "not loaded yet" *and* "the server had nothing to say"; both
   * render as the bare waiting screen, which is what it used to show anyway.
   */
  const [myCompetition, setMyCompetition] = useState<MyCompetitionPayload | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeSnapshotRef = useRef<ScreenState | null>(null);
  /**
   * The Team stage's equivalent (Unit 13). A pause is not a round change, so the
   * tablet must come back to the same held question — the server keeps the hold
   * while paused, and the rotation tick re-arms rather than firing.
   */
  const rotationSnapshotRef = useRef<RotationViewState | null>(null);
  /**
   * The partition round's equivalent (Unit 14). A pause must return the tablet to
   * the same shared puzzle and the same band — and the band grid is local-only
   * until the next autosave, so losing it would lose typed digits.
   */
  const partitionSnapshotRef = useRef<PartitionViewState | null>(null);
  /**
   * A mirror of `screen` readable from the socket callbacks. The reconnect handler
   * needs the current round to re-read, but a state updater must stay pure — it
   * cannot own a fetch — so it reads this instead.
   */
  const screenRef = useRef<ScreenState>({ kind: "waiting" });
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  /**
   * A mirror of this session's own competition id, readable from the socket
   * callbacks. `round:preparation-tick` is pushed to the whole player namespace,
   * so its payload also carries every *other* competition's countdown — without
   * this filter a player in competition A renders competition B's "starts in Xs".
   * Null until something has named it; a null mirror means "we do not know whose
   * countdown this is yet", so the tick is ignored rather than trusted.
   *
   * **Seeded from the session, not waited for over HTTP.** An entry-link login
   * stores the competition it was scoped to (`session.competitionId`, BLD-055), so
   * the mirror is known before the first tick can arrive. `GET
   * /api/gameplay/competition` and the discovery call still refresh it, but they are
   * now a second source, not the only one — depending on them alone meant a failed
   * or slow request left every tick unattributable, which reproduces exactly the
   * symptom A1 was fixed for (a player watching nothing move). A plain login with no
   * entry link carries `null`, and stays on the discovery fallback.
   */
  const myCompetitionIdRef = useRef<string | null>(session?.competitionId ?? null);

  /**
   * The entry link's token (report §9c, ARCH-030: the competition link *identifies the
   * competition*). A player opens `/player?token=…` from the printed slip; the token is
   * remembered in `sessionStorage` so the login screen can pass it along, and the page
   * then redirects to login — the gate below does that.
   *
   * Deliberately NOT treated as a credential: the username and password are still
   * required, and the token only names the competition. Whether a bare token should be
   * enough to get in is an open project-owner decision (§9d scope note), so the safe
   * reading is built.
   *
   * Captured on mount, before the redirect, so the hop to `/login` cannot lose it. The role
   * hint is captured with it: this path is player-only, so the login page can preselect
   * "player" and save a tablet one tap. The unified `/enter?token=…` link deliberately sets
   * no hint — one address serves both roles there (hole D, 2026-10-20).
   */
  useEffect(() => {
    const token = searchParams.get("token");
    if (token !== null && token !== "") {
      setEntryToken(token);
      setEntryRoleHint("player");
    }
  }, [searchParams]);

  /**
   * Gate: a player session only. Without a session this goes to `/login` — it used to
   * navigate to the player's own landing route, which is this route, so an unauthenticated
   * player arriving on the entry link sat on a blank waiting screen instead of being asked
   * to log in. A session of another role goes to that role's landing.
   */
  useEffect(() => {
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }
    if (session.role !== "PLAYER") {
      navigate(landingPath(session.role), { replace: true });
    }
  }, [session, navigate]);

  /**
   * Load "which competition am I in" once, on mount, for a player session only.
   *
   * Read once, not polled: the competition's name, the caller's category and the
   * programme's *shape* do not change while a student sits on the waiting screen.
   * Each round's live status does change, but that is the socket's job — it
   * already pushes every transition, and re-fetching the whole competition four
   * times a second to catch them would be pure waste. So a round that starts
   * after mount is reflected by the push that also swaps the screen; the status
   * shown in the programme list is a best-effort snapshot, and the screen the
   * student actually lands on comes from the push.
   *
   * A failure here is silent: the waiting screen still renders, just without the
   * greeting. Surfacing an error banner would replace one readable screen with
   * one that says a network call failed, which is not more useful to a student.
   */
  useEffect(() => {
    if (!session || session.role !== "PLAYER") return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/gameplay/competition`, {
          headers: {
            "x-session-token": session.token,
            "x-device-id": session.deviceId,
          },
        });
        if (!response.ok) return;
        const payload = (await response.json()) as MyCompetitionPayload;
        // Fill the competition mirror as early as possible: the socket is already
        // connected, and a countdown tick that arrives before this line is a tick
        // we cannot attribute to this player. A ref write is not a state update, so
        // it does not need the `cancelled` guard.
        if (payload.competition?.id) {
          myCompetitionIdRef.current = payload.competition.id;
        }
        if (!cancelled) setMyCompetition(payload);
      } catch {
        // Left on the bare waiting screen; see the comment above.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Pull the current state once on mount so a player who joins mid-round (or
  // returns after a disconnect) renders the right screen without waiting for
  // the next push.
  const refreshState = useCallback(
    async (roundId: string) => {
      if (!session) return;
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/gameplay/${roundId}/state`,
          {
            headers: {
              "x-session-token": session.token,
              "x-device-id": session.deviceId,
            },
          },
        );
        if (!response.ok) return;
        const state = (await response.json()) as GameplayStatePayload;
        if (state.status === "ACTIVE" && state.questions.length > 0) {
          setScreen({
            kind: "active",
            roundId: state.roundId,
            competitionId: state.competitionId,
            durationSeconds: state.timer?.totalSeconds ?? 0,
            questions: state.questions,
            savedGrids: state.savedGrids,
            participationState: state.participationState,
          });
        } else if (state.status === "PREPARATION" && state.timer) {
          setScreen({
            kind: "preparation",
            remainingSeconds: state.timer.remainingSeconds,
            totalSeconds: state.timer.totalSeconds,
          });
        } else if (state.status === "PAUSED" && state.timer) {
          setScreen({ kind: "paused", pausedRemainingSeconds: state.timer.remainingSeconds });
        }
      } catch {
        setError(t("player.genericError"));
      }
    },
    [session, t],
  );

  /**
   * The rotation round's own reconnect read (Unit 13). `GET /:roundId/state`
   * cannot serve a team round: its questions are drawn from the category pool and
   * never carry a `roundId` (BLD-040), so that endpoint finds nothing. This one
   * returns exactly what this tablet holds right now, plus the settled result if
   * the round already ended while the tablet was away.
   */
  const refreshRotationState = useCallback(
    async (roundId: string) => {
      if (!session) return;
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/gameplay/rotation/${roundId}/state`,
          {
            headers: {
              "x-session-token": session.token,
              "x-device-id": session.deviceId,
            },
          },
        );
        if (!response.ok) return;
        const state = (await response.json()) as RotationTabletStatePayload;
        setScreen({
          kind: "rotation",
          state: toRotationViewState(state, state.result, "RECONNECT"),
        });
      } catch {
        setError(t("player.genericError"));
      }
    },
    [session, t],
  );

  /**
   * The partition round's own reconnect read (Unit 14), for the same reason: this
   * round's puzzles come from the category pool and carry no `roundId` (BLD-040).
   * Returns the combined grid, this member's band and the settled result if the
   * round already ended while the tablet was away.
   */
  const refreshPartitionState = useCallback(
    async (roundId: string) => {
      if (!session) return;
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/gameplay/partition/${roundId}/state`,
          {
            headers: {
              "x-session-token": session.token,
              "x-device-id": session.deviceId,
            },
          },
        );
        if (!response.ok) return;
        const state = (await response.json()) as PartitionTabletStatePayload;
        setScreen({
          kind: "partition",
          state: toPartitionViewState(state, state.result, "RECONNECT"),
        });
      } catch {
        setError(t("player.genericError"));
      }
    },
    [session, t],
  );

  /**
   * Ask the server which round this player is in, then read that round through its
   * own reconnect endpoint. Called on connect when the local screen knows no round,
   * and when a tick says the round is ACTIVE while this page is still showing a
   * countdown — i.e. whenever the push that named the round was missed.
   *
   * The three kinds have three readers, which is why the server answers with `kind`:
   * a team round's questions come from the category pool and carry no `roundId`
   * (BLD-040), so `GET /:roundId/state` finds nothing for one.
   *
   * Guarded against overlapping calls: the tick that triggers this arrives four
   * times a second, and one discovery read is enough.
   */
  const discoveryInFlightRef = useRef(false);
  const discoverCurrentRound = useCallback(async () => {
    if (!session || discoveryInFlightRef.current) return;
    discoveryInFlightRef.current = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/gameplay/current-round`, {
        headers: {
          "x-session-token": session.token,
          "x-device-id": session.deviceId,
        },
      });
      if (!response.ok) return;
      const payload = (await response.json()) as CurrentRoundPayload;
      const round = payload.round;
      // No round running: the waiting screen is the correct answer, not a failure.
      if (!round) return;
      // This round is resolved from the session, so it is by construction this
      // player's own competition. Remember the id: it is what filters the
      // namespace-wide countdown pushes below.
      myCompetitionIdRef.current = round.competitionId;
      if (round.kind === "rotation") {
        await refreshRotationState(round.roundId);
        return;
      }
      if (round.kind === "partition") {
        await refreshPartitionState(round.roundId);
        return;
      }
      // A round still counting down has no questions and no participation row yet,
      // so the state read cannot be the source of the countdown screen. Render it
      // from the timer this discovery call already carries — otherwise a player who
      // connects during PREPARATION goes through a read that answers with no
      // questions and stays on the waiting screen until the round goes ACTIVE.
      if (round.status === "PREPARATION" && round.timer) {
        setScreen({
          kind: "preparation",
          remainingSeconds: round.timer.remainingSeconds,
          totalSeconds: round.timer.totalSeconds,
        });
        return;
      }
      await refreshState(round.roundId);
    } catch {
      setError(t("player.genericError"));
    } finally {
      discoveryInFlightRef.current = false;
    }
  }, [session, t, refreshState, refreshRotationState, refreshPartitionState]);

  useEffect(() => {
    if (!session || session.role !== "PLAYER") return;

    const socket = io(`${API_BASE_URL}/player`, {
      auth: { token: session.token, deviceId: session.deviceId },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("round:preparation-tick", (payload: PreparationTickPayload) => {
      // The push goes to every connected player, so it also carries other
      // competitions' countdowns. Rendering one of those would show a player a
      // countdown that is not theirs. The mirror is filled by
      // `GET /api/gameplay/competition` and by the discovery call below; until one
      // of them has answered we do not know whose tick this is, so ignore it.
      if (myCompetitionIdRef.current === null) {
        // We cannot attribute this tick yet — neither the mount-time competition
        // read nor a discovery call has answered. Do not render it (it may belong
        // to another competition); resolve our own round instead, which fills the
        // mirror. Guarded against overlaps by `discoveryInFlightRef`, and the tick
        // arrives four times a second, so this settles on the first one.
        void discoverCurrentRound();
        return;
      }
      if (myCompetitionIdRef.current !== payload.competitionId) return;
      // One event serves both countdowns, so the payload's `status` is what says
      // which one this is — not this page's current screen. Guessing from the local
      // screen is exactly what stuck a late-connecting player on "the round starts in
      // Xs" forever: it was showing `"waiting"`, an ACTIVE tick arrived, and the old
      // handler treated any tick as preparation.
      if (payload.status === "ACTIVE") {
        // The round is running. If this page does not know that yet, it missed the
        // push that named the round — go and read it.
        const current = screenRef.current;
        if (current.kind === "waiting" || current.kind === "preparation") {
          void discoverCurrentRound();
        }
        return;
      }
      if (payload.status !== "PREPARATION") return;
      setScreen((current) => {
        // Only the preparation screen consumes these ticks; once the round has
        // started we ignore them (the round timer's tick is rendered inside the
        // active screen via its own cosmetic countdown).
        if (current.kind === "preparation" || current.kind === "waiting") {
          return {
            kind: "preparation",
            remainingSeconds: payload.remainingSeconds,
            totalSeconds: payload.totalSeconds,
          };
        }
        return current;
      });
    });

    // `round:timer-sync` carries `status` and `roundId` and is emitted at each timer
    // start. It is not the discovery path for a late joiner — it fires once, at the
    // transition, so a socket that connects afterwards never sees it — but a page
    // that is up and watching gets told plainly that the round went ACTIVE, without
    // waiting for the next tick or for the questions push.
    socket.on("round:timer-sync", (payload: TimerSyncPayload) => {
      if (payload.status !== "ACTIVE") return;
      const current = screenRef.current;
      if (current.kind === "waiting" || current.kind === "preparation") {
        void discoverCurrentRound();
      }
    });

    socket.on("round:started", (payload: RoundStartedPayload) => {
      setScreen({
        kind: "active",
        roundId: payload.roundId,
        competitionId: payload.competitionId,
        durationSeconds: payload.durationSeconds,
        questions: payload.questions,
        savedGrids: [],
        // A round:started broadcast always lands on a fresh ACTIVE
        // participation for every player in the round; nothing has been
        // submitted yet.
        participationState: "ACTIVE",
      });
    });

    socket.on("round:paused", (payload: RoundPausedPayload) => {
      // Snapshot the screen we are leaving so a resume can return to it. Read via
      // the mirror, not from inside the updater — writing a ref there would be a
      // side effect in what must stay a pure function.
      const current = screenRef.current;
      if (current.kind === "active") {
        activeSnapshotRef.current = current;
      } else if (current.kind === "rotation") {
        rotationSnapshotRef.current = current.state;
        // Only one team round is ever on screen at a time, and the Team stage has
        // two of them in sequence. Clearing the sibling keeps a resume from
        // restoring round 1's held question while round 2 is running.
        partitionSnapshotRef.current = null;
      } else if (current.kind === "partition") {
        partitionSnapshotRef.current = current.state;
        rotationSnapshotRef.current = null;
      }
      setScreen({ kind: "paused", pausedRemainingSeconds: payload.pausedRemainingSeconds });
    });

    socket.on("round:resumed", (payload: RoundResumedPayload) => {
      const current = screenRef.current;
      const snapshot =
        current.kind === "active"
          ? current
          : (activeSnapshotRef.current as Extract<ScreenState, { kind: "active" }> | null);
      const rotationSnapshot =
        current.kind === "rotation" ? current.state : rotationSnapshotRef.current;
      const partitionSnapshot =
        current.kind === "partition" ? current.state : partitionSnapshotRef.current;
      setScreen({
        kind: "resuming",
        resumesAtMs: payload.resumesAtMs,
        resumeCountdownSeconds: payload.resumeCountdownSeconds,
        pausedRemainingSeconds: payload.pausedRemainingSeconds,
        activeSnapshot: snapshot
          ? {
              roundId: snapshot.roundId,
              competitionId: snapshot.competitionId,
              durationSeconds: snapshot.durationSeconds,
              questions: snapshot.questions,
              savedGrids: snapshot.savedGrids,
              participationState: snapshot.participationState,
            }
          : null,
        rotationSnapshot,
        partitionSnapshot,
      });
    });

    /**
     * Unit 13's three rotation pushes. All three are addressed to this one
     * tablet's room (`tablet:<participantId>`), so nothing here has to check
     * whether the push was meant for us. `deal` and `rotated` share a shape:
     * the initial deal, the timed rotation, the post-submit refill and the
     * stale-hold refresh are all "here is what you hold now".
     */
    socket.on("rotation:deal", (payload: RotationPushPayload) => {
      setScreen({
        kind: "rotation",
        state: toRotationViewState(payload, null),
      });
    });

    socket.on("rotation:rotated", (payload: RotationPushPayload) => {
      setScreen({
        kind: "rotation",
        state: toRotationViewState(payload, null, payload.reason),
      });
    });

    socket.on("rotation:ended", (payload: RotationEndedPushPayload) => {
      setScreen((current) => {
        // Keep the last-known view (the score line, the progress count) and only
        // overlay the settled result, so the tablet does not blank out.
        if (current.kind !== "rotation") return current;
        return {
          kind: "rotation",
          state: {
            ...current.state,
            ended: {
              reason: payload.reason,
              correctCount: payload.correctCount,
              score: payload.score,
              completionTimeSeconds: payload.completionTimeSeconds,
            },
          },
        };
      });
    });

    /**
     * Unit 14's three partition pushes, also addressed to this tablet's room.
     * `deal` and `puzzle-solved` share one payload shape, so both land on the same
     * screen state — the difference is only the transient banner, carried by
     * `solvedReason`.
     */
    socket.on("partition:deal", (payload: PartitionPushPayload) => {
      setScreen({ kind: "partition", state: toPartitionViewState(payload, null) });
    });

    socket.on("partition:puzzle-solved", (payload: PartitionPushPayload) => {
      setScreen({
        kind: "partition",
        state: toPartitionViewState(payload, null, payload.reason),
      });
    });

    socket.on("partition:round-ended", (payload: PartitionEndedPushPayload) => {
      setScreen((current) => {
        // Keep the last-known view and overlay the settled result, so the tablet
        // does not blank out.
        if (current.kind !== "partition") return current;
        return {
          kind: "partition",
          state: {
            ...current.state,
            ended: {
              reason: payload.reason,
              solvedCount: payload.solvedCount,
              score: payload.score,
              completionTimeSeconds: payload.completionTimeSeconds,
            },
          },
        };
      });
    });

    socket.on("disconnect", () => {
      // On reconnect, refetch the current state. Socket.io handles the actual
      // reconnection; we only need to refresh our mirror of the round.
    });

    socket.on("connect", () => {
      // After a reconnect, refresh the state for the round we were last on. The
      // two stages have different endpoints: a team round's questions come from
      // the category pool and never carry a `roundId` (BLD-040), so the
      // Individual `GET /:roundId/state` finds nothing for it.
      const current = screenRef.current;
      if (current.kind === "rotation") {
        void refreshRotationState(current.state.roundId);
        return;
      }
      if (current.kind === "partition") {
        void refreshPartitionState(current.state.roundId);
        return;
      }
      // A paused Team round: only one of the two snapshots is non-null, because
      // `round:paused` clears the sibling. The Individual `GET /:roundId/state`
      // finds nothing for a team round (BLD-040), so route to the right reader.
      if (rotationSnapshotRef.current) {
        void refreshRotationState(rotationSnapshotRef.current.roundId);
        return;
      }
      if (partitionSnapshotRef.current) {
        void refreshPartitionState(partitionSnapshotRef.current.roundId);
        return;
      }
      const roundId =
        current.kind === "active"
          ? current.roundId
          : current.kind === "resuming"
            ? current.activeSnapshot?.roundId
            : undefined;
      if (roundId) {
        void refreshState(roundId);
        return;
      }
      // Every case above knew its own round. This one does not: the screen is still
      // `"waiting"` (a first connection, a reload, or a reconnect that happened while
      // nothing was running), so there is no `roundId` to read and no snapshot to
      // resume from — and if the round went ACTIVE while this page was away, the push
      // that named it is already gone. That is the case the old handler skipped
      // entirely, which is why the player sat on "the round starts in Xs" until they
      // reloaded at exactly the right moment. Ask the server instead: it resolves the
      // round from the session and answers with its kind, which picks the reader.
      //
      // Deliberately unconditional rather than gated on a status this page cannot
      // know. `"waiting"` is also the correct screen before the first round, and the
      // server answers `round: null` for that — one cheap read per connect, no
      // guessing on the client.
      void discoverCurrentRound();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session, t, refreshState, refreshRotationState, refreshPartitionState, discoverCurrentRound]);

  // After a resume's 3-2-1 has played out, return to the active screen. The
  // countdown is cosmetic; the server's timer is the authority (RND-001).
  useEffect(() => {
    if (screen.kind !== "resuming") return;
    const delay = Math.max(0, screen.resumesAtMs - Date.now());
    // Read the snapshot out here rather than inside the updater: a fetch is a side
    // effect, and a state updater must stay pure (React re-runs them under
    // StrictMode).
    const rotationSnapshot = screen.rotationSnapshot;
    const partitionSnapshot = screen.partitionSnapshot;
    const handle = window.setTimeout(() => {
      if (partitionSnapshot) {
        // The partition round: restore the band grid immediately (typed digits are
        // local-only until the next autosave), then re-read the server's copy, whose
        // total-time deadline was pushed out by the pause (invariant 3).
        setScreen((current) =>
          current.kind === "resuming"
            ? { kind: "partition", state: partitionSnapshot }
            : current,
        );
        void refreshPartitionState(partitionSnapshot.roundId);
        return;
      }
      if (rotationSnapshot) {
        // A team round: restore the held question immediately so the grid is not
        // blank, then re-read the server's copy — its rotation deadline was
        // re-armed during the pause, so the snapshot's `nextRotationAtMs` is stale
        // and only the server knows the new one (invariant 3).
        setScreen((current) =>
          current.kind === "resuming"
            ? { kind: "rotation", state: rotationSnapshot }
            : current,
        );
        void refreshRotationState(rotationSnapshot.roundId);
        return;
      }
      setScreen((current) => {
        if (current.kind !== "resuming") return current;
        if (current.activeSnapshot) {
          return {
            kind: "active",
            roundId: current.activeSnapshot.roundId,
            competitionId: current.activeSnapshot.competitionId,
            durationSeconds: current.activeSnapshot.durationSeconds,
            questions: current.activeSnapshot.questions,
            savedGrids: current.activeSnapshot.savedGrids,
            participationState: current.activeSnapshot.participationState,
          };
        }
        return { kind: "waiting" };
      });
    }, delay);
    return () => window.clearTimeout(handle);
  }, [screen, refreshRotationState, refreshPartitionState]);

  if (!session || session.role !== "PLAYER") {
    return null;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6 text-white">
        <p className="text-red-300">{error}</p>
      </div>
    );
  }

  if (screen.kind === "waiting") {
    return <WaitingScreen competition={myCompetition} />;
  }

  if (screen.kind === "preparation") {
    return (
      <PreparationScreen
        remainingSeconds={screen.remainingSeconds}
        totalSeconds={screen.totalSeconds}
      />
    );
  }

  if (screen.kind === "paused") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-900 p-6 text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("player.paused")}</h1>
      </div>
    );
  }

  if (screen.kind === "resuming") {
    return (
      <ResumeCountdownScreen
        resumesAtMs={screen.resumesAtMs}
        resumeCountdownSeconds={screen.resumeCountdownSeconds}
      />
    );
  }

  // rotation (Unit 13)
  if (screen.kind === "rotation") {
    return (
      <RotationRoundScreen
        state={screen.state}
        sessionToken={session.token}
        deviceId={session.deviceId}
      />
    );
  }

  // partition (Unit 14)
  if (screen.kind === "partition") {
    return (
      <PartitionRoundScreen
        state={screen.state}
        sessionToken={session.token}
        deviceId={session.deviceId}
      />
    );
  }

  // active
  return (
    <ActiveRoundScreen
      roundId={screen.roundId}
      competitionId={screen.competitionId}
      durationSeconds={screen.durationSeconds}
      questions={screen.questions}
      savedGrids={screen.savedGrids}
      sessionToken={session.token}
      deviceId={session.deviceId}
      initialParticipationState={screen.participationState}
    />
  );
}

/**
 * The waiting screen (report 2026-10-19, hole A). It used to render two static
 * strings — "Competition room" / "Waiting for the competition to start…" — which
 * told the student nothing about which event they were in, because nothing on the
 * client could ever know: the entry token that carried the competition id is
 * consumed and deleted by exactly one login, the stored session never held one,
 * and a player session reaches no module outside `gameplay`.
 *
 * `competition` is the payload of `GET /api/gameplay/competition`, loaded once on
 * mount. Null (not loaded yet, fetch failed, or the participant row is gone) falls
 * back to the two original strings, so the screen can never be *worse* than before.
 *
 * Everything shown here is the student's own row and the public shape of their
 * competition: no other participant's data, no question content, no score.
 */
function WaitingScreen({ competition }: { competition: MyCompetitionPayload | null }) {
  const { t } = useLocale();

  const named = competition?.competition ?? null;
  const participant = competition?.participant ?? null;
  const programme = competition?.programme ?? [];

  if (!named) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-900 p-6 text-center text-white">
        <h1 className="text-2xl font-semibold sm:text-3xl">{t("player.waitingTitle")}</h1>
        <p className="text-base text-gray-400 sm:text-lg">{t("player.waitingSubtitle")}</p>
        <LanguageChoiceBlock />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-gray-900 p-6 text-white">
      <div className="w-full max-w-md space-y-2 pt-10 text-center">
        <p className="text-sm text-gray-400">{t("player.welcomeTitle")}</p>
        <h1 className="text-2xl font-semibold sm:text-3xl">{named.name}</h1>
        {named.description ? (
          <p className="text-base text-gray-400 sm:text-lg">{named.description}</p>
        ) : null}
        {participant ? (
          <p className="pt-1 text-sm text-gray-300">
            {t("player.yourEntry")} #{participant.participantNumber}
            {competition?.category ? ` · ${competition.category.name}` : ""}
            {competition?.school ? ` · ${competition.school.name}` : ""}
          </p>
        ) : null}
      </div>

      <div className="w-full max-w-md rounded-lg bg-gray-800 p-4">
        <p className="mb-3 text-sm font-semibold text-gray-300">{t("player.programmeTitle")}</p>
        {programme.length === 0 ? (
          <p className="text-sm text-gray-400">{t("player.programmeEmpty")}</p>
        ) : (
          <ul className="space-y-3">
            {programme.map((stage) => (
              <li key={stage.stageId}>
                <p className="text-sm font-semibold text-gray-200">
                  {t(`player.stageType.${stage.stageType}`)} {stage.stageSequence}
                </p>
                <ul className="mt-1 space-y-1">
                  {stage.rounds.map((round) => (
                    <li
                      key={round.roundId}
                      className="flex items-baseline justify-between gap-3 text-sm text-gray-400"
                    >
                      <span className="text-gray-200">{round.name}</span>
                      <span className="shrink-0 text-xs tabular-nums">
                        {round.totalSeconds !== null
                          ? `${Math.ceil(round.totalSeconds / 60)} min`
                          : "–"}
                        {" · "}
                        {t(`player.roundStatus.${round.status}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <LanguageChoiceBlock />

      <p className="pb-8 text-center text-base text-gray-400 sm:text-lg">
        {t("player.waitingSubtitle")}
      </p>
    </div>
  );
}

function PreparationScreen({
  remainingSeconds,
  totalSeconds,
}: {
  remainingSeconds: number;
  totalSeconds: number;
}) {
  const { t } = useLocale();
  const [displaySeconds, setDisplaySeconds] = useState(remainingSeconds);

  // The cosmetic countdown tracks the server-pushed remaining time. Every push
  // re-anchors it; between pushes it ticks down once a second. The server's
  // value is the authority (invariant 3).
  useEffect(() => {
    setDisplaySeconds(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      setDisplaySeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(handle);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-900 p-6 text-white">
      <h1 className="text-2xl font-semibold sm:text-3xl">{t("player.preparationTitle")}</h1>
      <div className="text-center">
        <p className="text-base text-gray-400 sm:text-lg">{t("player.preparationSubtitle")}</p>
        <p className="mt-2 font-mono text-7xl font-bold tabular-nums sm:text-8xl">{displaySeconds}</p>
        <p className="mt-1 text-sm text-gray-500 sm:text-base">/ {totalSeconds}s</p>
      </div>
      <div className="max-w-md rounded-lg bg-gray-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-300">{t("player.preparationRules")}</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-gray-200">
          <li>{t("player.preparationRuleDuration")}</li>
          <li>{t("player.preparationRuleMovement")}</li>
          <li>{t("player.preparationRuleFeedback")}</li>
        </ul>
      </div>
      <LanguageChoiceBlock />
    </div>
  );
}

/**
 * BLD-058: the player's own language choice, shown only in the two phases where
 * choosing is still safe — waiting and preparation. Once the round is active the
 * control is gone, because a student tapping it mid-grid would see every label flip
 * under their hands. The notice exists precisely for that: it tells them, while they
 * can still act, that the choice closes.
 *
 * Absence rather than disabling, the same reasoning BLD-053 used for the fixed
 * switcher on this route.
 */
function LanguageChoiceBlock() {
  const { t } = useLocale();

  return (
    <div className="flex max-w-md flex-col items-center gap-3">
      <InlineLanguageSwitcher />
      <p role="note" className="text-center text-sm text-amber-300">
        {t("player.languageNotice")}
      </p>
    </div>
  );
}

function ResumeCountdownScreen({
  resumesAtMs,
  resumeCountdownSeconds,
}: {
  resumesAtMs: number;
  resumeCountdownSeconds: number;
}) {
  const { t } = useLocale();
  const [displaySeconds, setDisplaySeconds] = useState(resumeCountdownSeconds);

  useEffect(() => {
    const handle = window.setInterval(() => {
      const remainingMs = resumesAtMs - Date.now();
      setDisplaySeconds(Math.max(0, Math.ceil(remainingMs / 1000)));
    }, 100);
    return () => window.clearInterval(handle);
  }, [resumesAtMs]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-900 p-6 text-white">
      <p className="text-base text-gray-400 sm:text-lg">{t("player.resumeCountdown")}</p>
      <p className="font-mono text-7xl font-bold tabular-nums sm:text-8xl">{displaySeconds}</p>
    </div>
  );
}
