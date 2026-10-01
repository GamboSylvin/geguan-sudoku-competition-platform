# Unit 11: Controller live commands — DRAFT, awaiting approval

> **Draft spec, not yet approved.** This file follows the structure of `building-with-ai/templates/feature-spec.md`. Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [P] blanket-approved proposal · [O] open. See `../README.md`.
> This unit has no open item blocking it — build plan: "**No open items remain** — reset is settled: never; awards after an early finish is resolved (U-89); whether the system computes award tiers at all for a normal finish is resolved, none needed (U-27, RES-007); cancel is resolved, kept (U-31, ROL-009)."
> Present this spec for review before starting the unit, per the methodology.

## Goal

The controller gets the full live command set: start a stage (all categories together), global pause/resume, end a round early, finish the competition early, reset or rematch at any scope (event, round, participant, team), act with a disconnected judge's full authority, control the big screen's display mode, and cancel — each changing state exactly as decided, with every command controller-only.

Goal in one testable sentence: **starting a stage begins preparation for round 1 in every category at once; pausing freezes every active round's exact state and resuming continues it after "3, 2, 1, Start"; ending a round early auto-submits every remaining participant with no bonus and cannot be undone; finishing early marks the competition `FINISHED` with a visible "finished early" flag; a reset or rematch archives the prior attempt(s) and grants full round time (not remaining time); cancel stops the competition with no scoring and no released results, from any point before it finishes.**

## Context

- **What already exists:** Unit 07's round/preparation state machine and timer service (`pause`/`resume`/`remaining`); Unit 08's auto-submit-and-score path and its per-stage finish logic; Unit 09's ranking and big-screen push cycle; Unit 10's single-student archive-and-restart mechanic and judge scoping. **This unit adds no new tables** — `CompetitionRuntimeState`, `BigScreenDisplayState` and every entity this unit touches already exist from Unit 1.
- **Where this lives:** the command sequence (start a stage, pause/resume, end/finish, reset/rematch/replay triggering, judge-takeover arbitration) belongs to the **Orchestrator** module (`../architecture.md`, "System boundaries") — backend code goes in `backend/src/modules/orchestrator/`, calling into `round`, `gameplay`, `scoring` and `big-screen` as needed.
- **Start a stage** [T]: one command starts the named stage for **every category together** — only the controller can trigger it [C] (ROL-003). Calls Unit 07's preparation-start logic (round 1 of that stage) for each category's corresponding `Stage` row. Only valid when that stage is `WAITING` and (for the Team stage) the Individual stage has already finished — **after a stage ends, the next one does not start by itself** [C] (RND-006); this command is exactly what the controller uses for both the first stage and any stage after.
- **Global pause and resume** [C]: pauses every currently active round, across every category, at once — calls Unit 07's timer service `pause()`/`resume()` for each. State is tracked in `CompetitionRuntimeState` (`pausedAt`, `remainingSecondsAtPause`). Resume shows "3, 2, 1, Start" before continuing, reusing Unit 07's signal.
- **End a round early** [T] (SUB-004): ends one round immediately, regardless of remaining time. Reuses Unit 08's auto-submit/scoring path (`submissionType = CONTROLLER_END`, no bonus — already anticipated by Unit 08's Implementation Notes) for every participant still active in that round, then follows Unit 08's normal finalize-and-advance chain. **Cannot be undone** [T].
- **Finish the competition early** [C] (RND-007): ends the currently active round the same way as "end a round early," then marks the whole `Competition` `FINISHED` with `finishedEarly = true`, regardless of which stage or round it was in. Unplayed rounds or stages score nothing (the same as counting them as 0) — the school/individual totals use only what was actually played. **Cannot be resumed** — for an interruption, the controller uses pause/resume instead [C]. No award-tier computation is added for this case [C] (U-89, RES-007) — the system just shows the computed scores and the "finished early" mark.
- **Reset or rematch** [C]/[P] (ROL-005): scoped to the **whole event, one round, one person, or one team**. Reuses Unit 10's archive-and-restart operation, called at the requested scope instead of Unit 10's single-participant scope. **The key difference from a judge's restart:** a rematch gives **full round time again**, not the remaining time Unit 10 uses [T] (ROL-005, resolves U-13). Erases the affected participant(s)' partial answers for the reset round(s); leaves earlier rounds' scores untouched. **Only valid while the competition is not `FINISHED` or `CANCELLED`** — "reset after finishing" is explicitly settled as not possible [C]. The **team scope** of this command is built generically here but is only exercisable once Units 13/14 add team-round runtime to rematch against — this unit's own acceptance testing covers the event/round/participant scopes against the Individual stage.
- **Judge takeover, resolved** [C] (ROL-004): manual, and the last action wins — **no dedicated "takeover" mechanic is built.** The controller already has every power a judge has, plus more [C] (ROL-002); this unit simply lets the controller call Unit 10's same status-view and restart endpoints **without** Unit 06's range-scoping restriction, seeing and acting on every participant in the competition. No locking or arbitration logic is added — if a judge and the controller act on the same student close together, whichever request the server processes last is what applies, exactly as "last action wins" states.
- **Cancel, resolved** [T] (ROL-009, resolves U-31): kept, and explicitly a **different scenario from reset/rematch** — a competition invalid from the start, stopped without any scoring and with no results ever released, vs. fixing a problem in an otherwise-legitimate running one. Sets `Competition.status = CANCELLED` (`cancelledAt` set) from any state before `FINISHED`; no score is computed or finalized from that point on, and Unit 12's results/export must treat a `CANCELLED` competition as having nothing to show (noted for Unit 12, not built here). Cannot be resumed, reset or rematched afterward — a separate terminal state from `FINISHED`.
- **Automatic whole-competition finish, extended from Unit 08.** Unit 08 already marks one stage finished once its rounds are all scored; **this unit extends that check**: once a category's **last** stage (by `sequence`) finishes, and every category in the competition has reached that point, the competition becomes `FINISHED` (`finishedEarly = false`) automatically, with no controller action — completing RND-006's "the competition finishes by itself." Built generically now; **fully exercising it requires Units 13/14's Team-stage runtime** to exist (since the Team stage's rounds can't run without it) — the Individual-stage-only first slice (BLD-009) can still reach this state once Units 13/14 land, with no rebuild of this unit's logic.
- **Big-screen display control** [C] (BSC-002): the controller can switch the big screen's mode and manually select what it shows, and can toggle automatic category rotation. **This unit adds the `PAUSED` and `FINAL` modes** (tied directly to this unit's own pause and finish commands) and manual category selection / rotation toggle for the `RANKING` mode already built by Unit 09. **`PLAYER_CLOSEUP` and `TEAM_SPLIT` modes are out of scope here** — no per-student close-up UI or team data exists yet; they land with whichever later unit actually needs them (team-stage units, the design phase).

## Implementation Details

1. **Start a stage.** Validates the target stage is `WAITING` and, for a non-first stage, that the previous stage is `FINISHED`. Calls Unit 07's preparation-start logic for round 1 of that stage, for every category in the competition, in one command.
2. **Global pause / resume.** Pauses/resumes every currently `ACTIVE` round's timer via Unit 07's timer service; records `CompetitionRuntimeState.pausedAt`/`remainingSecondsAtPause`. Resume triggers the shared "3, 2, 1, Start" signal, then continues every paused timer from its exact stored remaining value.
3. **End a round early.** Marks the target round for immediate closure; calls Unit 08's auto-submit path (`submissionType = CONTROLLER_END`) for every still-`ACTIVE` `RoundParticipation` in it, then Unit 08's normal finalize/advance chain runs as usual.
4. **Finish early.** Calls step 3 for whatever round is currently active (if any), then sets `Competition.status = FINISHED`, `finishedEarly = true`, `finishedAt` = now. Any stage/round never reached contributes nothing to totals.
5. **Reset or rematch.** Given a scope (`EVENT`/`ROUND`/`PARTICIPANT`/`TEAM`) and target id(s), archives the current `Attempt`(s) in scope (reusing Unit 10's archive operation) and creates fresh ones with the **full** round duration, not the remaining time. Rejects if `Competition.status` is `FINISHED` or `CANCELLED`.
6. **Controller judge-equivalent access.** The controller calls Unit 10's status-view and restart endpoints with no range restriction applied — enforced by skipping Unit 06's scoping check specifically for `CONTROLLER`-role sessions on those same endpoints (not a separate code path).
7. **Cancel.** Sets `Competition.status = CANCELLED`, `cancelledAt` = now, from any pre-`FINISHED` state. No further scoring runs; Unit 12 is responsible for hiding results for a cancelled competition (noted, not built here).
8. **Automatic whole-competition finish.** Extends Unit 08's per-stage finish check: when a category's last stage finishes, check whether every category has also reached that point; if so, set `Competition.status = FINISHED`, `finishedEarly = false`.
9. **Big-screen mode control.** Endpoints to set `BigScreenDisplayState.mode` to `RANKING` (with manual category selection and a rotation toggle, on top of Unit 09's automatic cycle), `PAUSED` (triggered automatically by step 2, or manually), and `FINAL` (triggered automatically by steps 4/8, or manually).
10. **Frontend.** A controller command bar/dashboard: start-stage button (enabled only when valid), pause/resume toggle, per-round "end early" action, "finish early" action (with an explicit "cannot be undone" confirmation), a reset/rematch panel with a scope picker, judge-equivalent student-status/restart access, big-screen mode controls, and a "cancel" action (with an explicit warning that no results will ever be released).

### Inputs

- Start stage: `stageId` (or category-set, derived from the competition).
- End round early / Reset or rematch: `roundId` and, for reset/rematch, the scope (`EVENT`/`ROUND`/`PARTICIPANT`/`TEAM`) and target id(s).
- Big-screen control: `mode`, optional `targetId` (category), `rotationEnabled`.

### Expected Behavior

- The controller starts the Individual stage; every category's round 1 preparation begins together.
- The controller pauses mid-round; every active round freezes exactly where it is; on resume, every one of them shows "3, 2, 1, Start" and then continues from precisely where it stopped.
- The controller ends a round early; every participant still playing is auto-submitted with no bonus; the action can't be reversed.
- The controller finishes the competition early mid-event; the competition becomes `FINISHED` with a visible "finished early" mark; no further stage or round can run.
- The controller rematches one participant's round; that participant gets a blank grid and the **full** round duration again, not whatever time was left when the rematch was triggered.
- The controller restarts a student who isn't in any judge's currently visible range (or whose judge has disconnected) exactly as a judge would, with no separate "takeover" action.
- The controller cancels an in-progress competition; its status becomes `CANCELLED`; no score is computed from that point and no results are ever shown for it.
- Once the last stage of every category finishes naturally, the competition becomes `FINISHED` without the controller doing anything.

### Components Involved

- **Backend (`orchestrator` module):** `stage-command.service.ts` (start stage, pause/resume, end round early, finish early), `reset-rematch.service.ts` (building on Unit 10's archive operation), `cancel.service.ts`.
- **Backend (`big-screen` module):** mode-control additions on top of Unit 09's push cycle.
- **Frontend:** the controller command dashboard.

### API Contract (Working Position for this unit)

- `POST /api/competitions/:id/stages/:stageId/start`
- `POST /api/competitions/:id/pause` / `POST /api/competitions/:id/resume`
- `POST /api/competitions/:id/rounds/:roundId/end-early`
- `POST /api/competitions/:id/finish-early`
- `POST /api/competitions/:id/reset-rematch` — body: `{ scope, targetId(s) }`
- `POST /api/competitions/:id/cancel`
- `POST /api/competitions/:id/big-screen/mode` — body: `{ mode, targetId?, rotationEnabled? }`

### Error Cases

- **Start a stage that's already active, or out of sequence:** rejected.
- **Pause/resume with no active round to act on:** rejected (nothing to pause).
- **Reset/rematch on a `FINISHED` or `CANCELLED` competition:** rejected.
- **Any command on a `CANCELLED` competition (other than read access):** rejected.
- **Finish-early or cancel twice:** the second call is a no-op/rejected — the competition is already in a terminal state.

### Security Considerations

- Every command in this unit requires a valid `CONTROLLER` session [C] (ROL-002) — no judge or player action can trigger any of them.
- The controller's judge-equivalent access (step 6) is still logged per-action in `AuditLog`, same as every other controller command, so a takeover is traceable even without a dedicated "takeover" state [S] (BSC-002, commands are traceable).

### Constraints

- No schema change — every entity this unit touches already exists from Unit 1.
- Does not build team-stage round-type gameplay (rotation relay, partition collaboration) — Units 13, 14; the `TEAM` scope of reset/rematch and the Team stage's "start" are built generically but only fully exercisable once those units exist.
- Does not build the school-ranking big-screen mode (Unit 15) or `PLAYER_CLOSEUP`/`TEAM_SPLIT` modes (left for whichever later unit needs them).
- Does not build results viewing, export, or score correction — Unit 12; this unit only sets the state (`FINISHED`/`CANCELLED`/`finishedEarly`) that Unit 12 reads.
- Nothing tagged `[O]`/OPEN may be implemented as if decided.

### Implementation Notes

- Reuse Unit 10's archive-and-restart function for reset/rematch, parameterized by scope and by "full time" vs. "remaining time" — do not duplicate the archiving logic.
- Keep the automatic whole-competition-finish check (step 8) as a small extension of Unit 08's existing per-stage check, not a separate parallel mechanism, so there's one place that decides "is this competition done."

### Related Features

- **Depends on:** Unit 07 (timer service), Unit 08 (auto-submit/scoring path, per-stage finish check), Unit 09 (ranking data and the push cycle this unit's big-screen mode control builds on), Unit 10 (archive-and-restart mechanic, judge scoping to bypass).
- **Depended on by:** Unit 12 (results/export read `Competition.status`, `finishedEarly`, `CANCELLED`), Units 13/14 (team-stage "start a stage" and reset/rematch reuse this unit's commands), Unit 15 (school-ranking big-screen mode extends this unit's mode control).

## Acceptance Criteria

1. Starting a stage begins preparation for round 1 in every category of that stage at once.
2. A global pause freezes every active round's exact state; resume shows "3, 2, 1, Start" for each before continuing from precisely where it stopped.
3. Ending a round early auto-submits every still-active participant with no bonus and cannot be undone.
4. Finishing early marks the competition `FINISHED` with `finishedEarly = true`; no further stage or round runs; unplayed parts score nothing.
5. A reset or rematch at any of the four scopes archives the prior attempt(s) and grants the full round duration again, not the remaining time; it's rejected on a `FINISHED` or `CANCELLED` competition.
6. The controller can view status and restart any participant, with no range restriction and no separate takeover step.
7. Cancel sets the competition to a terminal `CANCELLED` state from any point before `FINISHED`, with no score computed and no results ever released for it; it cannot be resumed, reset or rematched afterward.
8. Once every category's last stage finishes naturally, the competition becomes `FINISHED` automatically with `finishedEarly = false`.
9. A non-controller session cannot invoke any command this unit adds.
10. Lint, type check, tests and build pass in CI (BLD-002).

## Out of Scope

- Team-stage round-type gameplay itself (rotation relay, partition collaboration) — Units 13, 14.
- The school-ranking big-screen display mode — Unit 15.
- `PLAYER_CLOSEUP` and `TEAM_SPLIT` big-screen modes — left for a later unit.
- Results viewing, score correction and export — Unit 12 (this unit only sets the terminal state Unit 12 reads).
- Any screen's finished visual design (deferred to the design phase, U-66, BLD-009).
