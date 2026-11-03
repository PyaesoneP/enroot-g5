// Shared body of the two scheduled routes (vercel.json crons). Vercel cron
// sends "Authorization: Bearer $CRON_SECRET"; anything else is rejected.
// With the secret, ?date=YYYY-MM-DD and ?dryRun=1 allow safe previews.
import "server-only";
import { NextResponse } from "next/server";
import { isIsoDate, sgtDate, type Post } from "@/lib/bot";
import { cronAuthorized } from "@/lib/secrets";
import { channelId, sendPost } from "@/lib/telegram";

export async function runScheduledPost(req: Request, build: (date: string) => Post | null) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const override = params.get("date");
  if (override !== null && !isIsoDate(override)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD." }, { status: 400 });
  }
  const date = override ?? sgtDate(new Date());
  const post = build(date);
  if (!post) return NextResponse.json({ date, sent: false });
  if (params.get("dryRun") === "1") return NextResponse.json({ date, sent: false, dryRun: true, post });
  try {
    await sendPost(channelId(), post);
  } catch (err) {
    console.error("[bot] scheduled post failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ date, sent: false, error: "Send failed." }, { status: 502 });
  }
  return NextResponse.json({ date, sent: true });
}
