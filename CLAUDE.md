# ES FanPulse (statshub): instructions for Claude

ES FanPulse is an EssentiallySports concept: NFL matchup stats plus evidence-based fan discussion
(PRD: "ES FanPulse Full PRD", Nov 2026). It is independent of FrameUp. These rules are adapted from the
FrameUp repo's working rules and apply to every session.

## Start of every session
1. Read the top of `project-docs/ai-edit-log.md` to see what others are doing.
2. `git fetch origin` and compare with `origin/main` before assuming anything is current.

## Working together
- Work on a local branch named `<your-name>/<short-topic>` (e.g. `suhail/fanpulse-mvp`). Commit as you go.
- **Never push without the person you work for saying "push"** in this session. Never force-push `main`,
  never rewrite or revert someone else's commits without asking.
- Conflicts: never resolve by dropping the other side's code. If it is not a plain list, stop and ask.
- Commits carry the real person's git name and email. Every edit-log entry starts with the person's name.
- Never edit the design-tools repo (`essentiallysports-tech/essentiallysports-design-tools`). It is a
  read-only reference for the ES design tokens.

## Edit log (`project-docs/ai-edit-log.md`)
Add an entry at the top for every change: `## YYYY-MM-DD — <Name>: <what> (branch <branch>)`, then status
(`in progress` / `committed, not pushed` / `pushed in <sha>`), what changed and why, tests run, and anything
unverified.

## Security and data (non-negotiable)
- Never read, print, store or paste secrets. Keys live in the host's env and a git-ignored `.env.local`.
- Never fabricate participation: no seeded comments or votes, no fake fan accounts (PRD §8, §11, §17).
- Never invent numbers. Every figure shown comes from the stats provider. While `provider.isDemo` is true
  the site shows the "Demo data" banner, uses fictional teams, and is noindexed. Metrics the provider does
  not supply stay null and are hidden, never estimated.
- Evidence values are always rebuilt server-side from the provider, never accepted from the client.
- Never expose user emails in public views.

## Code and design rules
- Stack: Next.js 15 (App Router) + React 19 + TypeScript. Stay on Next 15.5.x: Next 16.4.6 threw an
  intermittent hydration error (#418) on every page, even a bare one, after a second full page load.
- Data flows through `src/lib/data/provider.ts` (adapter). UI never reads vendor payloads.
  `STATS_PROVIDER=es` uses the ES Stats API (`src/lib/data/es/`: pure mapping in `map.ts`, snapshot loading in
  `provider.ts`; env `STATS_API_BASE_URL`, `STATS_API_KEY`, see `.env.example`); otherwise the demo provider.
  Server code calls `await ensureStats({ gameId | teams })` before reading stats. The API keeps box scores only
  from 2026-11-08 on, so last-5 yardage/player numbers show only when all five box scores exist.
- Stats logic: `src/lib/stats/` (compare, evidence, signals, ranking). Participation: `src/lib/store/`
  (in-memory now; each function maps to a PostgreSQL table/query).
- Design system: `src/styles/tokens.css` (ES tokens, adapted for the 55+ audience) and `src/styles/app.css`.
  ES fonts only (Roboto, Roboto Condensed), no purple, 4px spacing scale, tokens over literals, one primary
  button per view, 44px minimum targets, 18px reading text, visible focus, labels and aria, light mode only
  (no dark theme or theme toggle; the masthead, scoreboard and heroes are fixed dark surfaces),
  status = colour + word, charts always show the numbers.
- Copy: plain English, short, no jargon.

## Checks before asking to push
- `npm run typecheck` and `npm test` (vitest, `tests/`). Add tests for what you build.
- `npm run build`, then start the server and run visual QA (below).

## Mandatory UI quality assurance
After every frontend change, before calling it done:
1. `npm run build && STATS_PROVIDER=demo npx next start -p 3100`, then `BASE=http://localhost:3100 OUT=qa-shots npm run qa`
   (the flow needs the demo discussions). For real data, start without the override and pass
   `PAGES="home=/fanpulse,matchup=/fanpulse/nfl/matchups/<id>"` (layout checks only). `QA_CHROME` can point
   at an installed Chrome.
   It screenshots home, matchup, final matchup and discussion at 375 / 768 / 1024 / 1440 (light mode),
   flags horizontal overflow, off-screen elements, clipped text, targets under 44px and console/page errors,
   then runs the full flow (period switch, sign-in, vote, comment with evidence, incompatible evidence,
   report, editor moderation and signal draft approval).
2. Look at the screenshots yourself; don't rely only on the script.
3. Fix defects you introduced, re-run, repeat. Don't redesign unrelated sections.
4. Report: viewports tested, issues found, issues fixed, remaining issues, evidence.
Stop the server you started (kill the `next-server` process, not just `next start`) before rebuilding.
