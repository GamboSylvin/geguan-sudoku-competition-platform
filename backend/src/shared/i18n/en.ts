/**
 * English message catalogue. The interface is bilingual, English and Chinese
 * (ARCH-026); the translation mechanism is planned in from the start.
 * Only the keys the skeleton needs exist here; each screen adds its own strings.
 */
export const en = {
  common: {
    ok: "OK",
    notFound: "Not found",
    validationFailed: "Validation failed",
    internalError: "Internal server error",
  },
  health: {
    healthy: "Healthy",
    unhealthy: "Unhealthy",
    database: "Database",
    redis: "Redis",
  },
  auth: {
    // One generic message for every rejected login; never say which part was wrong
    // (AUTH-002). The code beside it lets the client localize.
    invalidCredentials: "Incorrect username or password",
    noSession: "Not signed in",
    sessionExpired: "Your session has ended. Please log in again.",
    deviceTakenOver: "This account was signed in on another device.",
  },
  competition: {
    // Unit 03. Only a controller may create, edit or publish (ROL-002); the
    // readiness keys are the named unmet conditions the publish rejection lists.
    forbidden: "Only a controller can manage competitions.",
    notFound: "Competition not found.",
    structureLocked:
      "This competition is published; its categories, stages and rounds can no longer be changed.",
    readiness: {
      categoryRequired: "Add at least one category.",
      participantsRequired:
        "Every category needs at least one participant.",
      questionsRequired:
        "Every category needs a question set assigned to both of its Individual rounds.",
      judgeRangesRequired:
        "Judge ranges must cover every participant number.",
    },
  },
  judge: {
    // Unit 06. Judge list management and range assignment are controller-only
    // (ROL-002); the removal guard names the unfinished competition (ROL-010).
    forbidden: "Only a controller can manage judges.",
    notFound: "Judge not found.",
    assignmentNotFound: "Judge assignment not found.",
    hasActiveAssignment:
      "This judge is still assigned to an unfinished competition.",
  },
  round: {
    // Unit 07. The dev trigger is controller-only and non-production; the pause
    // and resume surface will be wired to the controller commands in Unit 11.
    forbidden: "Only a controller can run this round command.",
    devOnly: "This trigger is available only outside production.",
    competitionNotWaiting:
      "The competition is not waiting to start; the first round cannot be triggered.",
    stageMissing: "The competition's stage 1 is missing.",
    roundMissing: "The stage's round 1 is missing.",
    alreadyActive: "Another round is already running for this competition.",
    noActiveTimer: "No round timer is running for this competition.",
  },
  gameplay: {
    // Unit 07. Autosave and grid restore are participant-scoped: a participant
    // reads and writes only their own grid, only while the round is active.
    forbidden: "You cannot access this round's working grid.",
    roundNotFound: "Round not found.",
    notActive: "The round is not active.",
    notAParticipant: "You are not a participant in this round.",
  },
  scoring: {
    // Unit 08. The scoring module is invoked server-side only; these strings are
    // for the few places it surfaces a failure to log.
    noQuestions: "The round has no questions to score.",
  },
  ranking: {
    // Unit 09. The controller-facing ranking read is controller-only (ROL-002).
    forbidden: "Only a controller can read a ranking.",
    notFound: "Ranking not found.",
  },
  bigScreen: {
    // Unit 09. The big screen has no login; its link token is the only gate
    // (BSC-001). The rejection is generic — it never hints at why the token failed.
    unauthorized: "This big-screen link is not valid.",
    // Unit 11: the controller sets the display mode (BSC-002).
    invalidMode: "This display mode is not supported.",
  },
  orchestrator: {
    // Unit 10. The restart is rejected when the round is not currently running
    // (spec: restart is allowed only while the round is ACTIVE or PAUSED).
    roundNotRunning: "The round is not running.",
    participantNotFound: "The participant is not on this round.",
    // Unit 11. Every command below is controller-only and writes an AuditLog row.
    forbidden: "Only a controller can run this command.",
    competitionClosed:
      "This competition has already finished or been cancelled; no further command is accepted.",
    stageNotFound: "The stage is not part of this competition.",
    stageNotWaiting: "This stage has already started.",
    stageOutOfSequence: "An earlier stage has not finished yet.",
    roundNotFound: "Round not found.",
    roundNotInCompetition: "The round is not part of this competition.",
    nothingToPause: "There is no running timer to pause.",
    nothingToResume: "There is no paused timer to resume.",
    resetNotAllowed: "A finished or cancelled competition cannot be reset.",
    teamNotFound: "Team not found.",
    bigScreenForbidden: "A big screen cannot send display commands.",
  },
  judgeSupervision: {
    // Unit 10. Every judge-facing endpoint is JUDGE-only and range-scoped by
    // Unit 06's authority check. Unit 11 admits the CONTROLLER role on the same
    // endpoints (spec Detail 6 — not a separate code path), so the message names
    // both roles.
    forbidden: "Only a judge or the controller can use this endpoint.",
    outOfRange: "This participant is outside your assigned range.",
  },
  question: {
    // Unit 05. Every endpoint is controller-only (ROL-002). The `import.*` keys are
    // the row-level rejection reasons a 422 lists, so each names the problem plainly;
    // the client shows it beside the row number the API returns.
    forbidden: "Only a controller can manage questions.",
    notFound: "Question set not found.",
    import: {
      noFile: "Choose an Excel file to upload.",
      notAnExcelFile: "This is not a readable .xlsx file.",
      emptyFile: "The file has no question rows.",
      missingRequiredColumn: "The file is missing a required column.",
      variantRequired: "The variant (*类目) is empty.",
      irregularVariantUnsupported:
        "Irregular (不规则) variant files cannot be imported yet.",
      unknownVariant: "This variant is not recognized.",
      invalidPoints: "Points must be a whole number of 1 or more.",
      invalidGridWidth: "Grid width must be a positive whole number.",
      invalidGridHeight: "Grid height must be a positive whole number.",
      unsupportedGridShape: "These grid dimensions cannot form a box partition.",
      givenColumnMissing: "The given-cells column is missing.",
      invalidGivenGrid: "The given-cells grid is not a well-formed array.",
      invalidAnswerGrid: "The answer grid is not a well-formed array.",
      gridsNotComplementary:
        "The given cells and the answers do not cover the grid exactly once.",
      mixedVariants: "One file may only hold a single variant; this file mixes several.",
    },
    selection: {
      notIndividualRound: "Only an Individual round holds a question selection.",
      locked:
        "This round's preparation has begun; its question selection can no longer change.",
      invalidCount: "Select exactly 6 questions.",
      duplicateIds: "The same question cannot be selected twice.",
      notInPool: "One of the selected questions is not in this category's pool.",
    },
  },
  results: {
    // The results screen, the correction form and the export action are all
    // controller-only surfaces, so each message names what went wrong plainly.
    forbidden: "Only a controller can view results, correct a score or export.",
    competitionNotFound: "Competition not found.",
    competitionCancelled:
      "This competition was cancelled; its results are never released.",
    reasonRequired: "A reason is required to correct a score.",
    unsupportedTargetType:
      "Only a participant's score can be corrected; team and school results do not exist yet.",
    resultNotFound: "There is no result for that participant in that round.",
    roundNotFound: "That round does not belong to this competition.",
    invalidScore: "The corrected score must be a whole number of 0 or more.",
  },
} as const;

/** Recursively widens the literal `en` catalogue to `string` leaves, keeping its shape. */
type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type MessageCatalogue = DeepString<typeof en>;
