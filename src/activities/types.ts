import type { ComponentType } from "react";

// The pluggable activity contract (ADR-005). The site renders whichever
// module content/activity.json points at; the gallery (#16) stores
// activity_id + serialize(output), and renders each stored row with the
// module named in it, so past outputs stay readable after a swap.
export type ActivityModule<Output> = {
  id: string;
  name: string;
  // Interactive UI. A client component, rendered inside a Suspense boundary.
  Component: ComponentType;
  // Validates untrusted input (URL, stored payload); null when invalid.
  parse: (input: string | null) => Output | null;
  serialize: (output: Output) => string;
  // Whether an output is finished enough to go on the public gallery.
  shareable: (output: Output) => boolean;
  // How one stored output looks on a gallery card. Server-renderable
  // (it may use client components inside).
  Preview: ComponentType<{ output: Output }>;
};
