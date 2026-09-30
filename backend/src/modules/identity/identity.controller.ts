/**
 * The Identity module. Owns: Players, teams, player and judge accounts, participant membership, competition-specific access.
 *
 * Skeleton only — no feature code (Unit 01, spec 01-foundation). The files follow
 * the decided module layout (BLD-020): controller (HTTP), service (domain rules and
 * the public interface), repository (Prisma access), types, and this barrel.
 */
import { Router } from "express";

/**
 * HTTP layer for the Identity module. It validates input, then calls the service;
 * no domain rule lives here. No route is mounted yet.
 */
export const identityRouter = Router();
