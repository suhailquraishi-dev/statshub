# AI edit log

Newest first. See CLAUDE.md for the format.

## 2026-11-21 — Suhail Quraishi: design refresh, team logos, Vercel font fix (branch suhail/fanpulse-design-refresh)
Status: committed, not pushed.

What:
- Team logos: `src/components/TeamLogo.tsx`. Shows a licensed `team.logoUrl` when the provider supplies one;
  the fictional demo teams get original shield emblems (anchor, hawk, compass, bison, antlers, sun) in their
  two colours, with the emblem colour picked for at least 3:1 contrast. Used everywhere a team appears.
- Broadcast look: dark masthead, week scoreboard strip under it (every game, logos, kickoff or final score,
  current game highlighted), home hero with "Game of the week" card in team colours and this-week counts,
  matchup cards with a team-colour logo band, full-width matchup hero (split team colours, big logos,
  score), team-colour stripes on discussion cards, activity chips, team tiles, scoreboard-style final
  scores and head-to-head rows, player initials avatars, edge tally above key stats (counted from the
  comparison rows), dark footer, favicon. New tokens in `tokens.css` (`--fp-night*`, `.fp-on-dark` role
  remap); team colours stay content data via inline CSS variables. Comparison bars keep brand blue/slate.
- Vercel build fix: `next/font/google` crashed on Vercel ("Cannot read properties of null (reading '1')")
  when Google returned a font URL without a file extension. Fonts are now self-hosted from
  `@fontsource/roboto` and `@fontsource/roboto-condensed` (5.3.0, Latin subsets), so builds never call Google.
- `scripts/visual-qa.mjs`: optional `QA_CHROME` env var to use an installed Chrome.

Why: the MVP read as bland; the user asked for more visual richness and team logos.

Tests: `npm run typecheck`; `npm test` (28 tests, new `tests/team-logo.test.ts`); `npm run build`.
Visual QA at 375/768/1024/1440, light and dark, plus the end-to-end flow: layout checks pass (no overflow,
clipping or small targets); end-to-end flow passes. Fixed during QA: phone matchup hero split cut through
the score (now one colour block per team); favicon 404.

Unverified / known:
- React #418 hydration error still appears on 1-2 of 32 QA page loads (0 in 120 targeted loads). The
  original MVP build showed it 3 and 10 times in two QA runs on the same machine, so it is pre-existing.
- Not yet deployed: confirm the Vercel build passes after this branch reaches main.
- Demo emblems are placeholders for fictional teams; real NFL logos need licensing with the stats provider.

## 2026-11-21 — Suhail Quraishi: ES FanPulse MVP prototype (branch suhail/fanpulse-mvp)
Status: pushed in f44182c (main and suhail/fanpulse-mvp).

What: built the FanPulse MVP from the PRD in an empty repo. Next.js 15 + TypeScript. Provider adapter with
a demo provider (fictional teams), comparison engine with plain-English explanations, immutable evidence
snapshots, polls, comments, reactions, reports, moderation, editor tools, stat-signal drafts, ranking,
analytics events, SEO basics. Styling uses the ES design tokens (read from the design-tools repo, not
edited), adapted for 55+ readers.

Why: the PRD asks for an NFL-first stats and conversation destination; the stats provider is still an open
decision (PRD §18), so the adapter and demo data let product and editorial review the experience now.

Tests: `npm test` (25 tests: comparison rules, evidence contract and immutability, one vote per account,
moderation permissions, auto-hold, rate limit, idempotency, editorial workflow, signals, ranking).
Visual QA: `npm run qa` at 375/768/1024/1440, light and dark, plus the end-to-end flow. Passing.

Unverified / known:
- Downgraded from Next 16.4.6 to 15.5.29: 16.4.6 threw hydration error #418 on about half of second full
  page loads, even on a bare page. On 15.5.29 it appeared once in 32 QA page loads and 0 in 48 targeted
  repeats; likely the same framework race, not app code.
- Data is in memory: restarting the server clears votes and comments. Needs PostgreSQL + Redis.
- Sign-in is a prototype (signed cookie, no email verification). Needs ES identity or a managed provider.
- Related-coverage links are sample headlines.
