import { NextResponse } from "next/server";
import { wall } from "@/lib/content";
import { deleteWall, postWall } from "@/lib/db";
import { cleanText, isUuid, readJsonObject } from "@/lib/http";
import { clientIp, ensureGuest, guestId } from "@/lib/identity";
import { release, reserve } from "@/lib/rate-limit";
import { ownerHash } from "@/lib/rate-limit-keys";
import { containsStopword } from "@/lib/stopwords";
import { charCount as chars, MAX_NAME_CHARS, MAX_POST_CHARS } from "@/lib/wall-rules";

// Friendship wall (issue #14). The ADR-009 pipeline in order: validate
// (length caps), filter (content/stopwords.txt), rate-limit (per IP + per
// guest cookie), store via wall_post(). Rendering escapes the text (React),
// so a "<script>" post shows as text.
const MAX_BODY_BYTES = 4 * 1024;

export async function POST(req: Request) {
  const read = await readJsonObject(req, MAX_BODY_BYTES);
  if (!read.ok) return read.res;

  const body = cleanText(read.body.body, { keepNewlines: true });
  const name = cleanText(read.body.name);
  if (chars(body) === 0) {
    return NextResponse.json({ error: "Write something first." }, { status: 400 });
  }
  if (chars(body) > MAX_POST_CHARS) {
    return NextResponse.json({ error: `Posts are at most ${MAX_POST_CHARS} characters.` }, { status: 400 });
  }
  if (chars(name) > MAX_NAME_CHARS) {
    return NextResponse.json({ error: `Names are at most ${MAX_NAME_CHARS} characters.` }, { status: 400 });
  }

  // Filter before the rate limit, so a rephrase does not cost a slot.
  let blocked: boolean;
  try {
    blocked = containsStopword(name || null, body);
  } catch (e) {
    // The list could not be read: refuse rather than post unfiltered text.
    console.error("[wall] stop-word list unavailable:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The wall can't take posts right now. Try again later." }, { status: 503 });
  }
  if (blocked) {
    return NextResponse.json({ error: wall.filtered }, { status: 422 });
  }

  const { guest, owner, issue } = ensureGuest(req);
  const identity = { ip: clientIp(req), guest };
  const limit = await reserve("wall", identity);
  if (!limit.allowed) {
    return issue(
      NextResponse.json(
        { error: "You're posting a lot. Wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      ),
    );
  }

  const result = await postWall(owner, name || null, body);
  if (result.ok) {
    return issue(NextResponse.json({ ok: true, id: result.id }, { status: 201 }));
  }
  await release("wall", identity);
  switch (result.reason) {
    case "closed":
      return issue(NextResponse.json({ error: wall.closed }, { status: 403 }));
    case "invalid":
      // Unreachable: the route validates first. Log loudly if it fires.
      console.error("[wall] DB rejected a route-validated post as invalid");
      return issue(NextResponse.json({ error: "Could not post that. Try again." }, { status: 400 }));
    case "db_error":
      return issue(NextResponse.json({ error: "Could not post right now. Try again." }, { status: 502 }));
  }
}

// DELETE /api/wall?id=<uuid>: only the post's author (same g5_guest cookie)
// can delete it. Someone else's post and an unknown id look the same (404).
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
  }
  const guest = guestId(req);
  const deleted = guest ? await deleteWall(ownerHash(guest), id) : false;
  if (deleted === null) {
    return NextResponse.json({ error: "Could not delete right now. Try again." }, { status: 502 });
  }
  if (!deleted) {
    return NextResponse.json({ error: "Post not found, or it isn't yours." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
