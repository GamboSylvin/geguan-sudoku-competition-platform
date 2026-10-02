// Test stand-in for `src/config/env.ts`: Jest maps `@/config/env` here so the Vite-only
// `import.meta.env` syntax never reaches the CommonJS test transform (Unit 02 test infra).
module.exports = {
  API_BASE_URL: "http://localhost:3000",
};
