// Stop-word filter check (issue #14), no database, reads the real
// content/stopwords.txt:
//   node --no-warnings --conditions=react-server --experimental-strip-types \
//     --import ./scripts/ts-alias-hooks.mjs scripts/stopwords-check.mjs
import assert from "node:assert/strict";
import { containsStopword, normalize, parseRules, matches } from "../src/lib/stopwords.ts";

// Format rules, on a fixed list.
const rules = parseRules("# comment\n\nfuck*\nass\ngo die\n");
const cases = [
  // [text, blocked?]
  ["what the FUCK", true],
  ["fucking great", true],
  ["f.u.c.k", false], // spaced-out letters are not caught (blunt by design)
  ["sh!t happens", false],
  ["he's an ass", true],
  ["first class", false], // whole words only
  ["assessment due", false],
  ["just go die", true],
  ["ago dies", false], // phrases on word boundaries
  ["GO   DIE!!", true],
  ["ｆｕｃｋ", true], // fullwidth folded by NFKC
  ["phuck", false],
  ["", false],
];
for (const [text, blocked] of cases) {
  assert.equal(matches(rules, text), blocked, `${JSON.stringify(text)} should ${blocked ? "" : "not "}be blocked`);
}
assert.equal(normalize("F4ck @$$"), "fack ass");

// The real list: obvious abuse blocked, everyday posts through, name checked too.
assert.equal(containsStopword(null, "you're a b1tch"), true);
assert.equal(containsStopword("knn", "hello"), true, "the name is checked");
assert.equal(containsStopword(null, "kill yourself"), true);
for (const ok of [
  "See you all at Root Cove! Bringing my roommate :)",
  "Class of 15th ROOT, let's go",
  "Can't wait for the dreamy table, moons all the way",
  "Thank you Mei for the cat charm idea",
  "Scunthorpe represent",
  "<script>alert(1)</script>",
]) {
  assert.equal(containsStopword("Alex", ok), false, `false positive on ${JSON.stringify(ok)}`);
}
console.log(`stop-words: ${cases.length + 10} checks pass`);
