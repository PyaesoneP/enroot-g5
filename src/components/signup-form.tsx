"use client";

import { useState } from "react";
import { charms, event } from "@/lib/content";
import { serializePicks, vibeOf, type Picks } from "@/activities/charm-builder/picks";

type Status = "idle" | "sending" | "done" | "error";

// Issue #15: sign-up rides the builder — it carries the current bracelet
// and records the vibe computed server-side. Walk-ins stay welcome; this
// is a planning tool, not a gate.
export function SignupForm({ picks }: { picks: Picks }) {
  const [nickname, setNickname] = useState("");
  const [groupSize, setGroupSize] = useState(1);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [vibe, setVibe] = useState<string | null>(null);
  // The bracelet as it was when the sign-up was stored. Editing the
  // bracelet afterwards does NOT re-open the form (round-2 finding 2):
  // a second submit would add a second row and double-count the group.
  // The panel says the original sign-up stands.
  const [submittedPicks, setSubmittedPicks] = useState<string | null>(null);

  const picksKey = serializePicks(picks);
  const complete = picks.length === charms.pickCount;
  const vibeNow = complete ? vibeOf(picks) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          groupSize,
          consent,
          // Only a COMPLETE bracelet is stored: partial picks have no
          // vibe and the consent text promises charms only when complete
          // (round-2 finding 3).
          picks: complete ? serializePicks(picks) : null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; vibe?: string | null; error?: string };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not save your sign-up. Try again.");
        return;
      }
      setStatus("done");
      setVibe(data.vibe ?? null);
      setSubmittedPicks(picksKey);
    } catch {
      setStatus("error");
      setMessage("Could not reach the site. Check your connection and try again.");
    }
  }

  if (status === "done") {
    const changed = submittedPicks !== picksKey;
    return (
      <div className="rounded-2xl bg-blush p-4 text-center" role="status">
        <p className="font-display text-2xl font-semibold [font-variation-settings:'SOFT'_100]">
          You&apos;re on the list
        </p>
        {vibe && <p className="mt-1 text-sm">{charms.vibeTable.replace("{vibe}", vibeLabel(vibe))}</p>}
        {changed && (
          <p className="mt-2 text-xs text-muted">
            You edited the bracelet since signing up — your sign-up stands as it was. More charms
            at the table on the day.
          </p>
        )}
        <p className="mt-2 text-sm text-muted">
          See you {event.dateLabel} at {event.venue}. Walk-ins are welcome too.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-line pt-4">
      <p className="text-sm font-semibold">Sign up for {event.name}</p>
      <p className="text-xs text-muted">
        Optional. We use it to plan the four vibe tables and charm stock — walk-ins stay welcome.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Nickname (optional)
        <input
          type="text"
          value={nickname}
          maxLength={40}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="anonymous"
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-rose"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Group size
        <select
          value={groupSize}
          onChange={(e) => setGroupSize(Number(e.target.value))}
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-rose"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "person" : "people"}
            </option>
          ))}
        </select>
      </label>
      {vibeNow && (
        <p className="text-xs text-muted">
          Your full bracelet is {vibeNow.label} — it goes with the sign-up.
        </p>
      )}
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 accent-rose"
          required
        />
        <span>
          We keep your nickname, group size, vibe, and bracelet charms (if the bracelet is complete)
          only to plan tables and charm stock. Deleted after the event (by 19 Dec).
        </span>
      </label>
      {message && (
        <p className="text-sm text-rose" role="alert">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={!consent || status === "sending"}
        className="rounded-full bg-rose px-5 py-2.5 text-sm font-semibold text-rose-ink hover:opacity-90 disabled:opacity-40"
      >
        {status === "sending" ? "Saving..." : "Sign up"}
      </button>
    </form>
  );
}

function vibeLabel(vibeId: string): string {
  return charms.vibes.find((v) => v.id === vibeId)?.label ?? vibeId;
}
