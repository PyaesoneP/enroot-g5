import { morningPost } from "@/lib/bot";
import { runScheduledPost } from "@/lib/bot-cron";

// Cron 01:00 UTC = 09:00 SGT: charm of the day (1-18 Nov) or the event-day
// morning nudge (19 Nov).
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return runScheduledPost(req, morningPost);
}
