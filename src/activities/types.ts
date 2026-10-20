import type { ComponentType } from "react";

// The pluggable activity contract (ADR-005). The site renders whichever
// module content/activity.json points at; the store (later) keeps
// activity_id + serialize(output), so past outputs stay readable after a swap.
export type ActivityModule<Output> = {
  id: string;
  name: string;
  // Interactive UI. A client component, rendered inside a Suspense boundary.
  Component: ComponentType;
  // Validates untrusted input (URL, stored payload); null when invalid.
  parse: (input: string | null) => Output | null;
  serialize: (output: Output) => string;
};
