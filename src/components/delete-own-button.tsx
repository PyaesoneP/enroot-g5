"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// "Delete" on something the visitor posted from this device (wall #14,
// gallery #16). The server checks ownership against the g5_guest cookie;
// this button is only shown where the server said the item is yours.
export function DeleteOwnButton({
  endpoint,
  confirmText,
  label = "Delete",
}: {
  // e.g. "/api/wall?id=<uuid>"
  endpoint: string;
  confirmText: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (busy || !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not delete. Try again.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the site. Try again.");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted hover:border-rose hover:text-rose disabled:opacity-40"
      >
        {busy ? "Deleting..." : label}
      </button>
      {error && (
        <span className="text-xs text-rose" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
