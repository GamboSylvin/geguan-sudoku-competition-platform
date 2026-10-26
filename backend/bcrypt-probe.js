// Temporary measurement probe (2026-10-22): plain JS, copied into the backend container
// and run with `node`. Times bcrypt hashing/comparing at the cost factor the app uses,
// plus one Postgres round-trip, to explain why some suites' beforeAll exceeds Jest's
// 5000 ms default hook timeout. Deleted after use; writes nothing.
const bcrypt = require("bcryptjs");

async function main() {
  const t0 = Date.now();
  const h1 = await bcrypt.hash("test-pass-1234", 10);
  const t1 = Date.now();
  await bcrypt.compare("test-pass-1234", h1);
  const t2 = Date.now();
  console.log("hash ms:", t1 - t0);
  console.log("compare ms:", t2 - t1);
  console.log("node version:", process.version);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
