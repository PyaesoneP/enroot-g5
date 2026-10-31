// Data Access Layer (issue #6, ADR-004): the only module that imports a
// Supabase client. Server-only: UI components call these functions, never
// the store directly. Client components reach rsvp() through /api/rsvp.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VibeId } from "@/lib/content";

// Lazy: importing this module must not throw at build time (Vercel collects
// page data before runtime env is guaranteed); only calls need the env.
let client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (see README)",
      );
    }
    // anon role: RLS + column grants apply. The service-role key is never
    // imported here; organiser scripts use it via scripts/export-rsvps.mjs.
    client = createClient(url, anonKey);
  }
  return client;
}

export type RsvpPicks = { id: string; slot: number }[];

export type RsvpInput = {
  nickname: string;
  consent: boolean;
  groupSize: number;
  vibe: VibeId | null;
  picks: RsvpPicks | null;
};

// 'closed' = the DB insert policy refused (registration closed or capacity
// reached); 'db_error' = transport/server failure. Validation happens in
// /api/rsvp before this is called. No .select(): anon has no SELECT on
// rsvps by design (0004), and return=representation would need it.
export type RsvpReject = "closed" | "db_error";

export async function rsvp(input: RsvpInput): Promise<{ ok: true } | { ok: false; reason: RsvpReject }> {
  const { error } = await getClient().from("rsvps").insert({
    nickname: input.nickname,
    consent_given: input.consent,
    group_size: input.groupSize,
    vibe: input.vibe,
    picks: input.picks,
  });
  if (error) {
    // 42501 insufficient_privilege: RLS policy denial. 23514: capacity CHECK.
    return { ok: false, reason: error.code === "42501" || error.code === "23514" ? "closed" : "db_error" };
  }
  return { ok: true };
}

// Live sign-up count. Returns null when the organiser hides it
// (event_config.live_count_visible = false) or on failure — the landing
// page renders nothing in that case.
export async function rsvpCount(): Promise<number | null> {
  try {
    const { data, error } = await getClient().rpc("rsvp_live_count", undefined);
    if (error || data === null) return null;
    return data as number;
  } catch {
    return null;
  }
}
