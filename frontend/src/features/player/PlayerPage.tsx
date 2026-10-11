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
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "@/config/env";
import { useLocale } from "@/i18n/locale-context";
import { loadSession, landingPath } from "@/features/auth/session";
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
  remainingSeconds: number;
  totalSeconds: number;
}

interface RoundStartedPayload {
  roundId: string;
  stageId: string;
  competitionId: string;
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
  const session = useMemo(() => loadSession(), []);
  const [screen, setScreen] = useState<ScreenState>({ kind: "waiting" });
  const [error, setError] = useState<string | null>(null);
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

  // Gate: a player session only. Other roles go to their own landing.
  useEffect(() => {
    if (!session || session.role !== "PLAYER") {
      navigate(landingPath(session?.role ?? "PLAYER"), { replace: true });
    }
  }, [session, navigate]);

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

  useEffect(() => {
    if (!session || session.role !== "PLAYER") return;

    const socket = io(`${API_BASE_URL}/player`, {
      auth: { token: session.token, deviceId: session.deviceId },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("round:preparation-tick", (payload: PreparationTickPayload) => {
      setScreen((current) => {
        // Only the preparation screen consumes ticks; once the round has started
        // we ignore them (the round timer's tick is rendered inside the active
        // screen via its own cosmetic countdown).
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
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session, refreshState, refreshRotationState, refreshPartitionState]);

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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (screen.kind === "waiting") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">{t("player.waitingTitle")}</h1>
        <p className="text-gray-600">{t("player.waitingSubtitle")}</p>
      </div>
    );
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">{t("player.paused")}</h1>
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{t("player.preparationTitle")}</h1>
      <div className="text-center">
        <p className="text-gray-600">{t("player.preparationSubtitle")}</p>
        <p className="mt-2 text-6xl font-bold tabular-nums">{displaySeconds}</p>
        <p className="mt-1 text-sm text-gray-500">/ {totalSeconds}s</p>
      </div>
      <div className="max-w-md rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">{t("player.preparationRules")}</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
          <li>{t("player.preparationRuleDuration")}</li>
          <li>{t("player.preparationRuleMovement")}</li>
          <li>{t("player.preparationRuleFeedback")}</li>
        </ul>
      </div>
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <p className="text-gray-600">{t("player.resumeCountdown")}</p>
      <p className="text-6xl font-bold tabular-nums">{displaySeconds}</p>
    </div>
  );
}
