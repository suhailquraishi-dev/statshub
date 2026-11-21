import type { Team } from "@/lib/data/types";

export function Crest({ team, size }: { team: Team; size?: "sm" }) {
  return (
    <span className={`fp-crest${size === "sm" ? " fp-crest--sm" : ""}`} style={{ ["--crest-1" as string]: team.colors[0], ["--crest-2" as string]: team.colors[1] }} aria-hidden="true">
      {team.abbr}
    </span>
  );
}

export function record(t: Team) {
  return `${t.record.w}-${t.record.l}${t.record.t ? `-${t.record.t}` : ""}`;
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" });
const DAY_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function kickoff(iso: string) {
  return DATE_FMT.format(new Date(iso));
}
export function day(iso: string) {
  return DAY_FMT.format(new Date(iso));
}
