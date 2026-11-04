"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-renders the page's server components every `seconds` while the tab is
// visible, so a wall left open on a phone or a screen picks up new posts.
// router.refresh() keeps client state (a half-typed post survives).
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(tick, seconds * 1000);
    // Coming back to the tab: catch up at once instead of waiting a cycle.
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);
  return null;
}
