import { NextResponse } from "next/server";
import { bot } from "@/lib/content";
import { commandOf, fill } from "@/lib/bot";
import { rsvpCountStatus } from "@/lib/db";
import { secretMatches } from "@/lib/secrets";

// Telegram webhook (ADR-010). Registered with a secret_token, which
// Telegram echoes in a header on every update. Replies go back inline in
// the response body (Bot API "reply to webhook"), so no outbound call is
// made and no chat or user ID is ever stored.
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const ack = () => new NextResponse(null, { status: 200 });

type Update = { message?: { chat?: { id?: number | string }; text?: string } };

export async function POST(req: Request) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secretMatches(secret, process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let update: Update;
  try {
    const raw = await req.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) return ack();
    update = JSON.parse(new TextDecoder().decode(raw)) as Update;
  } catch {
    return ack(); // 200 so Telegram does not keep retrying a bad update
  }

  const chatId = update?.message?.chat?.id;
  const text = update?.message?.text;
  if (chatId === undefined || typeof text !== "string") return ack();

  let reply: string;
  switch (commandOf(text)) {
    case "count": {
      const r = await rsvpCountStatus();
      reply =
        r.status === "ok"
          ? fill(bot.countReply, { count: r.count })
          : r.status === "hidden"
            ? bot.countHidden
            : bot.countUnavailable;
      break;
    }
    case "start":
    case "help":
      reply = bot.startReply;
      break;
    default:
      return ack();
  }
  return NextResponse.json({ method: "sendMessage", chat_id: chatId, text: reply });
}
