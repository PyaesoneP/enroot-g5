import { NextResponse } from "next/server";
import { activeActivity } from "@/activities";
import { deleteOutput, saveOutput } from "@/lib/db";
import { isUuid, readJsonObject } from "@/lib/http";
import { clientIp, ensureGuest, guestId } from "@/lib/identity";
import { release, reserve } from "@/lib/rate-limit";
import { ownerHash } from "@/lib/rate-limit-keys";

// Saved outputs (issue #16): share a finished activity result to the
// public gallery. Opt-in, no name or caption: only the result itself.
// The activity is always the LIVE module (the client cannot pick one), and
// the payload is parsed and re-serialized by that module, so the store only
// ever holds canonical, valid outputs.
const MAX_BODY_BYTES = 2 * 1024;

export async function POST(req: Request) {
  const read = await readJsonObject(req, MAX_BODY_BYTES);
  if (!read.ok) return read.res;
  const input = typeof read.body.payload === "string" ? read.body.payload : "";

  const activity = activeActivity();
  const payload = input ? activity.toShare(input) : null;
  if (!payload) {
    return NextResponse.json({ error: "Finish your bracelet first (all four charms on)." }, { status: 400 });
  }

  const { guest, owner, issue } = ensureGuest(req);
  const identity = { ip: clientIp(req), guest };
  const limit = await reserve("gallery", identity);
  if (!limit.allowed) {
    return issue(
      NextResponse.json(
        { error: "You've shared a lot already. Try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      ),
    );
  }

  const id = await saveOutput(owner, activity.id, payload);
  if (!id) {
    await release("gallery", identity);
    return issue(NextResponse.json({ error: "Could not share right now. Try again." }, { status: 502 }));
  }
  return issue(NextResponse.json({ ok: true, id }, { status: 201 }));
}

// DELETE /api/outputs?id=<uuid>: remove your own entry from the gallery.
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const guest = guestId(req);
  const deleted = guest ? await deleteOutput(ownerHash(guest), id) : false;
  if (deleted === null) {
    return NextResponse.json({ error: "Could not remove it right now. Try again." }, { status: 502 });
  }
  if (!deleted) {
    return NextResponse.json({ error: "Not found, or it isn't yours." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
