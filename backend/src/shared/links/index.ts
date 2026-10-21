import { env } from "../../config/env";

/**
 * The one place where the platform's public links are composed.
 *
 * Every URL handed to a human being is built here and nowhere else — the report of
 * 2026-10-19 (§9b/§9d) found the rule written in one helper inside the participant
 * module, used only for the credential slips, so the publish screen had no way to
 * show a link and printed raw UUID tokens instead. Two consumers (the slips, the
 * publish result) must not be able to drift apart, so the rule lives in `shared/`,
 * beside the clock and the catalogues.
 *
 * `PUBLIC_BASE_URL` is the address a tablet in the room can actually open (see
 * `config/env.ts`). When it is not configured every function here returns `""`: a blank is
 * honest, a URL built from a wrong base is not — the caller says "not configured"
 * rather than showing a link that leads nowhere.
 */

/** The trimmed public base, without any trailing slash. Empty when unset. */
function publicBase(): string {
  return env.PUBLIC_BASE_URL.trim().replace(/\/+$/, "");
}

/**
 * The unified entry link: `/enter?token=<entryLinkToken>`. **One link per competition,
 * opened by both a student and a judge** (hole D, 2026-10-20). The token names the
 * competition (ARCH-030 — there is no global competition-selection screen), and the role
 * is chosen on the login page it leads to, so the address printed once at publish is the
 * address everybody in the room uses. The server checks at login that the account really
 * belongs to that competition — through its `Participant` row for a student, through its
 * `CompetitionJudgeAssignment` for a judge — and rejects a mismatch with the same generic
 * message as a wrong password (AUTH-002), so the link leaks nothing about who is in it.
 *
 * `/enter` is a role-neutral path on purpose: `/player?token=…` and `/judge?token=…`
 * would both work, but two addresses to remember and print is how the two halves drift
 * apart, and nothing would stop a judge from opening the player one.
 */
export function entryUrl(entryLinkToken: string): string {
  const base = publicBase();
  return base === "" ? "" : `${base}/enter?token=${encodeURIComponent(entryLinkToken)}`;
}

/**
 * The player entry link: `/player?token=<entryLinkToken>`. Still composed, and still
 * correct — it is what each credential slip carries, because a student's own slip should
 * open straight onto their own competition room rather than onto a role choice. The
 * publish screen shows {@link entryUrl} instead, the one address shared by both roles.
 *
 * The token is what identifies the competition (ARCH-030 — there is no global
 * competition-selection screen), so the whole competition is named by this one URL.
 */
export function playerEntryUrl(entryLinkToken: string): string {
  const base = publicBase();
  return base === "" ? "" : `${base}/player?token=${encodeURIComponent(entryLinkToken)}`;
}

/**
 * The big-screen link: `/big-screen/<bigScreenLinkToken>`. A path segment rather than
 * a query parameter, because that is the route the big-screen page already reads
 * (`App.tsx`, `/big-screen/:token`) and the token is its only credential (BSC-001).
 */
export function bigScreenUrl(bigScreenLinkToken: string): string {
  const base = publicBase();
  return base === "" ? "" : `${base}/big-screen/${encodeURIComponent(bigScreenLinkToken)}`;
}

/** True when a public base is configured, i.e. when the two URLs above are real. */
export function hasPublicBase(): boolean {
  return publicBase() !== "";
}
