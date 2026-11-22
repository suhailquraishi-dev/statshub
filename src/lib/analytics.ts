"use client";

/**
 * Product analytics (PRD §12). Pushes to the GA4 dataLayer. Props carry
 * sport, matchup, device, source and auth state, never comment text.
 */
export type FanPulseEvent =
  | "page_viewed" | "stat_comparison_changed" | "discussion_viewed" | "poll_vote_submitted"
  | "comment_published" | "reply_published" | "stat_attached" | "discussion_followed"
  | "report_submitted" | "newsletter_signup_completed" | "my_team_selected" | "stat_used_in_reply" | "stat_explored" | "share_clicked" | "active_time";

type Props = Record<string, string | number | boolean | undefined>;

export function track(event: FanPulseEvent, props: Props = {}) {
  if (typeof window === "undefined") return;
  const device = window.matchMedia("(max-width: 640px)").matches ? "phone" : window.matchMedia("(max-width: 1080px)").matches ? "tablet" : "desktop";
  const payload = { event, sport: "nfl", device, source: document.referrer ? new URL(document.referrer).hostname : "direct", ...props };
  const w = window as unknown as { dataLayer?: unknown[] };
  (w.dataLayer ??= []).push(payload);
  if (process.env.NODE_ENV !== "production") console.debug("[analytics]", payload);
}
