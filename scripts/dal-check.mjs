// Data layer smoke check (issue #6): proves the DAL is callable from a
// plain script, outside Next. Uses the live store from .env.local:
//   node --no-warnings --env-file=.env.local --conditions=react-server --experimental-strip-types scripts/dal-check.mjs
// E2E flood test helpers (issues #11, #14, #16; action = signup|wall|gallery):
//   ... dal-check.mjs seed <action> ip|guest <value>   fill that identity's window
//   ... dal-check.mjs clear <action> ip|guest <value>  drop all its windows
// Exits non-zero if any store call fails.
import { listWall, rateLimitClear, rateLimitHit, rateLimitRelease, rsvpCountStatus, wallOpen } from "../src/lib/db.ts";
import { LIMITS, limitKey } from "../src/lib/rate-limit-keys.ts";

const fail = (msg) => {
  console.error(`dal-check: ${msg}`);
  process.exit(1);
};

const [cmd, action, kind, value] = process.argv.slice(2);
if (cmd === "seed" || cmd === "clear") {
  if (!LIMITS[action]?.[kind] || !value) fail("usage: seed|clear signup|wall|gallery ip|guest <value>");
  const key = limitKey(action, kind, value);
  if (cmd === "seed") {
    const { windowSec, max } = LIMITS[action][kind];
    for (let i = 0; i < max; i++) {
      if ((await rateLimitHit(key, windowSec, max)) === null) fail(`seed hit ${i + 1} failed`);
    }
    console.log(`seed ${action} ${kind} ${value}: ${max} hits`);
  } else {
    const removed = await rateLimitClear(key);
    if (removed === null) fail("clear failed");
    console.log(`clear ${action} ${kind} ${value}: ${removed} row(s) removed`);
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
  const open = await wallOpen();
  const posts = await listWall(null, 5);
  console.log("wallOpen:", open, "listWall(null, 5):", posts === null ? null : `${posts.length} post(s)`);
  if (open === null || posts === null) fail("wall reads failed (migration 0011 applied?)");
}
