/**
 * HTTP layer for the Identity module (Unit 02). It validates input, then calls the
 * service; no domain rule lives here.
 *
 * Login endpoints are per role, not one generic endpoint with a role parameter
 * (code-standards, API conventions): controller, judge and player each get their
 * own path under `/api/auth`.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import type { AccountRole } from "@prisma/client";
import { parseInput } from "../../shared/validation";
import { NotFoundError } from "../../shared/errors";
import { translate } from "../../shared/i18n";
import { identityService } from "./identity.service";
import type { DeviceInfo } from "./identity.types";

export const identityRouter = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
  /**
   * Optional: the competition's entry-link token from `/enter?token=…` (ARCH-030). It
   * scopes the login to that competition; it never replaces the credentials. Honoured
   * for a player **and** a judge — one link serves both (hole D, 2026-10-20); ignored
   * for a controller, who is not scoped to a single competition (ROL-004).
   */
  entryLinkToken: z.string().trim().min(1).max(128).optional(),
});

const roleParamSchema = z.object({
  role: z.enum(["controller", "judge", "player"]),
});

/** The public entry-link lookup. One path segment, the token the link carries. */
const entryLinkSchema = z.object({
  token: z.string().trim().min(1).max(128),
});

const ROLE_BY_SLUG: Record<z.infer<typeof roleParamSchema>["role"], AccountRole> = {
  controller: "CONTROLLER",
  judge: "JUDGE",
  player: "PLAYER",
};

const SESSION_HEADER = "x-session-token";
const DEVICE_HEADER = "x-device-id";

function readDevice(req: Request): DeviceInfo {
  return {
    deviceLabel: (req.get(DEVICE_HEADER) ?? "").trim() || null,
    userAgent: req.get("user-agent") ?? null,
  };
}

/**
 * GET /api/auth/entry-link/:token — the public name of the competition a link leads to.
 *
 * Unauthenticated on purpose (hole D, 2026-10-20): the login screen asks this *before*
 * anybody has signed in, so it can say "Welcome to <name>" instead of showing an
 * anonymous form. It answers with a name and nothing else — no participant, no judge, no
 * category, no round — and 404s on a token no competition carries.
 */
identityRouter.get(
  "/entry-link/:token",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = parseInput(entryLinkSchema, req.params);
      const competitionName = await identityService.entryLinkCompetitionName(token);
      if (competitionName === null) {
        throw new NotFoundError(translate("en", "auth.entryLinkUnknown"), {
          code: "auth.entryLinkUnknown",
        });
      }
      res.status(200).json({ competitionName });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/auth/:role/login — body `{ username, password }`.
 * 200 with the session token, role, account id and expiry on success; 401 with one
 * generic message on any rejected login (AUTH-002).
 */
identityRouter.post(
  "/:role/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = parseInput(roleParamSchema, req.params);
      const input = parseInput(loginSchema, req.body);
      const result = await identityService.login(
        ROLE_BY_SLUG[role],
        input,
        readDevice(req),
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/auth/logout — ends the current session. 200 on success, 401 if there
 * was no valid session. The Device row is kept (see the service).
 */
identityRouter.post(
  "/logout",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.get(SESSION_HEADER) ?? null;
      await identityService.logout(token);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);
