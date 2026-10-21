import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "@/config/env";
import { useLocale } from "@/i18n/locale-context";
import { loadSession } from "../auth/session";

/**
 * The judge's live push channel (F3, 2026-10-21).
 *
 * Why this exists: the supervision panel already read the truth every three seconds,
 * and still the judge saw nothing. Two separate failures were behind that. The
 * `connected` column was computed from `Account.activeDeviceId`, which the frontend
 * never cleared because no logout action in the app called the server — so a player
 * who had logged in once and closed the tab stayed "connected" for days, and the one
 * who really was there could not be picked out of the noise. And the round starting
 * changed no cell of the table at all, so there was nothing for a poll to show.
 *
 * Both are fixed; this hook is the second half. It does **not** carry row data. A
 * push says "something happened", and the panel then re-reads its rows over HTTP,
 * which is where the authority is (invariant 3) — so the table can never be driven
 * by a payload the server did not already agree to. The one thing taken straight
 * from the wire is the spoken notification, which is display text about a fact the
 * server itself announced.
 *
 * The namespace is authenticated by the same session token as HTTP, and the socket
 * joins its competition's room server-side from that token — never from an argument
 * this hook could be handed. That is why it takes no competition id.
 *
 * `enabled` is false for the controller, which renders the same panel but must not
 * open a socket on a namespace scoped to a judge's assignments.
 */

/** The three pushes the gateway sends on `/judge` (see `realtime/events.ts`). */
const EVENTS = {
  studentConnected: "judge:student-connected",
  studentDisconnected: "judge:student-disconnected",
  roundStarted: "judge:round-started",
} as const;

interface PresencePayload {
  competitionId: string;
  participantId: string;
  participantNumber: number;
  participantName: string;
  at: string;
}

interface RoundStartedPayload {
  competitionId: string;
  roundId: string;
  stageId: string;
  phase: "PREPARATION" | "ACTIVE";
  durationSeconds: number;
  at: string;
}

/** One line of the notification feed, oldest last. */
export interface LiveNotice {
  id: string;
  text: string;
  /**
   * When the push arrived, on this machine's clock. The server also stamps `at`, but
   * the feed's job is to age a line off the screen, and comparing a server timestamp
   * against a tablet's own `Date.now()` would age lines by the clock skew instead.
   */
  receivedAt: number;
}

/** How many lines the feed keeps. A judge is not scrolling back through an event. */
const MAX_NOTICES = 6;

/** How long a line stays on screen before it drops off on its own. */
const NOTICE_TTL_MS = 20_000;

export interface JudgeLivePush {
  /** The feed, newest first. Empty when nothing has happened yet. */
  notices: LiveNotice[];
  /** True while the socket is connected — shown as a small "Live" badge. */
  live: boolean;
}

export function useJudgeLivePush(onChanged: () => void, enabled = true): JudgeLivePush {
  const { t } = useLocale();
  const [notices, setNotices] = useState<LiveNotice[]>([]);
  const [live, setLive] = useState(false);

  // Held in a ref so a push cannot be dropped just because the panel re-rendered
  // between the socket connecting and the event arriving.
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  // Same reason for `t`: a locale switch would otherwise re-create `push`, which the
  // socket effect depends on, and tear down a healthy connection for a cosmetic change.
  const tRef = useRef(t);
  tRef.current = t;

  const seqRef = useRef(0);

  const push = useCallback((text: string) => {
    // A monotonically increasing local counter, not a hash of the text: two students
    // with the same name connecting in the same millisecond are two lines, and an id
    // built from the payload would collapse them into one.
    const id = `notice-${(seqRef.current += 1)}`;
    setNotices((current) =>
      [{ id, text, receivedAt: Date.now() }, ...current].slice(0, MAX_NOTICES),
    );
    // Re-read the rows: the fact just announced is one the HTTP read already knows
    // how to express, and reading it is cheaper and more honest than inferring it.
    onChangedRef.current();
  }, []);

  useEffect(() => {
    if (!enabled) {
      // A disabled hook is not a broken one: say so plainly rather than leaving
      // `live` at whatever a previous connection set, which would show "Live" on a
      // screen that has no socket.
      setLive(false);
      return;
    }
    const session = loadSession();
    if (!session) return;

    const socket: Socket = io(`${API_BASE_URL}/judge`, {
      auth: { token: session.token, deviceId: session.deviceId },
      transports: ["websocket"],
    });

    socket.on("connect", () => setLive(true));
    socket.on("disconnect", () => setLive(false));

    socket.on(EVENTS.studentConnected, (payload: PresencePayload) => {
      push(
        tRef.current("judge.supervision.studentConnected", {
          name: payload.participantName,
          number: payload.participantNumber,
        }),
      );
    });
    socket.on(EVENTS.studentDisconnected, (payload: PresencePayload) => {
      push(
        tRef.current("judge.supervision.studentDisconnected", {
          name: payload.participantName,
          number: payload.participantNumber,
        }),
      );
    });
    socket.on(EVENTS.roundStarted, (payload: RoundStartedPayload) => {
      push(
        tRef.current("judge.supervision.roundStarted", {
          phase: tRef.current(
            payload.phase === "PREPARATION"
              ? "judge.supervision.roundStartedPreparation"
              : "judge.supervision.roundStartedActive",
          ),
        }),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [enabled, push]);

  // Drop a line once it has been on screen long enough, so the feed is a recent
  // history rather than a log of the whole event.
  useEffect(() => {
    if (notices.length === 0) return;
    const handle = window.setInterval(() => {
      const cutoff = Date.now() - NOTICE_TTL_MS;
      setNotices((current) => {
        const kept = current.filter((n) => n.receivedAt > cutoff);
        return kept.length === current.length ? current : kept;
      });
    }, 2000);
    return () => window.clearInterval(handle);
  }, [notices.length]);

  return { notices, live };
}
