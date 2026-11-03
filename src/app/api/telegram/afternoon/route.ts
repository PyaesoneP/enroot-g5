import { afternoonPost } from "@/lib/bot";
import { runScheduledPost } from "@/lib/bot-cron";

// Cron 08:00 UTC = 16:00 SGT: the late-afternoon nudge, 19 Nov only.
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return runScheduledPost(req, afternoonPost);
}
