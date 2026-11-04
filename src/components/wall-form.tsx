"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { wall } from "@/lib/content";
import { charCount, MAX_NAME_CHARS, MAX_POST_CHARS } from "@/lib/wall-rules";

type Status = "idle" | "sending" | "done" | "error";

// Post to the friendship wall (#14). One short field plus an optional name:
// two taps to take part (N-02). The server re-checks everything (ADR-009).
export function WallForm() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const used = charCount(body);
  const over = used > MAX_POST_CHARS;
  const empty = body.trim().length === 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending" || over || empty) return;
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/wall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, name }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not post right now. Try again.");
        return;
      }
      setBody("");
      setStatus("done");
      // Re-render the list on the server; local state (the name) stays.
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Could not reach the site. Check your connection and try again.");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Your message
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (status !== "sending") setStatus("idle");
          }}
          rows={4}
          placeholder={wall.placeholder}
          aria-describedby="wall-count"
          className="resize-y rounded-lg border border-line bg-paper px-3 py-2 text-base font-normal outline-none focus:border-rose"
        />
      </label>
      <p id="wall-count" className={`-mt-2 text-right text-xs ${over ? "font-semibold text-rose" : "text-muted"}`}>
        {used} / {MAX_POST_CHARS}
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Name (optional)
        <input
          type="text"
          value={name}
          maxLength={MAX_NAME_CHARS}
          onChange={(e) => setName(e.target.value)}
          placeholder={wall.anonymous}
          className="rounded-lg border border-line bg-paper px-3 py-2 text-base outline-none focus:border-rose"
        />
      </label>
      <p className="text-xs text-muted">{wall.notice}</p>
      {message && (
        <p className="text-sm text-rose" role="alert">
          {message}
        </p>
      )}
      {status === "done" && (
        <p className="text-sm font-semibold text-rose" role="status">
          Posted. Thanks for adding to the wall!
        </p>
      )}
      <button
        type="submit"
        disabled={status === "sending" || over || empty}
        className="rounded-full bg-rose px-5 py-2.5 text-sm font-semibold text-rose-ink hover:opacity-90 disabled:opacity-40"
      >
        {status === "sending" ? "Posting..." : "Post to the wall"}
      </button>
    </form>
  );
}
