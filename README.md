# ES FanPulse (statshub)

NFL stats and evidence-based fan discussion. MVP prototype of the *ES FanPulse* PRD (Nov 2026).

> **Demo data.** Teams, players and numbers are fictional until a licensed stats provider is chosen (PRD §18).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 → /fanpulse
```

Sign in with any email to vote and comment. An `@essentiallysports.com` email gets **Editor tools**.
Sign-in is a prototype (no email is sent); a real build reuses ES identity.

## What's built (PRD §6)

| ID | Feature | Where |
| --- | --- | --- |
| F01 | Verified stats with period, units, sample, source, freshness and stale warning | `components/client/Stats.tsx`, `components/Shell.tsx` (`Freshness`) |
| F02 | Full season / last 5 filter; tables and plain-English explanation change together | `lib/stats/compare.ts` (`explain`), `PeriodProvider` |
| F03 | Discussions tied to a matchup and stat context; stable `/{id}-{slug}` URLs | `app/fanpulse/nfl/discussions/[param]` |
| F04 | Polls: one counted vote per account, re-vote changes the choice not the total | `lib/store/store.ts` (`vote`) |
| F05 | Comments, replies, reactions, sort, report, moderation, auto-hold screen, rate limit | `components/client/Conversation.tsx` |
| F06 | Immutable evidence snapshots, incompatible comparisons refused, corrections flagged | `lib/stats/evidence.ts` |
| F07 | Read anonymously; sign in to take part | `components/client/AuthProvider.tsx` |
| F08 | Editor tools: create, approve, feature, close, archive; moderation queue; audit log; stat-signal drafts | `app/fanpulse/editor` |
| F09 | Follow a discussion (opt-in; notifications not built yet) | `FollowButton` |

Also: discovery ranking with the PRD §8 weights (`lib/stats/ranking.ts`), analytics events (PRD §12) pushed
to `dataLayer` without comment text (`lib/analytics.ts`), reserved ad slots, newsletter opt-in shown after
engagement and kept separate from sign-up, JSON-LD, canonical URLs, noindex for thin pages and demo data.

Not built yet: AI summaries (F10), live game feed (F11), team and player hubs (Phase 2), notifications,
a real database, real auth, real provider adapter, CMS embeds.

## API (PRD §10)

`GET /api/v1/matchups`, `GET /api/v1/matchups/:id/stats?period=`, `GET /api/v1/matchups/:id/discussions`,
`GET /api/v1/discussions/:id?sort=`, `POST /api/v1/discussions/:id/comments` (accepts `Idempotency-Key`),
`POST /api/v1/comments/:id/evidence`, `POST /api/v1/comments/:id/reactions`, `POST /api/v1/polls/:id/vote`,
`POST /api/v1/reports`, `POST /api/v1/follows`, `POST /api/v1/evidence/preview`, `POST /api/v1/newsletter`,
`/api/v1/auth/{signin,signout,me}`, `/api/v1/editor/...`.

## Checks

```bash
npm run typecheck
npm test
npm run build && npx next start -p 3100
BASE=http://localhost:3100 OUT=qa-shots npm run qa
```

## Design

Tokens come from the ES design system (`essentiallysports-design-tools`, used read-only), adapted for a
55+ audience: 18px reading text, 44px+ targets, WCAG AA contrast in light and dark. See `src/styles/tokens.css`.
