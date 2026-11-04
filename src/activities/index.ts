import { createElement, type ComponentType, type ReactNode } from "react";
import { activityConfig } from "@/lib/content";
import { charmBuilder } from "./charm-builder";
import type { ActivityModule } from "./types";

// A module with its Output type sealed inside, so modules with different
// outputs can sit in one registry.
export type Registered = {
  id: string;
  name: string;
  Component: ComponentType;
  // Untrusted input -> the canonical payload to store, or null when it is
  // invalid or not finished enough to share.
  toShare: (input: string) => string | null;
  // A stored payload -> its gallery preview, or null if it no longer parses.
  preview: (payload: string) => ReactNode | null;
  // Why toShare() said no, in the module's own words.
  notShareable: string;
};

function register<O>(m: ActivityModule<O>): Registered {
  return {
    id: m.id,
    name: m.name,
    Component: m.Component,
    notShareable: m.notShareable,
    toShare: (input) => {
      const out = m.parse(input);
      return out !== null && m.shareable(out) ? m.serialize(out) : null;
    },
    preview: (payload) => {
      const out = m.parse(payload);
      return out === null ? null : createElement(m.Preview, { output: out });
    },
  };
}

// Every module, by id: the live one AND retired ones, so stored outputs
// keep rendering after a swap. Adding one is an entry here; switching the
// live one is a one-line edit to content/activity.json (ADR-005).
// A Map, not a plain object: ids come from stored rows, and an id like
// "constructor" must miss, not find Object.prototype's (PR #42 review).
const modules = new Map<string, Registered>([register(charmBuilder)].map((m) => [m.id, m]));

export function activeActivity(): Registered {
  const mod = modules.get(activityConfig.active);
  // Fails the build, not the visitor, when the config names a missing module.
  if (!mod) throw new Error(`content/activity.json: unknown activity "${activityConfig.active}"`);
  return mod;
}

// The module that made a stored output, or undefined for an id no longer
// registered (the gallery skips those rows).
export function moduleById(id: string): Registered | undefined {
  return modules.get(id);
}
