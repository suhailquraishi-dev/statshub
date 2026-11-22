"use client";

import { useEffect } from "react";
import { track, type FanPulseEvent } from "@/lib/analytics";
import { useAuth } from "./AuthProvider";

const IDLE_MS = 30_000;

/**
 * Page view plus active time: seconds the page was visible and the reader was
 * active (counting pauses after 30s without input), sent when they leave.
 */
export function PageView({ event = "page_viewed", props }: { event?: FanPulseEvent; props?: Record<string, string> }) {
  const { user } = useAuth();
  useEffect(() => {
    track(event, { ...props, auth: user ? "signed_in" : "anonymous" });
    let active = 0;
    let last = Date.now();
    let lastInput = Date.now();
    let sent = false;
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === "visible" && now - lastInput < IDLE_MS) active += now - last;
      last = now;
    };
    const input = () => { lastInput = Date.now(); };
    const send = () => {
      tick();
      if (sent || active < 1000) return;
      sent = true;
      track("active_time", { ...props, seconds: Math.round(active / 1000) });
    };
    const vis = () => { tick(); if (document.visibilityState === "hidden") send(); else { sent = false; } };
    const timer = window.setInterval(tick, 5000);
    const evs = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, input, { passive: true }));
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", send);
    return () => {
      send();
      window.clearInterval(timer);
      evs.forEach((e) => window.removeEventListener(e, input));
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("pagehide", send);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
