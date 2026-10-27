import type { Config } from "jest";

/**
 * Jest is the one test runner for the backend (I-32 / BLD-018), run through ts-jest.
 * It is wired into the CI pipeline of BLD-002. Scope: the necessary minimum for the MVP.
 *
 * The two timeout budgets below are 40000 ms rather than Jest's 5000 ms default
 * (I-58, decided 2026-10-26 by the project owner — option (a)). They are widened for a
 * measured host cost, not to mask a slow test: `bcryptjs` is pure JS and CPU-bound at
 * `BCRYPT_COST = 10`, and on this Docker host one hash costs 542 ms cold then 192-346 ms,
 * one hash+compare 377 ms. Every suite's `beforeAll` performs exactly one `createAccount`
 * (a hash) and one `login` (a compare), so the default 5000 ms hook budget is largely spent
 * before any test body runs — `scoring.test.ts` failed 16/16 on `Exceeded timeout of 5000 ms
 * for a hook` with zero false assertions, and passed 16/16 on byte-identical code at
 * 40000 ms. The alternatives considered and rejected were a command-line flag only (not
 * reproducible for the next contributor) and lowering `BCRYPT_COST` under test (touches
 * application code and weakens the path under test).
 *
 * `hookTimeout` is deliberately **not** set here: this Jest version's config type does not
 * accept it (`error TS2353: 'hookTimeout' does not exist in type ...`, measured), and hooks
 * already inherit `testTimeout`. Neither setting changes what a test asserts.
 */
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testTimeout: 40000,
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  clearMocks: true,
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/index.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
};

export default config;
