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

// 'closed' = registration toggle off (or config missing — fails closed);
// 'full' = no spots left; 'short' = spots exist but this group does not
// fit (spotsLeft tells the route how many remain); 'invalid' = DB-side
// validation disagreement (should be unreachable, the route validates
// first); 'db_error' = transport failure.
export type RsvpReject = "closed" | "full" | "short" | "invalid" | "db_error";

export type RsvpResult =
  | { ok: true }
  | { ok: false; reason: RsvpReject; spotsLeft?: number };

export async function rsvp(input: RsvpInput): Promise<RsvpResult> {
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
  // TABLE-returning RPCs come back as a one-row ARRAY from supabase-js.
  const rows = data as { status: string; spots_left: number | null }[] | null;
  const row = Array.isArray(rows) ? rows[0] : null;
  const status = row?.status;
  if (status === "ok") return { ok: true };
  if (status === "closed" || status === "full" || status === "short" || status === "invalid") {
    return { ok: false, reason: status, spotsLeft: row?.spots_left ?? undefined };
  }
  console.error("[rsvp] unexpected submit_rsvp result:", data);
  return { ok: false, reason: "db_error" };
}

// Live sign-up count (people, not rows). rsvp_live_count() returns NULL
// when the organiser hides it (event_config.live_count_visible = false), so
// 'hidden' and 'error' are told apart here; the bot words them differently.
export type RsvpCountResult =
  | { status: "ok"; count: number }
  | { status: "hidden" }
  | { status: "error" };

export async function rsvpCountStatus(): Promise<RsvpCountResult> {
  try {
    const { data, error } = await getAnonClient().rpc("rsvp_live_count", undefined);
    if (error) return { status: "error" };
    if (data === null) return { status: "hidden" };
    return { status: "ok", count: data as number };
  } catch {
    return { status: "error" };
  }
}

// Landing page: null (hidden or failed) renders nothing.
export async function rsvpCount(): Promise<number | null> {
  const r = await rsvpCountStatus();
  return r.status === "ok" ? r.count : null;
}

// Store-backed rate limiting (issue #11, migration 0009). Keys arrive
// already hashed from src/lib/rate-limit.ts. null = the limiter could not
// be reached; the caller decides what that means.
export type RateLimitHit = { allowed: boolean; retryAfterSec: number };

export async function rateLimitHit(key: string, windowSec: number, max: number): Promise<RateLimitHit | null> {
  try {
    const { data, error } = await getServiceClient().rpc("rate_limit_hit", {
      p_key: key,
      p_window_sec: windowSec,
      p_max: max,
    });
    const row = Array.isArray(data) ? (data[0] as { allowed: boolean; retry_after: number } | undefined) : undefined;
    if (error || !row) {
      console.error("[rate-limit] rate_limit_hit failed:", error?.code, error?.message);
      return null;
    }
    return { allowed: row.allowed, retryAfterSec: row.retry_after };
  } catch (e) {
    console.error("[rate-limit] rate_limit_hit threw:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function rateLimitRelease(key: string, windowSec: number): Promise<void> {
  try {
    const { error } = await getServiceClient().rpc("rate_limit_release", {
      p_key: key,
      p_window_sec: windowSec,
    });
    if (error) console.error("[rate-limit] rate_limit_release failed:", error.code, error.message);
  } catch (e) {
    console.error("[rate-limit] rate_limit_release threw:", e instanceof Error ? e.message : e);
  }
}

// Daily purge of windows older than a day (0010; /api/cron/purge-rate-limits).
// Returns rows removed, or null on failure.
export async function rateLimitPurge(): Promise<number | null> {
  try {
    const { data, error } = await getServiceClient().rpc("rate_limit_purge", undefined);
    if (error) {
      console.error("[rate-limit] rate_limit_purge failed:", error.code, error.message);
      return null;
    }
    return data as number;
  } catch (e) {
    console.error("[rate-limit] rate_limit_purge threw:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Drops every window of one key (ops / e2e test only). Rows removed, or null.
export async function rateLimitClear(key: string): Promise<number | null> {
  try {
    const { data, error } = await getServiceClient().rpc("rate_limit_clear", { p_key: key });
    if (error) {
      console.error("[rate-limit] rate_limit_clear failed:", error.code, error.message);
      return null;
    }
    return data as number;
  } catch (e) {
    console.error("[rate-limit] rate_limit_clear threw:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Friendship wall (issue #14, migration 0011). `owner` is the HMAC of the
// guest cookie (src/lib/identity.ts); the store never returns it, only
// whether each post is the caller's (`mine`).
export type WallPost = { id: string; name: string | null; body: string; createdAt: string; mine: boolean };

export type WallPostResult =
  | { ok: true; id: string }
  | { ok: false; reason: "closed" | "invalid" | "db_error" };

export async function postWall(owner: string, name: string | null, body: string): Promise<WallPostResult> {
  try {
    const { data, error } = await getServiceClient().rpc("wall_post", {
      p_owner: owner,
      p_name: name,
      p_body: body,
    });
    if (error) {
      console.error("[wall] wall_post failed:", error.code, error.message);
      return { ok: false, reason: "db_error" };
    }
    const row = Array.isArray(data) ? (data[0] as { status: string; id: string | null } | undefined) : undefined;
    if (row?.status === "ok" && row.id) return { ok: true, id: row.id };
    if (row?.status === "closed" || row?.status === "invalid") return { ok: false, reason: row.status };
    console.error("[wall] unexpected wall_post result:", data);
    return { ok: false, reason: "db_error" };
  } catch (e) {
    console.error("[wall] wall_post threw:", e instanceof Error ? e.message : e);
    return { ok: false, reason: "db_error" };
  }
}

// Newest first. null = the store could not be read (the page says so
// instead of showing an empty wall).
export async function listWall(owner: string | null, limit: number): Promise<WallPost[] | null> {
  try {
    const { data, error } = await getServiceClient().rpc("wall_list", { p_owner: owner, p_limit: limit });
    if (error || !Array.isArray(data)) {
      console.error("[wall] wall_list failed:", error?.code, error?.message);
      return null;
    }
    return (data as { id: string; name: string | null; body: string; created_at: string; mine: boolean }[]).map(
      (r) => ({ id: r.id, name: r.name, body: r.body, createdAt: r.created_at, mine: r.mine }),
    );
  } catch (e) {
    console.error("[wall] wall_list threw:", e instanceof Error ? e.message : e);
    return null;
  }
}

// true = deleted; false = not yours / not found; null = store error.
export async function deleteWall(owner: string, id: string): Promise<boolean | null> {
  try {
    const { data, error } = await getServiceClient().rpc("wall_delete", { p_owner: owner, p_id: id });
    if (error) {
      console.error("[wall] wall_delete failed:", error.code, error.message);
      return null;
    }
    return data === true;
  } catch (e) {
    console.error("[wall] wall_delete threw:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Whether posting is open (event_config.wall_open). Public flag, read with
// the anon client like the live count. null = unknown (store unreachable).
export async function wallOpen(): Promise<boolean | null> {
  try {
    const { data, error } = await getAnonClient()
      .from("event_config")
      .select("wall_open")
      .eq("id", true)
      .maybeSingle();
    if (error) {
      console.error("[wall] wall_open read failed:", error.code, error.message);
      return null;
    }
    return data ? (data as { wall_open: boolean }).wall_open : false;
  } catch (e) {
    console.error("[wall] wall_open read threw:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Saved outputs / gallery (issue #16, migration 0013). The payload is the
// module's own serialized form, validated by the module before saving.
export type SavedOutput = { id: string; activityId: string; payload: string; createdAt: string; mine: boolean };

// The id (new, or the existing one if this owner already shared the same
// payload), or null on failure.
export async function saveOutput(owner: string, activityId: string, payload: string): Promise<string | null> {
  try {
    const { data, error } = await getServiceClient().rpc("output_save", {
      p_owner: owner,
      p_activity: activityId,
      p_payload: payload,
    });
    if (error || typeof data !== "string") {
      console.error("[gallery] output_save failed:", error?.code, error?.message ?? "no id returned");
      return null;
    }
    return data;
  } catch (e) {
    console.error("[gallery] output_save threw:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Newest first; activityId null = every activity. null = store error.
export async function listOutputs(
  owner: string | null,
  activityId: string | null,
  limit: number,
): Promise<SavedOutput[] | null> {
  try {
    const { data, error } = await getServiceClient().rpc("output_list", {
      p_owner: owner,
      p_activity: activityId,
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) {
      console.error("[gallery] output_list failed:", error?.code, error?.message);
      return null;
    }
    return (
      data as { id: string; activity_id: string; payload: string; created_at: string; mine: boolean }[]
    ).map((r) => ({ id: r.id, activityId: r.activity_id, payload: r.payload, createdAt: r.created_at, mine: r.mine }));
  } catch (e) {
    console.error("[gallery] output_list threw:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Every entry this owner shared, however old (0014): the gallery's "Your
// bracelets" section, so Remove stays reachable after an entry drops off
// the newest page. [] for no owner; null = store error.
export async function listMyOutputs(owner: string | null, limit: number): Promise<SavedOutput[] | null> {
  if (!owner) return [];
  try {
    const { data, error } = await getServiceClient().rpc("output_list_mine", { p_owner: owner, p_limit: limit });
    if (error || !Array.isArray(data)) {
      console.error("[gallery] output_list_mine failed:", error?.code, error?.message);
      return null;
    }
    return (data as { id: string; activity_id: string; payload: string; created_at: string }[]).map((r) => ({
      id: r.id,
      activityId: r.activity_id,
      payload: r.payload,
      createdAt: r.created_at,
      mine: true,
    }));
  } catch (e) {
    console.error("[gallery] output_list_mine threw:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Activity ids that have outputs ([] on failure: the filter just hides).
export async function outputActivities(): Promise<string[]> {
  try {
    const { data, error } = await getServiceClient().rpc("output_activities", undefined);
    return !error && Array.isArray(data) ? (data as string[]) : [];
  } catch {
    return [];
  }
}

// true = removed; false = not yours / not found; null = store error.
export async function deleteOutput(owner: string, id: string): Promise<boolean | null> {
  try {
    const { data, error } = await getServiceClient().rpc("output_delete", { p_owner: owner, p_id: id });
    if (error) {
      console.error("[gallery] output_delete failed:", error.code, error.message);
      return null;
    }
    return data === true;
  } catch (e) {
    console.error("[gallery] output_delete threw:", e instanceof Error ? e.message : e);
    return null;
  }
}
