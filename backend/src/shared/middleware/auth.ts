/**
 * Session-check middleware (Unit 02). Every later module's routes sit behind this
 * from Unit 03 onward (code-standards, "Forbidden / restricted practices": never
 * bypass authentication for an endpoint).
 *
 * It is deliberately generic: it resolves the caller from the session token and
 * attaches it to the request. Role- and competition-scoping checks belong to the
 * units that introduce them (Units 06/07/08/10), not here.
 */
import type { NextFunction, Request, Response } from "express";
import { identityService } from "../../modules/identity";
import type { AuthenticatedAccount } from "../../modules/identity/identity.types";
import { UnauthorizedError } from "../errors";
import { translate } from "../i18n";

/** The header the client sends the session token in (the transport is an implementation detail). */
export const SESSION_HEADER = "x-session-token";
/** The header carrying the device id the login issued; the one-active-device check reads it. */
export const DEVICE_HEADER = "x-device-id";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthenticatedAccount;
    }
  }
}

/**
 * Validate the session and load the caller. Rejects (without revealing which part
 * failed) when the token is missing/unknown/expired, when the account is
 * deactivated, or when the request is from a device that is not the active one.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.get(SESSION_HEADER) ?? null;
    const deviceId = req.get(DEVICE_HEADER) ?? null;
    req.auth = await identityService.authenticate(token, deviceId);
    next();
  } catch (error) {
    next(
      error instanceof UnauthorizedError
        ? error
        : new UnauthorizedError(translate("en", "auth.sessionExpired"), {
            code: "auth.sessionExpired",
          }),
    );
  }
}
