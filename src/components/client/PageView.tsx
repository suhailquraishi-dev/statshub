"use client";

import { useEffect } from "react";
import { track, type FanPulseEvent } from "@/lib/analytics";
import { useAuth } from "./AuthProvider";

export function PageView({ event = "page_viewed", props }: { event?: FanPulseEvent; props?: Record<string, string> }) {
  const { user } = useAuth();
  useEffect(() => {
    track(event, { ...props, auth: user ? "signed_in" : "anonymous" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
