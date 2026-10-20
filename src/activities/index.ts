import { activityConfig } from "@/lib/content";
import { charmBuilder } from "./charm-builder";
import type { ActivityModule } from "./types";

// What a page needs to show a module; parse/serialize stay typed per module.
type Listed = Pick<ActivityModule<unknown>, "id" | "name" | "Component">;

// Every available module, by id. Adding one is an entry here; switching the
// live one is a one-line edit to content/activity.json (ADR-005).
const modules: Record<string, Listed> = {
  [charmBuilder.id]: charmBuilder,
};

export function activeActivity(): Listed {
  const mod = modules[activityConfig.active];
  // Fails the build, not the visitor, when the config names a missing module.
  if (!mod) throw new Error(`content/activity.json: unknown activity "${activityConfig.active}"`);
  return mod;
}
