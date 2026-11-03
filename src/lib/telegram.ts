// Thin Telegram Bot API client (ADR-010). Server-only: the token never
// leaves server env. Env is read per call so the build succeeds without it.
import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { Post } from "@/lib/bot";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN must be set (see README)");
  return t;
}

export function channelId(): string {
  const c = process.env.TELEGRAM_CHANNEL_ID;
  if (!c) throw new Error("TELEGRAM_CHANNEL_ID must be set (see README)");
  return c;
}

async function call(method: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!res.ok || !body?.ok) {
    // Log only Telegram's description; the URL carries the token.
    throw new Error(`Telegram ${method} failed: ${res.status} ${body?.description ?? ""}`.trim());
  }
}

export async function sendPost(chatId: string, post: Post): Promise<void> {
  if (post.kind === "photo") {
    await call("sendPhoto", { chat_id: chatId, photo: post.photoUrl, caption: post.caption });
  } else {
    await call("sendMessage", { chat_id: chatId, text: post.text });
  }
}

// Constant-time comparison for webhook / cron secrets. An unset secret
// never matches, so a missing env var fails closed.
export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
