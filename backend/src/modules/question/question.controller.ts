/**
 * The Question module. Owns: Question import and validation, question packs, assignment of questions to rounds.
 *
 * Skeleton only — no feature code (Unit 01, spec 01-foundation). The files follow
 * the decided module layout (BLD-020): controller (HTTP), service (domain rules and
 * the public interface), repository (Prisma access), types, and this barrel.
 */
import { Router } from "express";

/**
 * HTTP layer for the Question module. It validates input, then calls the service;
 * no domain rule lives here. No route is mounted yet.
 */
export const questionRouter = Router();
