import type { Team } from "@/lib/data/types";

/**
 * Team logos.
 *
 * When the stats provider supplies a licensed logo (`team.logoUrl`) we show it.
 * The demo teams are fictional, so they get original shield emblems drawn here
 * in each team's two colours. Logos are decorative: every place that shows one
 * also shows the team name in text.
 */

export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";
const PX: Record<LogoSize, number> = { xs: 28, sm: 36, md: 56, lg: 88, xl: 120 };

const SHIELD = "M32 3 L58 11 V30 C58 46 46 56 32 61 C18 56 6 46 6 30 V11 Z";

function luminance(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Demo team ids that have a drawn emblem (others fall back to a monogram). */
export const DEMO_EMBLEMS = ["hcm", "rvh", "lsp", "mfb", "nps", "gcr"] as const;

/** Emblem colour and inner ring for a team's shield: the secondary colour when it reads, else white. */
export function logoColors(colors: [string, string]) {
  const [base, second] = colors;
  return {
    ink: contrast(base, second) >= 3 ? second : "#ffffff",
    ring: contrast(base, second) >= 1.6 ? second : "#ffffff",
  };
}

/** Emblem drawings for the fictional demo teams, keyed by team id. Drawn in a 64x64 box. */
function Emblem({ id, ink, base }: { id: string; ink: string; base: string }) {
  const stroke = { fill: "none", stroke: ink, strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "hcm": // Mariners: anchor
      return (
        <g>
          <circle cx="32" cy="17" r="4.5" {...stroke} />
          <path d="M32 21.5 V48 M23 28 H41 M18 37 C18 46 24 50 32 50 C40 50 46 46 46 37" {...stroke} />
          <path d="M14 39 L18 34 L22 39 Z M42 39 L46 34 L50 39 Z" fill={ink} />
        </g>
      );
    case "rvh": // Hawks: hawk head in profile
      return (
        <g>
          <path d="M15 40 C15 26 24 16 37 16 C45 16 50 21 51 27 L44 29 L49 34 C45 36 41 35 39 33 C37 39 31 45 24 47 L26 40 L19 44 Z" fill={ink} />
          <circle cx="40" cy="23.5" r="2.6" fill={base} />
        </g>
      );
    case "lsp": // Pioneers: compass star
      return (
        <g>
          <circle cx="32" cy="31" r="15" {...stroke} strokeWidth={2.5} />
          <path d="M32 12 L36 27 L51 31 L36 35 L32 50 L28 35 L13 31 L28 27 Z" fill={ink} />
          <circle cx="32" cy="31" r="3" fill={base} />
        </g>
      );
    case "mfb": // Bison: head with horns
      return (
        <g>
          <path d="M22 25 C14 25 12 17 16 12 M42 25 C50 25 52 17 48 12" {...stroke} />
          <path d="M20 22 H44 L47 33 L39 48 H25 L17 33 Z" fill={ink} />
          <circle cx="26.5" cy="31" r="2.4" fill={base} />
          <circle cx="37.5" cy="31" r="2.4" fill={base} />
          <path d="M28 41 H36" stroke={base} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case "nps": // Stags: antlers
      return (
        <g>
          <path d="M28 35 C22 30 20 23 22 13 M23 25 L15 21 M22 18 L16 12 M36 35 C42 30 44 23 42 13 M41 25 L49 21 M42 18 L48 12" {...stroke} strokeWidth={3.5} />
          <path d="M25 33 H39 L36 47 C35 50 29 50 28 47 Z" fill={ink} />
        </g>
      );
    case "gcr": // Rays: sun over waves
      return (
        <g>
          <circle cx="32" cy="27" r="8" fill={ink} />
          <path d="M32 11 V14 M32 40 V43 M16 27 H19 M45 27 H48 M20.7 15.7 L22.8 17.8 M41.2 36.2 L43.3 38.3 M43.3 15.7 L41.2 17.8 M22.8 36.2 L20.7 38.3" {...stroke} strokeWidth={3} />
          <path d="M14 47 C18 43 22 43 26 47 C30 51 34 51 38 47 C42 43 46 43 50 47" {...stroke} strokeWidth={3.5} />
        </g>
      );
    default:
      return null;
  }
}

export function TeamLogo({ team, size = "md", className }: { team: Team; size?: LogoSize; className?: string }) {
  const px = PX[size];
  const cls = `fp-logo fp-logo--${size}${className ? ` ${className}` : ""}`;
  if (team.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- provider logos are remote, fixed-size and decorative
    return <img className={cls} src={team.logoUrl} width={px} height={px} alt="" aria-hidden="true" />;
  }
  const base = team.colors[0];
  const { ink, ring } = logoColors(team.colors);
  const emblem = Emblem({ id: team.id, ink, base });
  return (
    <svg className={cls} width={px} height={px} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d={SHIELD} fill={base} />
      <path d={SHIELD} fill="none" stroke={ring} strokeWidth="3" transform="translate(32 32) scale(.86) translate(-32 -32)" opacity=".9" />
      {emblem ?? (
        <text x="32" y="38" textAnchor="middle" fill={ink} fontFamily="var(--es-font-display)" fontWeight="800" fontSize="16">{team.abbr}</text>
      )}
    </svg>
  );
}
