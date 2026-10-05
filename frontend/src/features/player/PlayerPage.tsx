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
import { ActiveRoundScreen } from "@/features/gameplay";

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
    };

export function PlayerPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const session = useMemo(() => loadSession(), []);
  const [screen, setScreen] = useState<ScreenState>({ kind: "waiting" });
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeSnapshotRef = useRef<ScreenState | null>(null);

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
      setScreen((current) => {
        if (current.kind === "active") {
          activeSnapshotRef.current = current;
        }
        return { kind: "paused", pausedRemainingSeconds: payload.pausedRemainingSeconds };
      });
    });

    socket.on("round:resumed", (payload: RoundResumedPayload) => {
      setScreen((current) => {
        const snapshot =
          current.kind === "active"
            ? current
            : (activeSnapshotRef.current as Extract<ScreenState, { kind: "active" }> | null);
        return {
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
        };
      });
    });

    socket.on("disconnect", () => {
      // On reconnect, refetch the current state. Socket.io handles the actual
      // reconnection; we only need to refresh our mirror of the round.
    });

    socket.on("connect", () => {
      // After a reconnect, refresh the state for the round we were last on.
      setScreen((current) => {
        const roundId =
          current.kind === "active"
            ? current.roundId
            : current.kind === "resuming"
              ? current.activeSnapshot?.roundId
              : undefined;
        if (roundId) {
          void refreshState(roundId);
        }
        return current;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session, refreshState]);

  // After a resume's 3-2-1 has played out, return to the active screen. The
  // countdown is cosmetic; the server's timer is the authority (RND-001).
  useEffect(() => {
    if (screen.kind !== "resuming") return;
    const delay = Math.max(0, screen.resumesAtMs - Date.now());
    const handle = window.setTimeout(() => {
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
  }, [screen]);

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
