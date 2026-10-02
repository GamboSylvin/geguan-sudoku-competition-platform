import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

/**
 * jsdom does not implement TextEncoder/TextDecoder, and React Router v7 (used by the
 * login test's MemoryRouter) needs them at module load. Node ships spec-compliant
 * implementations, so we expose those on the jsdom global (Unit 02 test infra).
 */
if (typeof globalThis.TextEncoder === "undefined") {
  const globalWithCodecs = globalThis as unknown as {
    TextEncoder: unknown;
    TextDecoder: unknown;
  };
  globalWithCodecs.TextEncoder = TextEncoder;
  globalWithCodecs.TextDecoder = TextDecoder;
}
