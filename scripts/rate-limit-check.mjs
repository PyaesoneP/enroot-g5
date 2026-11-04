// Orchestration test for reserveSignup/releaseSignup (issue #11) with a
// fake store, no database:
//   node --no-warnings --conditions=react-server --experimental-strip-types \
//     --import ./scripts/ts-alias-hooks.mjs scripts/rate-limit-check.mjs
// The store primitives themselves are covered by
// supabase/tests/rate_limit_acceptance.sql.
import assert from "node:assert/strict";
import { releaseSignup, reserveSignup } from "../src/lib/rate-limit.ts";

const ok = { allowed: true, retryAfterSec: 0 };
const no = (s) => ({ allowed: false, retryAfterSec: s });

// answers: per key prefix ("ip" / "guest") what hit() returns.
function fakeStore(answers) {
  const calls = { hit: [], release: [] };
  return {
    calls,
    store: {
      hit: async (key, windowSec, max) => {
        calls.hit.push({ kind: key.split(":")[0], windowSec, max });
        return answers[key.split(":")[0]];
      },
      release: async (key) => {
        calls.release.push(key.split(":")[0]);
      },
    },
  };
}

const errors = [];
const origError = console.error;
console.error = (...args) => errors.push(args.join(" "));
const withGuest = { ip: "203.0.113.9", guest: "22222222-2222-4222-8222-222222222222" };

try {
  // 1. Both allow -> allowed; limits passed through; nothing released.
  {
    const f = fakeStore({ ip: ok, guest: ok });
    assert.deepEqual(await reserveSignup(withGuest, f.store), ok);
    assert.deepEqual(f.calls.hit, [
      { kind: "ip", windowSec: 60, max: 10 },
      { kind: "guest", windowSec: 3600, max: 5 },
    ]);
    assert.deepEqual(f.calls.release, []);
  }
  // 2. No cookie -> IP limit only.
  {
    const f = fakeStore({ ip: ok });
    await reserveSignup({ ip: "1.2.3.4", guest: null }, f.store);
    assert.deepEqual(f.calls.hit.map((c) => c.kind), ["ip"]);
  }
  // 3. IP denies -> 429 with its retry; the guest hit is given back.
  {
    const f = fakeStore({ ip: no(40), guest: ok });
    assert.deepEqual(await reserveSignup(withGuest, f.store), no(40));
    assert.deepEqual(f.calls.release, ["guest"]);
  }
  // 4. Both deny -> the longer retry; nothing released.
  {
    const f = fakeStore({ ip: no(40), guest: no(2900) });
    assert.deepEqual(await reserveSignup(withGuest, f.store), no(2900));
    assert.deepEqual(f.calls.release, []);
  }
  // 5. Store down for both -> fail-open, logged.
  {
    errors.length = 0;
    const f = fakeStore({ ip: null, guest: null });
    assert.deepEqual(await reserveSignup(withGuest, f.store), ok);
    assert.ok(errors.some((e) => e.includes("fail-open")), "fail-open is logged");
  }
  // 6. One down, the other denies -> 429, and NO fail-open log (review fix).
  {
    errors.length = 0;
    const f = fakeStore({ ip: null, guest: no(2900) });
    assert.deepEqual(await reserveSignup(withGuest, f.store), no(2900));
    assert.ok(!errors.some((e) => e.includes("fail-open")), "no misleading fail-open log");
  }
  // 7. release gives back every limit that applies.
  {
    const f = fakeStore({});
    await releaseSignup(withGuest, f.store);
    assert.deepEqual(f.calls.release.sort(), ["guest", "ip"]);
  }
} finally {
  console.error = origError;
}
console.log("rate-limit orchestration: 7/7 pass");
