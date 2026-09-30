import type { Config } from "jest";

/**
 * Jest is the one test runner for the backend (I-32 / BLD-018), run through ts-jest.
 * It is wired into the CI pipeline of BLD-002. Scope: the necessary minimum for the MVP.
 */
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
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
