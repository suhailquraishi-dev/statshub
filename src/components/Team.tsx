import type { Team } from "@/lib/data/types";
import { TeamLogo, type LogoSize } from "./TeamLogo";

/** Team logo (licensed provider logo, or the drawn demo emblem). Decorative: always pair with the team name. */
export function Crest({ team, size }: { team: Team; size?: LogoSize }) {
  return <TeamLogo team={team} size={size ?? "md"} />;
}

/** Team colours as CSS custom properties, for accent stripes and hero backgrounds. */
export function teamVars(away: Team, home?: Team): React.CSSProperties {
  const v: Record<string, string> = { "--team-a": away.colors[0], "--team-a2": away.colors[1] };
  if (home) { v["--team-h"] = home.colors[0]; v["--team-h2"] = home.colors[1]; }
  return v as React.CSSProperties;
}

export function record(t: Team) {
  return `${t.record.w}-${t.record.l}${t.record.t ? `-${t.record.t}` : ""}`;
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" });
const DAY_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/New_York" });
const TIME_FMT = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" });

export function kickoff(iso: string) {
  return DATE_FMT.format(new Date(iso));
}
export function day(iso: string) {
  return DAY_FMT.format(new Date(iso));
}
/** Short kickoff for scoreboards: "Sun · 1:00 PM EST". */
export function kickoffShort(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAY_FMT.format(d)} · ${TIME_FMT.format(d)}`;
}
