/**
 * English message catalogue. English and Chinese are the only locales for now
 * (ARCH-026, Unit 01 acceptance criterion 5); a third language is OPEN (U-51).
 * The actual screen strings arrive with each screen — this is the scaffold.
 */
export const en = {
  common: {
    appName: "Sudoku Arena",
    loading: "Loading…",
    notFound: "Not found",
    validationFailed: "Validation failed",
    internalError: "Something went wrong",
  },
  placeholder: {
    title: "Sudoku Arena",
    subtitle: "Foundation is in place. Screens arrive in later units.",
  },
  auth: {
    title: "Sudoku Arena",
    chooseRole: "Choose your role",
    username: "Username",
    password: "Password",
    submit: "Log in",
    logout: "Log out",
    invalidCredentials: "Incorrect username or password",
    role: {
      player: "Player",
      judge: "Judge",
      controller: "Controller",
    },
    landing: {
      subtitle: "You are signed in. This screen is a placeholder for a later unit.",
      signedInAs: "Signed in as",
      player: "Player home",
      judge: "Judge home",
      controller: "Controller home",
    },
  },
  competition: {
    title: "Create a competition",
    name: "Competition name",
    description: "Description (optional)",
    categories: "Categories",
    categoryCode: "Code",
    categoryName: "Name",
    addCategory: "Add category",
    removeCategory: "Remove",
    create: "Create competition",
    wifiNote:
      "Before the event, ask your network/IT team to properly configure the venue Wi-Fi — about 300 tablets connect at once, and the venue Wi-Fi is the biggest real-world risk.",
    created: "Competition created",
    structure: "Structure (created automatically)",
    rounds: "rounds",
    roundDuration: "Duration (seconds)",
    saveRound: "Save",
    saved: "Saved",
    publish: "Publish",
    published: "Published",
    entryLink: "Entry link",
    bigScreenLink: "Big-screen link",
    notReady: "Not ready to publish. Still missing:",
    genericError: "Something went wrong. Please try again.",
    duration: {
      INDIVIDUAL1: "Individual round 1",
      INDIVIDUAL2: "Individual round 2",
      TEAM1: "Team round 1",
      TEAM2: "Team round 2",
    },
  },
} as const;

/** Recursively widens the literal `en` catalogue to `string` leaves, keeping its shape. */
type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type MessageCatalogue = DeepString<typeof en>;
