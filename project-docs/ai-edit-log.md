# AI edit log

Newest first. See CLAUDE.md for the format.

## 2026-11-23 — Suhail Quraishi: player photos and source mark (branch suhail/fanpulse-question-first)
Status: pushed in 39759d3 (main and suhail/fanpulse-question-first).

What: player spotlight and league leaders show the official headshot from the ES Stats API (`players.image`,
https only) with initials as the fallback (`components/client/PlayerAvatar.tsx`); a small ES mark sits beside
"Source:" lines (`components/SourceMark.tsx`). `Player.imageUrl`, `LeaderRow.imageUrl`, `imageMap()` in
`es/map.ts`; two extra `/players?ids=` calls (leaders, spotlight picks), both optional.

Why: the user asked for player images (suggested ESPN) and logos by sources. ESPN was not used: its player
ids do not exist in this data and its photos are not licensed to ES; the stats API already carries NFL
headshots, the same source as the team logos.

Tests: typecheck; `npm test` (57); build; visual QA demo (full flow) and real data: no issues.

Unverified / known: photo coverage is low. In a BUF+MIA sample of 160 players, 49 had a working https
headshot, 26 had a dead `http://static.nfl.com/...` link (host no longer resolves, e.g. Josh Allen) and 85
had none. Those show initials. Fixing it means refreshing image URLs in the stats API.

## 2026-11-23 — Suhail Quraishi: question-first experience from the product review (branch suhail/fanpulse-question-first)
Status: pushed in b854998 (main and suhail/fanpulse-question-first).

What (from the pasted product review):
- Home leads with one matchup: the top open editor question (headline, two key numbers, one sentence, poll,
  copy link / email) or, with no question, the upcoming game between the two best records with its two
  numbers. My team is now a slim bar under the header (record, division, last 5 as W/L, next-game shortcut).
- Comparison clarity: away left / home right everywhere; rows never move or vanish between periods (missing
  ones say so); summary from `tallySentence()` ("lead both available comparisons. 3 stats aren't available
  for this period yet."). The old "X of Y" tally bar is gone.
- Stats hierarchy: "Two numbers to know" (`keyNumbers()`), one sentence, then one table under "Explore all
  stats" (Key / Offense / Defense / Recent form). One period switch per page (was three).
- Explore the number: in Last 5, points stats open the five games behind the average for both teams.
- "Use this stat in my reply" on key numbers and table rows: opens the comment box with that stat attached
  (values rebuilt server-side via the evidence preview API; signs in first if needed).
- Postgame: a final game leads with the result, the pregame question with the closed fan split, an editor's
  verdict (new `setVerdict`, "Postgame verdict" form in Editor tools, audited) and that game's own numbers
  from the box score (`provider.gameStats`, `compareGame`, `GAME_METRICS`); current season numbers follow,
  labelled as such.
- Sharing (`ShareButtons`), "Follow for the postgame answer" wording, empty related-coverage hidden.
- Measurement hooks: `active_time` (visible + active seconds, pauses after 30s idle), `stat_explored`,
  `stat_used_in_reply`, `share_clicked`.

Not built (needs other systems or people): emailing the postgame answer (no email service; Follow only
records interest), real analytics destination (events go to dataLayer), sponsorship modules, article/
newsletter embeds, reader testing, the weekly editorial routine.

Tests: typecheck; `npm test` (56, new `tests/question-first.test.ts`); build. Visual QA demo mode
375/768/1024/1440 + extended flow (explore all stats, games behind a number, use stat in reply): no issues.
Real data (home, upcoming, final with box score, final without): no issues; CIN 38-18 PIT postgame numbers
match the box score (484 vs 222 yards).

Unverified / known: on real data there are no questions until an editor posts one, so the lead shows the
"two numbers" version. Box scores exist only from 2026-11-08, so older finals say game numbers are
unavailable. 200% zoom and real-phone testing not done.

## 2026-11-21 — Suhail Quraishi: clean light redesign, home hub (branch suhail/fanpulse-design-refresh)
Status: pushed in 28c48bc (main and suhail/fanpulse-design-refresh).

What:
- Removed colour blobs and dark surfaces: no dark header/hero/footer, no team-colour fills (hero split,
  matchup-card bands, discussion stripes, tinted tiles, coloured avatars). White header with only the logo
  and Sign in (nav removed; "Editor tools" moved to the footer for editors). Logos carry team identity.
- ES chevron (`components/Chevron.tsx`, path from es-frontend) replaces every text arrow; new chevron
  breadcrumbs (`Breadcrumbs` in `components/Misc.tsx`).
- Home rebuilt as a hub: My team (pick once, saved on the device; next game, record, division rank, last 5
  results), this week's games as a schedule list grouped by day, fan questions, Standings (division switcher,
  defaults to my team's division) and League leaders (passing, rushing, receiving, sacks). Score strip now
  only on inner pages.
- Matchup page: clean scoreboard card (logos, records, division rank, score or kickoff) with both teams'
  last 5 results as W/L chips.
- Data: `Team` gains conference/division/divisionRank; provider gains `leaders()`, `recentResults()`,
  `nextGame()`. ES adapter loads `/standings` and four `/leaders` boards (optional: sections hide if they
  fail); demo provider derives the same from its fictional data.

Why: the user asked for a cleaner site, the ES chevron, and a more useful home for 55+ fans than matchup cards.

Tests: typecheck; `npm test` (48, new standings/leaders/results/next-game and demo-provider tests); build.
Checked against the API: Steelers last 5 (L 18-38 at CIN, W 27-6 CLE, W 16-10 at NO, W 26-19 at TB,
W 34-22 IND) and passing leader (Jordan Love 2,838). Visual QA: demo mode full run + end-to-end flow no
issues; real data (home, upcoming and final matchup) 375/768/1024/1440 no issues. Screenshots reviewed.

Unverified / known: last-5 form on an old final shows the team's current last 5, not as of that game.

## 2026-11-21 — Suhail Quraishi: real NFL data from the ES Stats API (branch suhail/fanpulse-design-refresh)
Status: pushed in e116cb0 (main and suhail/fanpulse-design-refresh).

What:
- New provider `src/lib/data/es/` for the ES Stats API (es-stats.duckdns.org, MySportsFeeds-backed, bearer
  token). `map.ts` is pure mapping (teams with official logos and colours, games, records, season and
  last-5 metrics, head-to-head, spotlight players, NFL passer rating); `provider.ts` loads a snapshot
  (season, teams, team stats, this and last season's games) with a 10-minute refresh and Next fetch cache,
  plus per-matchup extras (leading QB/RB/WR, last five box scores). Keeps the last good snapshot if a refresh
  fails; shows a "Stats are unavailable" page if there is none.
- `STATS_PROVIDER=es` switches it on (`getProvider()`); demo stays the default. Pages and API routes call
  `ensureStats()` first. Demo starter questions are not seeded on real data (editors post questions).
- Site lists the current week (earliest week with an unplayed game) and the week before; the scoreboard strip
  shows the current week and scrolls sideways. Final scores capped at five. Stats the API lacks (red-zone
  rate, season yards allowed) are hidden instead of shown as dashes. Related coverage has no sample hint on
  real data. Phone position tabs no longer break "Quarterbacks" mid-word.
- `.env.example` lists the variables (no values). QA script: `PAGES` option for real-data layout checks.

Mapping notes: season per-game = API totals ÷ games played. Last 5: points, points allowed and point
differential from final scores (whole season available); yards, 3rd downs, sacks, turnovers, yards allowed
and player numbers from box scores, shown only when all five exist. The API keeps box scores from 2026-11-08
on, so these fill in by about mid-December.

Tests: typecheck; `npm test` (41: new `tests/es-map.test.ts`); build. Checked shown numbers against raw API
totals (BUF/MIA points, allowed, yards, 3rd-down, turnover diff: exact match). Visual QA: real data (home,
upcoming and final matchup) at 375/768/1024/1440 no issues; demo mode full QA + end-to-end flow no issues.

Unverified / known:
- Not deployed. Vercel needs STATS_PROVIDER=es and STATS_API_BASE_URL (STATS_API_KEY already added).
- Real data starts with no discussions until editors post questions.
- `relatedArticles` is empty on real data (no ES article feed yet).
- Cold start loads ~5 API calls; a matchup adds up to 12 (players + box scores), cached afterwards.

## 2026-11-21 — Suhail Quraishi: light mode only (branch suhail/fanpulse-design-refresh)
Status: pushed in b108c13 (main and suhail/fanpulse-design-refresh).

What: removed the dark theme, the theme toggle and the pre-hydration theme script (`THEME_BOOT`). The site is
light only; the masthead, scoreboard and heroes stay as fixed dark surfaces. Dropped the dark token block and
dark-only rules, set `colorScheme: "light"`, removed `suppressHydrationWarning` from `<html>`. Visual QA now
runs light only. CLAUDE.md updated (design rules, QA steps).

Why: the user asked for light mode only.

Tests: typecheck; `npm test` (28); build; visual QA 375/768/1024/1440 + end-to-end flow on a fresh server:
no issues. React #418 no longer appeared (it did 1-2 times per run before), so the theme script that edited
`<html>` before hydration was the likely cause.

Unverified / known: the QA flow times out when re-run against the same server (in-memory votes from the
previous run); the original MVP behaves the same. Restart the server between QA runs.

## 2026-11-21 — Suhail Quraishi: design refresh, team logos, Vercel font fix (branch suhail/fanpulse-design-refresh)
Status: pushed in 1a18aad (main and suhail/fanpulse-design-refresh).

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
