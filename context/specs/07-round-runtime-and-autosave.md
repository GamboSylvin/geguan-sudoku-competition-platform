# Unit 07: Round runtime and autosave — APPROVED (2026-10-04)

> **Draft spec, not yet approved.** This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [P] blanket-approved proposal · [O] open. See `../README.md`.
> This unit has no open item blocking it (not listed in `../specs/00-build-plan.md`, "Units that cannot be specified").
> Present this spec for review before starting the unit, per the methodology.

## Goal

A player's device enters the competition room, sees a preparation screen (that round's rules and a countdown) before each round, and then plays the round against a server-owned timer: that round's questions are fetched only at the moment it starts, every move autosaves, and disconnecting and reconnecting — including switching tablets (Unit 02's device takeover) — restores the saved grid with the correct remaining time.

Goal in one testable sentence: **a round's preparation countdown reaches zero and the puzzles appear with the round timer starting immediately; a player's moves autosave roughly twice a second without triggering scoring; a disconnect and reconnect (same or different device) restores the exact saved grid and the server-computed remaining time; a pause preserves the exact state and resume shows "3, 2, 1, Start" before the countdown continues from where it stopped.**

## Context

- **What already exists:** Unit 01's schema, Unit 02's login/sessions/device takeover, and Unit 03's `Competition`/`Stage`/`Round`/`RoundSettings` (with their decided defaults: `preparationSeconds` 60, `earlyBonusRate` 3, etc.). **This unit adds no new tables.**
- **Where this lives:** round timing and preparation state belong to the **Stage / Round** module; the current grid, autosave and reconnection belong to the **Gameplay** module (`../architecture.md`, "System boundaries") — backend code goes in `backend/src/modules/round/` and `backend/src/modules/gameplay/`.
- **No controller "start a stage" command exists yet** — that command surface is Unit 11's. This unit needs its acceptance criteria testable before Unit 11 exists, so it provides a **minimal internal/dev-only trigger** to begin stage 1's first round for a published competition, mirroring the seed-data precedent Unit 03 set for its own testing. **Unit 11 later replaces this trigger with the real controller-facing command** — this unit's own trigger is scratch/dev tooling, not a user-facing feature.
- **Automatic progression inside a stage, no human action** [T] (CS-022): once a stage has started (whether by this unit's internal trigger for now, or Unit 11's real command later), preparation → round active → the next round's preparation → ... happens automatically until the stage's last round ends. **A round transition happens only after its scoring is final** [T] (invariant 7, `../architecture.md`) — since scoring is Unit 08's build, not this unit's, **this unit builds only the first half of that sequence**: the timer reaching zero ends the round (stops accepting autosave, emits a "round ended" signal) but does **not** itself start the next round's preparation. **Unit 08 is what completes the loop** — it listens for this unit's "round ended" signal, runs auto-submission and scoring, finalizes the round's result, and only then calls back into this unit's preparation-start function for the next round. Starting the *first* stage, and starting the next stage after one finishes, stay human actions and are Unit 11's command either way.
- **Preparation** [C] (RND-001): a countdown, 60 seconds by default, customizable per round (edited via Unit 03, **not editable once that round's preparation has begun** — RND-002/RND-004's cutoff, which Unit 03 explicitly deferred to this unit, is enforced here: the countdown length is locked at the moment preparation starts). The screen shows the round's rules and the countdown. At zero, the puzzles appear and the round timer starts immediately — **no extra "3, 2, 1, Start"** at this transition.
- **Pause and resume mechanics** [C] (RND-001, RND-003): a pause (during preparation or during an active round) stops the relevant countdown/timer and preserves the exact remaining value; on resume, a "3, 2, 1, Start" shows first, then the countdown/timer continues from exactly where it stopped. **The controller-facing pause/resume command is Unit 11's** — this unit's timer service exposes `pause()`/`resume()`/`remaining()` so Unit 11 (and reconnection, and server-restart recovery) can call them; no pause/resume endpoint is exposed to any user role by this unit itself. **The controller cannot end preparation early** [C] (RND-003) — no such action exists in this unit or any other.
- **Question delivery** [C] (BLD-006): a round's `Question` rows are fetched only at the moment that round starts, with no preloading. Performance target [C] (U-58): all tablets start the round together within 1 second of each other — load-test this early (up to ~300 tablets in one room).
- **Autosave** [C]/[T]: every move is autosaved, about 2 grid saves per second per player, and autosave **never triggers scoring** [T] — scoring reacts only to a submission, which is Unit 08's build, not this unit's.
- **Server-owned timer** [T] (invariant 3): remaining time is computed server-side from the server clock, never trusted from the client; the client's own countdown display is cosmetic only.
- **Reconnection** [T]: the saved grid is restored and the timer keeps running. A student continuing on a different tablet with the same login already works at the session level via Unit 02 (PAR-005, device takeover) — **this unit adds the gameplay-specific restore** (the grid for every puzzle in the round, plus the current authoritative remaining time) on top of that.
- **Free movement** [C]: within an active round, the student moves freely between the round's 6 puzzles and edits any of them, with no live correctness feedback.
- **Server-restart recovery** [C] (BLD-007): round state changes are durable in PostgreSQL and working grids live in Redis with persistence on, so the timer and grids survive a server restart. After a restart, the competition comes back **paused** — the actual resume/replay choice is Unit 11's controller command; this unit's job is only to make sure the timer and grids are recoverable, not to build that choice.

## Implementation Details

1. **Preparation state and countdown.** When a round enters `PREPARATION` (via this unit's internal trigger, or automatically as the previous round's successor), the server locks in that round's `preparationSeconds` (no further edits accepted once started — the RND-002/RND-004 cutoff) and starts a server-authoritative countdown, pushed to clients over WebSocket.
2. **Round start at zero.** At zero, the server fetches that round's `Question` rows (not before — BLD-006), transitions `Round.status` to `ACTIVE`, starts the round timer (`durationSeconds`), and pushes the puzzles plus the start signal to every client in the same push — no "3, 2, 1, Start" at this transition (RND-001).
3. **Server-owned round timer service.** Authoritative remaining-time computation; exposes `pause()`, `resume()` and `remaining()` for other units (Unit 11's pause/resume command, reconnection, restart recovery) to call. On `resume()`, a "3, 2, 1, Start" signal precedes the countdown/timer continuing from exactly where it stopped.
4. **Autosave.** The current grid for each of the round's 6 puzzles is persisted to Redis roughly twice per second per player as the student edits; this never calls into scoring.
5. **Reconnection.** On reconnect (same device, or a different one via Unit 02's device takeover), the server returns the student's saved grid for every puzzle of the current round plus the current authoritative remaining time; the client renders exactly that state and the timer continues from the server-reported value.
6. **Round-end signal.** When a round's timer reaches zero, the server stops accepting autosave for that round and emits a "round ended" signal (e.g. an internal event, consistent with BLD-033's rule that events are used inside the competition/game-execution subsystem). **This unit does not itself start the next round's preparation** — invariant 7 requires that round's scoring to be final first, which is Unit 08's build (see Context). Unit 08 is what calls back into this unit's preparation-start logic (step 1) once scoring finalizes, completing the auto-advance sequence CS-022 describes; after the stage's last round, nothing auto-starts the next stage either way (RND-006 — that's Unit 11's command).
7. **Internal test trigger.** A dev-only function/script that starts stage 1, round 1's preparation for a published (`WAITING`) competition — scratch tooling for this unit's own acceptance testing, not wired into any user-facing flow. Unit 11 replaces it with the real controller command.
8. **Frontend.** Competition-room (waiting) screen; preparation screen (rules text + countdown); active-round screen (grid navigation across the round's 6 puzzles, free movement, no live correctness feedback); the landscape-only "please rotate your device" gate (UI-001/PAR-006); the resume flow ("3, 2, 1, Start" then continue).

### Inputs

- Internal trigger (dev-only): `competitionId` of a `WAITING` competition.
- Autosave: `questionId`, the current grid state, sent roughly every 500ms while the player edits.
- Reconnect: the player's session (from Unit 02) identifies which round/grid state to return.

### Expected Behavior

- A round's preparation screen counts down from its configured default (60s unless edited before preparation began); at zero, the puzzles appear and the timer starts immediately with no extra countdown.
- A player's edits save automatically, roughly twice a second, with no visible score feedback.
- A player who disconnects and reconnects — on the same tablet or, after logging in on another one (Unit 02), on a different tablet — sees exactly their saved grid and the correct remaining time, not a reset state.
- A pause (triggered through the timer service, by whatever later calls it) freezes the countdown/timer exactly where it is; resuming shows "3, 2, 1, Start" and then continues from that exact point.
- When a round's timer reaches zero, the next round's preparation begins automatically; after the stage's last round, nothing auto-starts.

### Components Involved

- **Backend (`round` module):** `round.service.ts` (preparation/round state transitions, the auto-advance sequence), the timer service (`pause`/`resume`/`remaining`), `round.repository.ts`.
- **Backend (`gameplay` module):** `gameplay.service.ts` (autosave, reconnection/grid-restore, question delivery at round start), `gameplay.repository.ts` (Redis access for working grids).
- **Realtime:** WebSocket handlers pushing preparation ticks, the round-start signal with puzzles, and timer-sync events on reconnect.
- **Frontend:** competition-room, preparation, and active-round screens under `frontend/src/features/player/` and `frontend/src/features/gameplay/`.

### API Contract (Working Position for this unit)

- WebSocket: `round:preparation-tick`, `round:started` (carries the round's questions), `round:timer-sync` (remaining time, pushed on reconnect and periodically), `round:paused`/`round:resumed`.
- `POST /api/gameplay/:roundId/autosave` (or an equivalent WebSocket message — team's choice at build time; marked Working Position, consistent with `ARCH-023`) — body: `{ questionId, grid }`.
- `GET /api/gameplay/:roundId/state` — returns the player's current saved grids for the round and the authoritative remaining time; used on reconnect.

### Error Cases

- **Autosave for a question not in the current active round:** rejected.
- **Autosave or reconnect after the round's timer has already reached zero:** the server stops accepting new autosave writes for that round; the student's latest saved state is what Unit 08 will act on at round-end — this unit does not implement the submission/scoring transition itself, only stops accepting further edits.
- **Reconnect from a session with no active round:** returns the competition-room "waiting" state, not an error.

### Security Considerations

- Every gameplay endpoint requires a valid `PLAYER` session (Unit 02); a player reads and writes only their own grid and round-participation data, never another participant's [T] (invariant, consistent with the "Access rules" pattern in `../data-model.md`).
- The round timer and question delivery are entirely server-authoritative; the client never supplies or is trusted for remaining time, round state, or which questions exist [T] (invariant 3, BLD-006).

### Constraints

- No schema change — every entity this unit touches already exists from Unit 1.
- Does not build submission, answer checking or scoring — that's Unit 08; autosave never calls into scoring.
- Does not build any controller-facing command (start a stage, pause, resume, end a round early, finish, reset/rematch, judge takeover) — that's Unit 11; this unit only exposes the timer service's `pause`/`resume`/`remaining` for Unit 11 to call.
- Does not build judge supervision or the single-student restart — that's Unit 10.
- Does not build team-stage runtime (rotation relay, partition collaboration) — Units 13 and 14; this unit covers Individual-stage rounds only, consistent with the first slice [C] (BLD-009).
- Nothing tagged `[O]`/OPEN may be implemented as if decided.

### Implementation Notes

- Keep the timer service's `pause`/`resume`/`remaining` interface narrow and stable — Unit 11 depends on calling it without needing to know this unit's internals, consistent with invariant 4 (a module's internals are reachable only through its public interface).
- The internal dev-only trigger (step 7) should live outside any user-facing route, clearly marked, and removed or disabled once Unit 11's real command exists — the same scratch-tooling pattern Unit 03 used for seed data.
- Load-test the round-start question burst early (BLD-006, U-58's 1-second target), per `../architecture.md`, "Risks".

### Related Features

- **Depends on:** Unit 03 (`Competition`/`Stage`/`Round`/`RoundSettings` to run against).
- **Depended on by:** Unit 08 (submission and scoring act on the round-active state and the autosaved grid this unit produces, listens for this unit's "round ended" signal, and completes the auto-advance sequence by calling back into this unit's preparation-start logic), Unit 10 (restart needs an active round to restart within), Unit 11 (the real "start a stage" command triggers this unit's preparation sequence; pause/resume calls this unit's timer service), Units 13/14 (team-stage runtime will follow this unit's timer/autosave patterns once built).

## Acceptance Criteria

1. A round's preparation screen shows that round's rules and a countdown defaulting to 60 seconds (or the value set before preparation began); at zero, the puzzles appear and the round timer starts immediately, with no extra "3, 2, 1, Start".
2. A player's moves autosave roughly twice a second and never trigger a score calculation.
3. A player who disconnects and reconnects (same device, or a different one via Unit 02's device takeover) sees their saved grid restored exactly, with the correct server-computed remaining time.
4. Pausing (via the timer service) preserves the exact remaining state; resuming shows "3, 2, 1, Start" before the countdown/timer continues from that exact point.
5. When a round's timer reaches zero, autosave stops and a "round ended" signal is emitted; this unit does not advance to the next round's preparation itself (that happens once Unit 08's scoring finalizes and calls back into this unit — verified in Unit 08's acceptance criteria, not here).
6. A player session cannot read or write another participant's grid or round state.
7. Lint, type check, tests and build pass in CI (BLD-002).

## Out of Scope

- Submission, answer checking and scoring (Unit 08).
- Every controller-facing live command: start a stage, pause, resume, end a round early, finish, reset/rematch, judge takeover (Unit 11) — this unit exposes only the timer service's internal `pause`/`resume`/`remaining`.
- Judge supervision and the single-student restart (Unit 10).
- Team-stage runtime: rotation relay and partition collaboration (Units 13, 14).
- Any screen's finished visual design (deferred to the design phase, U-66, BLD-009).
