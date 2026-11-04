// Small request helpers shared by the public write routes (ADR-009 step 1:
// validate server-side).
import { NextResponse } from "next/server";

// Reads a JSON object body of at most maxBytes. Answers with a JSON error
// (never the framework's HTML page) when it is too large or not an object.
export async function readJsonObject(
  req: Request,
  maxBytes: number,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; res: NextResponse }> {
  let body: unknown;
  try {
    const raw = await req.arrayBuffer();
    if (raw.byteLength > maxBytes) {
      return { ok: false, res: NextResponse.json({ error: "Request too large." }, { status: 413 }) };
    }
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return { ok: false, res: NextResponse.json({ error: "Invalid request body." }, { status: 400 }) };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, res: NextResponse.json({ error: "Invalid request body." }, { status: 400 }) };
  }
  return { ok: true, body: body as Record<string, unknown> };
}

// A user-typed string with control characters removed and ends trimmed;
// "" when the field is missing or not a string. Newlines are kept only when
// asked for (wall posts may have line breaks; names may not).
export function cleanText(value: unknown, { keepNewlines = false } = {}): string {
  if (typeof value !== "string") return "";
  const controls = keepNewlines ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g;
  let s = value.replace(controls, "");
  // At most one blank line in a row, so a post cannot be a tall empty block.
  if (keepNewlines) s = s.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null): value is string {
  return value !== null && UUID_RE.test(value);
}
