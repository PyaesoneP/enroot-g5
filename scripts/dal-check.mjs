// Data layer smoke check (issue #6): proves the DAL is callable from a
// plain script, outside Next. Uses the live store from .env.local:
//   node --no-warnings --env-file=.env.local --conditions=react-server --experimental-strip-types scripts/dal-check.mjs
// Optional: `seed-ip <ip>` fills that IP's sign-up window (10 hits), and
// `clear-ip <ip>` empties it again (for the e2e flood test, issue #11).
import { createHmac } from "node:crypto";
import { rateLimitHit, rateLimitRelease, rsvpCountStatus } from "../src/lib/db.ts";

// Same key derivation as src/lib/rate-limit.ts (kept in step by hand).
const key = (kind, value) =>
  `${kind}:${createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update(value).digest("base64url")}`;

const [cmd, arg] = process.argv.slice(2);
if (cmd === "seed-ip" || cmd === "clear-ip") {
  const k = key("ip", arg);
  for (let i = 0; i < 10; i++) {
    if (cmd === "seed-ip") await rateLimitHit(k, 60, 10);
    else await rateLimitRelease(k, 60);
  }
  console.log(`${cmd} ${arg}: done`);
} else {
  console.log("rsvpCountStatus:", await rsvpCountStatus());
  const k = `test:dal-check:${Date.now()}`;
  console.log("rateLimitHit:", await rateLimitHit(k, 60, 1));
  console.log("rateLimitHit (2nd, expect denied):", await rateLimitHit(k, 60, 1));
  await rateLimitRelease(k, 60);
  await rateLimitRelease(k, 60);
  console.log("rateLimitRelease: ok");
}
