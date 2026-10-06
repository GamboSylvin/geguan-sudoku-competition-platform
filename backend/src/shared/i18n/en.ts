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
  },
} as const;

/** Recursively widens the literal `en` catalogue to `string` leaves, keeping its shape. */
type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type MessageCatalogue = DeepString<typeof en>;
