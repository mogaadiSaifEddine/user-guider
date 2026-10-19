# User Onboarder

Self-hosted in-app onboarding, a replacement for UserGuiding: product tours, checklists, announcements, hotspots and analytics.
Multi-tenant: each workspace is one website or app with its own snippet, guides and data.

- **Dashboard** (Next.js App Router): author guides, target them, publish, read analytics.
- **Embed script** (`sdk/` → `public/sdk.js`): renders guides on the customer's site inside a shadow root and reports events.
- **Builder mode**: from a tour or hotspot guide, *Open builder* loads the customer's site with `?lg_builder=<token>`; the author clicks elements on the real page and saves the draft.
- **PostgreSQL** via Prisma (hosted on [Neon](https://neon.tech)).

## AI drafting

With `GEMINI_API_KEY` set, the builder can draft tours and hotspots: `sdk/snapshot.ts` describes the page (labels, sections, visible text, positions; never field values) and `sdk/capture.ts` adds a screenshot with numbered boxes and fields painted over, `POST /api/builder/ai` sends it to Gemini (`src/lib/ai.ts`, model `GEMINI_MODEL`, default `gemini-3.8-flash`) with a JSON schema, and maps the chosen element ids back to selectors. Nothing is saved until the author saves.

## Run locally

```bash
cp .env.example .env        # then set DATABASE_URL, DIRECT_URL (Neon) and AUTH_SECRET
npm install
npm run db:migrate
npm run db:seed             # optional: demo@useronboarder.local / demo1234
npm run dev                 # builds sdk.js, starts Next on :3000
```

With the seed loaded, open http://localhost:3000/demo.html to see every guide type on a fake host page.
Run `npm run dev:sdk` in a second terminal to rebuild `sdk.js` on change.

## Documentation

User docs are part of the app at `/docs` (public, no login): guide authors, developers and self-hosting. Pages are Markdown in `content/docs/`; order, titles and grouping are set in `src/lib/docs.ts`. Links between pages use the bare slug, e.g. `[Targeting](targeting#users)`.

## How it fits together

| Path | What |
| --- | --- |
| `prisma/schema.prisma` | Users, workspaces, guides (draft `content` + live `publishedContent`), end users, progress, events |
| `src/lib/guide-schema.ts` | Zod shapes of guide content, targeting and theme; shared by the API, dashboard and SDK types |
| `src/lib/targeting.ts` | URL/user rule matching, bundled into the SDK (kept zod-free) |
| `src/lib/sdk-service.ts` | `/api/sdk/init` and `/api/sdk/events` logic: identity, eligibility, progress, checklist auto-completion |
| `src/app/api/builder/guide` | Builder-mode read/save, bearer-token auth |
| `src/app/app/[ws]/…` | Dashboard pages and server actions |
| `sdk/` | Embed script: `index.ts` runtime, `widgets.ts` renderers, `builder.ts`, `selector.ts` |

**Publishing.** Edits (dashboard or builder) change the draft only. *Publish* copies it to `publishedContent`, which is all the SDK ever sees.

**Identity.** `identify(userId, attributes, { hash })`. With *Require identity verification* on, `hash` must be `HMAC-SHA256(secretKey, userId)` computed on the customer's server. Visitors who are never identified get an anonymous id and only see guides with *Also show to anonymous visitors*.

**Checklists** complete items on click, on a tracked event (`UserOnboarder.track(name)`), or when another guide is completed. Event- and guide-based completion is computed on the server, so it works across pages and devices.

**Analytics** count distinct users per event type from the `Event` table.

## Embed API

```js
UserOnboarder.identify(id, attributes?, { hash }?)
UserOnboarder.track(name)
UserOnboarder.start(guideId)   // run a tour/announcement now
UserOnboarder.page()           // re-evaluate targeting (SPA routes are detected automatically)
UserOnboarder.reset()          // on logout
```

Script tag attributes: `data-key` (required), `data-api` (API origin if not the script's origin), `data-wait-for-identify`.

## Deploy

Any Node host plus PostgreSQL (Neon). Set `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `AUTH_SECRET` and `NEXT_PUBLIC_APP_URL`, run `npm run build`, `npm run db:deploy`, `npm start`.
`sdk.js` is cached for 5 minutes (`next.config.ts`).

## Not built yet

- Email invites (members must sign up first), password reset.
- Guide versions/history, A/B tests, localization of guide text.
- Event retention: the `Event` table grows forever; add a cleanup job before heavy traffic.
- Rate limiting on the public SDK endpoints.
