"use client";

import Link from "next/link";
import { useState } from "react";
import { gallery } from "@/lib/content";

// Opt-in share of a finished output to the public gallery (#16). `payload`
// is the module's serialized output; the server re-validates it.
export function ShareToGallery({ payload, ready }: { payload: string; ready: boolean }) {
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [sharedPayload, setSharedPayload] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const shared = sharedPayload === payload;

  async function share() {
    if (status === "sending" || !ready || shared) return;
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/outputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not share right now. Try again.");
        return;
      }
      setStatus("idle");
      setSharedPayload(payload);
    } catch {
      setStatus("error");
      setMessage("Could not reach the site. Check your connection and try again.");
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {shared ? (
        <p className="text-sm font-semibold text-rose" role="status">
          {gallery.shared}{" "}
          <Link href="/gallery" className="underline underline-offset-2">
            See the gallery
          </Link>
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={share}
            disabled={!ready || status === "sending"}
            className="rounded-full border border-rose px-5 py-2.5 text-sm font-semibold text-rose hover:bg-blush disabled:opacity-40"
          >
            {status === "sending" ? "Sharing..." : "Share to gallery"}
          </button>
          {ready && <p className="text-xs text-muted">{gallery.shareNotice}</p>}
        </>
      )}
      {message && (
        <p className="text-sm text-rose" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
