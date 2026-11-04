// Data layer smoke check (issue #6): proves the DAL is callable from a
// plain script, outside Next. Uses the live store from .env.local:
//   node --no-warnings --env-file=.env.local --conditions=react-server --experimental-strip-types scripts/dal-check.mjs
// E2E flood test helpers (issue #11):
//   ... dal-check.mjs seed ip|guest <value>   fill that identity's window
//   ... dal-check.mjs clear ip|guest <value>  drop all its windows
// Exits non-zero if any store call fails.
import { rateLimitClear, rateLimitHit, rateLimitRelease, rsvpCountStatus } from "../src/lib/db.ts";
import { LIMITS, limitKey } from "../src/lib/rate-limit-keys.ts";

const fail = (msg) => {
  console.error(`dal-check: ${msg}`);
  process.exit(1);
};

const [cmd, kind, value] = process.argv.slice(2);
if (cmd === "seed" || cmd === "clear") {
  if (!LIMITS[kind] || !value) fail("usage: seed|clear ip|guest <value>");
  const key = limitKey(kind, value);
  if (cmd === "seed") {
    const { windowSec, max } = LIMITS[kind];
    for (let i = 0; i < max; i++) {
      if ((await rateLimitHit(key, windowSec, max)) === null) fail(`seed hit ${i + 1} failed`);
    }
    console.log(`seed ${kind} ${value}: ${max} hits`);
  } else {
    const removed = await rateLimitClear(key);
    if (removed === null) fail("clear failed");
    console.log(`clear ${kind} ${value}: ${removed} row(s) removed`);
  }
} else {
  const count = await rsvpCountStatus();
  console.log("rsvpCountStatus:", count);
  if (count.status === "error") fail("rsvpCountStatus failed");
  const key = `test:dal-check:${Date.now()}`;
  const first = await rateLimitHit(key, 60, 1);
  const second = await rateLimitHit(key, 60, 1);
  console.log("rateLimitHit:", first, "then (expect denied):", second);
  if (!first?.allowed || second?.allowed !== false) fail("rateLimitHit did not allow-then-deny");
  await rateLimitRelease(key, 60);
  const removed = await rateLimitClear(key);
  if (removed !== 1) fail(`rateLimitClear removed ${removed}, expected 1`);
  console.log("rateLimitRelease + rateLimitClear: ok");
}
