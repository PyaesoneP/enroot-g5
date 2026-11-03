// Node module hooks for running src/ TypeScript outside Next (tests only):
// maps the tsconfig "@/x" alias to src/x.ts. Register with
//   node --import ./scripts/ts-alias-hooks.mjs ...
import { register } from "node:module";

if (!globalThis.__g5AliasHooks) {
  globalThis.__g5AliasHooks = true;
  register(import.meta.url, import.meta.url);
}

const src = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    return next(new URL(`${specifier.slice(2)}.ts`, src).href, context);
  }
  return next(specifier, context);
}
