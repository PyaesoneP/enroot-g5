// Organiser CSV export for issue #15: run locally with the service-role
// key (env only, never committed):  node scripts/export-rsvps.mjs
// The key bypasses RLS; anon must never read rsvps rows.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.local).");
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client
  .from("rsvps")
  .select("nickname, group_size, vibe, picks, created_at")
  .is("deleted_at", null)
  .order("created_at");
if (error) {
  console.error("Export failed:", error.message);
  process.exit(1);
}

const esc = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const rows = [["nickname", "group_size", "vibe", "picks", "created_at"]];
for (const r of data) rows.push([r.nickname, r.group_size, r.vibe ?? "", r.picks ? JSON.stringify(r.picks) : "", r.created_at]);
process.stdout.write(rows.map((r) => r.map(esc).join(",")).join("\n") + "\n");

const byVibe = {};
let people = 0;
for (const r of data) {
  people += r.group_size;
  if (r.vibe) byVibe[r.vibe] = (byVibe[r.vibe] ?? 0) + r.group_size;
}
console.error(`\n${data.length} sign-ups, ${people} people. Per vibe (group-weighted):`);
for (const [v, n] of Object.entries(byVibe).sort((a, b) => b[1] - a[1])) console.error(`  ${v}: ${n}`);
