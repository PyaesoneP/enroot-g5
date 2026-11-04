// The wall's light content filter (ADR-009 step 4, issue #14). The list is
// content/stopwords.txt (content-as-code, ADR-003); its format is described
// at the top of that file. Read from disk at runtime: next.config.ts traces
// the file into the /api/wall function (outputFileTracingIncludes).
import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Rules = { words: Set<string>; prefixes: string[]; phrases: string[] };

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

// Lowercase, fold compatibility forms (fullwidth letters etc.), undo the
// common digit/symbol swaps, and turn everything that is not a letter or
// digit into single spaces.
export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[013457@$]/g, (c) => LEET[c])
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function parseRules(source: string): Rules {
  const rules: Rules = { words: new Set(), prefixes: [], phrases: [] };
  for (const line of source.split("\n")) {
    const entry = line.trim();
    if (!entry || entry.startsWith("#")) continue;
    if (entry.endsWith("*")) {
      const prefix = normalize(entry.slice(0, -1));
      if (prefix) rules.prefixes.push(prefix);
    } else {
      const norm = normalize(entry);
      if (!norm) continue;
      if (norm.includes(" ")) rules.phrases.push(norm);
      else rules.words.add(norm);
    }
  }
  return rules;
}

export function matches(rules: Rules, text: string): boolean {
  const norm = normalize(text);
  if (!norm) return false;
  const words = norm.split(" ");
  if (words.some((w) => rules.words.has(w) || rules.prefixes.some((p) => w.startsWith(p)))) return true;
  // Phrases match on word boundaries: pad so " go die " is not found
  // inside "ago dies".
  const padded = ` ${norm} `;
  return rules.phrases.some((p) => padded.includes(` ${p} `));
}

let cached: Rules | null = null;

// Throws if the list cannot be read; the wall route then refuses the post
// (fails closed) rather than publishing unfiltered text.
function rules(): Rules {
  if (!cached) {
    cached = parseRules(readFileSync(join(process.cwd(), "content", "stopwords.txt"), "utf8"));
  }
  return cached;
}

export function containsStopword(...texts: (string | null)[]): boolean {
  const r = rules();
  return texts.some((t) => t !== null && matches(r, t));
}
