// Data Access Layer (issue #6, ADR-004): the only module that imports a
// Supabase client. Server-only: UI components call these functions, never
// the store directly. Client components reach rsvp() through /api/rsvp.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VibeId } from "@/lib/content";

// Lazy: importing this module must not throw at build time (Vercel collects
// page data before runtime env is guaranteed); only calls need the env.
let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

function getAnonClient(): SupabaseClient {
  if (!anonClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (see README)",
      );
    }
    anonClient = createClient(url, anonKey);
  }
  return anonClient;
}

// Sign-ups go through submit_rsvp(), a definer function granted to
// service_role only (0007). Direct anon INSERT is revoked, so the route
// is the only door: clients cannot skip its rate limit or validation.
// The key is server-side env only — never a NEXT_PUBLIC_ variable.
function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set (see README)");
    }
    serviceClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return serviceClient;
}

export type RsvpPicks = { id: string; slot: number }[];

// consent is not an input: the route enforces the checkbox, and
// submit_rsvp() stores consent_given = true unconditionally (0007).
export type RsvpInput = {
  nickname: string;
  groupSize: number;
  vibe: VibeId | null;
  picks: RsvpPicks | null;
};

// 'closed' = registration toggle off; 'full' = people-based capacity
// reached; 'invalid' = DB-side validation disagreement (should be
// unreachable, the route validates first); 'db_error' = transport failure.
export type RsvpReject = "closed" | "full" | "invalid" | "db_error";

export async function rsvp(input: RsvpInput): Promise<{ ok: true } | { ok: false; reason: RsvpReject }> {
  const { data, error } = await getServiceClient().rpc("submit_rsvp", {
    p_nickname: input.nickname,
    p_group_size: input.groupSize,
    p_vibe: input.vibe,
    p_picks: input.picks,
  });
  if (error) {
    console.error("[rsvp] submit_rsvp failed:", error.code, error.message);
    return { ok: false, reason: "db_error" };
  }
  const result = data as string | null;
  if (result === "ok") return { ok: true };
  if (result === "closed" || result === "full" || result === "invalid") {
    return { ok: false, reason: result };
  }
  console.error("[rsvp] unexpected submit_rsvp result:", result);
  return { ok: false, reason: "db_error" };
}

// Live sign-up count (people, not rows). Returns null when the organiser
// hides it (event_config.live_count_visible = false) or on failure — the
// landing page renders nothing in that case.
export async function rsvpCount(): Promise<number | null> {
  try {
    const { data, error } = await getAnonClient().rpc("rsvp_live_count", undefined);
    if (error || data === null) return null;
    return data as number;
  } catch {
    return null;
  }
}
