// Telegram bot message logic (F-09, #18, ADR-010). Pure: no I/O, so the
// route handlers stay thin and every post can be previewed with a dry run.
// All copy lives in content/bot.json (ADR-003).
import "server-only";
import { bot, charms, event } from "@/lib/content";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// Spreads consecutive days across the catalogue. Must be coprime to the
// charm count so no charm repeats within a full cycle.
const STEP = 37;

export type Post =
  | { kind: "photo"; photoUrl: string; caption: string }
  | { kind: "text"; text: string };

export function isIsoDate(s: string): boolean {
  return DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

// Today's date in Singapore (UTC+8) as YYYY-MM-DD. Cron runs in UTC.
export function sgtDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function charmForDate(date: string) {
  const dayIndex = dayDiff(bot.window.start, date);
  const n = charms.charms.length;
  const step = gcd(STEP, n) === 1 ? STEP : 1;
  const charm = charms.charms[(((dayIndex * step) % n) + n) % n];
  const lines = bot.friendshipLines;
  const line = lines[((dayIndex % lines.length) + lines.length) % lines.length];
  return { charm, line };
}

// Morning job: charm of the day inside the publicity window, the event
// nudge on event day, nothing otherwise.
export function morningPost(date: string): Post | null {
  if (date === event.date) {
    return { kind: "text", text: fill(bot.eventMorning, { siteUrl: bot.siteUrl }) };
  }
  if (date < bot.window.start || date > bot.window.end) return null;
  const { charm, line } = charmForDate(date);
  const days = dayDiff(date, event.date);
  return {
    kind: "photo",
    photoUrl: `${bot.siteUrl}/charms-photo/${charm.id}.jpg`,
    caption: fill(bot.charmOfDay, {
      label: charm.label,
      line,
      days: days === 1 ? "1 day" : `${days} days`,
      link: `${bot.siteUrl}/make?charms=${charm.id}@0`,
    }),
  };
}

// Late-afternoon job: event day only.
export function afternoonPost(date: string): Post | null {
  if (date !== event.date) return null;
  return { kind: "text", text: fill(bot.eventAfternoon, { siteUrl: bot.siteUrl }) };
}

// Bot commands may arrive as "/count" or "/count@SomeBot extra words".
export function commandOf(text: string): string | null {
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s|$)/i.exec(text.trim());
  return m ? m[1].toLowerCase() : null;
}
