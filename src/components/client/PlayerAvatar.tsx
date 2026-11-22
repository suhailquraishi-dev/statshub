"use client";

import { useState } from "react";
import type { Team } from "@/lib/data/types";
import { TeamLogo } from "@/components/TeamLogo";

/**
 * Player photo: the official headshot from the stats provider when there is
 * one, otherwise the player's initials. A small team logo sits on the corner.
 * Decorative: the player's name is always shown next to it.
 */
export function PlayerAvatar({ name, imageUrl, team, size = "md" }: { name?: string; imageUrl?: string; team?: Team; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const initials = name ? name.split(" ").map((x) => x[0]).join("").slice(0, 2) : "–";
  const px = size === "sm" ? 40 : 56;
  return (
    <span className={`fp-avatar fp-avatar--${size}`} aria-hidden="true">
      {imageUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote provider headshot, fixed size, decorative
        <img className="fp-avatar__img" src={imageUrl} width={px} height={px} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : initials}
      {team && <TeamLogo team={team} size="xs" className="fp-avatar__logo" />}
    </span>
  );
}
