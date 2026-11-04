// Wall input limits (issue #14), shared by the form (live counter) and
// /api/wall (the authority). The database CHECKs in migration 0011 repeat
// them, so keep the three in step.
export const MAX_POST_CHARS = 280;
export const MAX_NAME_CHARS = 40;

// Length in characters as Postgres char_length() counts them (code
// points), so an emoji counts as one here, in the counter and in the CHECK.
export const charCount = (s: string) => Array.from(s).length;
