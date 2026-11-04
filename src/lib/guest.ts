// Anonymous guest identity (issue #13, ADR-008): an opaque random id in a
// cookie, issued by src/proxy.ts on first page visit. Only used for rate
// limiting (and later "your posts" on the wall, #14). Not a login, not
// tied to a person; clearing cookies gives a new identity.
export const GUEST_COOKIE = "g5_guest";
export const GUEST_MAX_AGE_SEC = 60 * 60 * 24 * 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Only ids we could have issued count; anything else is ignored.
export function validGuestId(value: string | undefined | null): string | null {
  return value && UUID_RE.test(value) ? value : null;
}
