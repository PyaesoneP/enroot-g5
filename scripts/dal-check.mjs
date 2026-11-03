// Data layer smoke check (issue #6): proves the DAL is callable from a
// plain script, outside Next. Uses the live store from .env.local:
//   node --no-warnings --env-file=.env.local --conditions=react-server --experimental-strip-types scripts/dal-check.mjs
// Optional (e2e flood test, issue #11): `seed ip|guest <value>` fills that
// identity's sign-up window; `clear ip|guest <value>` empties it again.
import { createHmac } from "node:crypto";
import { rateLimitHit, rateLimitRelease, rsvpCountStatus } from "../src/lib/db.ts";

// Same key derivation and limits as src/lib/rate-limit.ts (kept in step by hand).
const key = (kind, value) =>
  `${kind}:${createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update(value).digest("base64url")}`;
const LIMITS = { ip: { windowSec: 60, max: 10 }, guest: { windowSec: 3600, max: 5 } };

const [cmd, kind, value] = process.argv.slice(2);
if ((cmd === "seed" || cmd === "clear") && LIMITS[kind] && value) {
  const { windowSec, max } = LIMITS[kind];
  const k = key(kind, value);
  for (let i = 0; i < max; i++) {
    if (cmd === "seed") await rateLimitHit(k, windowSec, max);
    else await rateLimitRelease(k, windowSec);
  }
  console.log(`${cmd} ${kind} ${value}: done`);
} else {
  console.log("rsvpCountStatus:", await rsvpCountStatus());
  const k = `test:dal-check:${Date.now()}`;
  console.log("rateLimitHit:", await rateLimitHit(k, 60, 1));
  console.log("rateLimitHit (2nd, expect denied):", await rateLimitHit(k, 60, 1));
  await rateLimitRelease(k, 60);
  await rateLimitRelease(k, 60);
  console.log("rateLimitRelease: ok");
}
