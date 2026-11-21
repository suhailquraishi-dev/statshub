# AI edit log

Newest first. See CLAUDE.md for the format.

## 2026-11-21 — Suhail Quraishi: ES FanPulse MVP prototype (branch suhail/fanpulse-mvp)
Status: committed, not pushed.

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
