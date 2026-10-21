import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { clearEntryRoleHint, loadSession, landingPath, setEntryToken, takeEntryToken } from "./session";

/**
 * The unified entry link's landing route: `/enter?token=<entryLinkToken>` (hole D,
 * 2026-10-20). **One link per competition, for students and judges alike** — the address
 * printed on the publish card and read out in the room. This page is deliberately not a
 * screen: it remembers the token, then hands over.
 *
 * Why a route of its own rather than reusing `/player?token=…`: that path belongs to the
 * player's round runtime, and its gate bounces anyone whose session is not PLAYER. A
 * judge opening it would be sent to `/judge` *before* the token had any effect, so the
 * link would silently stop identifying the competition for one of its two roles. The
 * neutral path has no role gate at all — the role is chosen on the login page.
 *
 * The token is written to `sessionStorage` (per tab, never in the URL twice) and consumed
 * by exactly one successful login, exactly as the player path always did. It is **not** a
 * credential: the username and password still decide who gets in, the token only decides
 * which competition, and the server rejects a mismatch with the same generic message as a
 * wrong password (AUTH-002).
 *
 * An already-open session skips the login page entirely and lands on its own role's home —
 * a student whose tablet kept the session open must not be asked to sign in again. The
 * token is then discarded rather than left in storage, because nothing will verify it and
 * a later, unrelated login must not be scoped by a stale competition.
 */
export function EnterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const session = loadSession();

    if (session) {
      // Drop any token this URL carried, and any hint left by an earlier visit.
      if (token !== null && token !== "") takeEntryToken();
      clearEntryRoleHint();
      navigate(landingPath(session.role), { replace: true });
      return;
    }

    if (token !== null && token !== "") {
      setEntryToken(token);
    }
    // No role hint: this link serves both roles, so the login page shows the choice
    // instead of guessing. `PlayerPage` sets the hint, being a player-only path.
    clearEntryRoleHint();
    navigate("/login", { replace: true });
  }, [searchParams, navigate]);

  return null;
}
