// Rate-limiter semantics check (no test framework in this repo):
//   node --experimental-strip-types scripts/rate-limit-check.mjs
// Proves the round-2 fix: parallel attempts are reserved up-front, so a
// burst beyond the window cannot all pass; releases make free failures
// genuinely free.
import assert from "node:assert/strict";
import { releaseSignup, reserveSignup } from "../src/lib/rate-limit.ts";

const t0 = 1_700_000_000_000;
const ip = "1.2.3.4";

// Serial burst: 10 allowed, 11th blocked.
for (let i = 0; i < 10; i++) {
  assert.equal(reserveSignup(ip, t0).allowed, true, `attempt ${i + 1} should pass`);
}
assert.equal(reserveSignup(ip, t0).allowed, false, "11th attempt should be blocked");

// Parallel race: reserve happens synchronously before any await, so a
// second concurrent request sees the first's reservation. 10 parallel
// reserves from a fresh IP -> exactly 10 pass.
const ip2 = "5.6.7.8";
const results = Array.from({ length: 12 }, () => reserveSignup(ip2, t0).allowed);
assert.equal(results.filter(Boolean).length, 10, "parallel burst capped at 10");

// Release semantics: failed sign-ups return the slot; blocked again
// after the window; release outside the window is a no-op.
const ip3 = "9.9.9.9";
assert.equal(reserveSignup(ip3, t0).allowed, true);
releaseSignup(ip3, t0 + 5_000);
for (let i = 0; i < 10; i++) {
  assert.equal(reserveSignup(ip3, t0 + 5_000).allowed, true, "released slot reusable");
}
assert.equal(reserveSignup(ip3, t0 + 5_000).allowed, false);
releaseSignup(ip3, t0 + 120_000); // stale window: no-op
assert.equal(reserveSignup(ip3, t0 + 120_000).allowed, true, "new window after expiry");

console.log("rate-limit-check: ALL PASS");
