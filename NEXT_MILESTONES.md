# Next milestones

What comes after product updates and reactions. The theme is marketing: getting what User Onboarder already knows (updates, events, surveys, companies) out to the channels and tools marketing uses, and proving guides move revenue.

Order is by value per effort. Each milestone ships on its own.

| # | Milestone | Size | Depends on |
| --- | --- | --- | --- |
| M1 | Update distribution: feed and webhooks | S–M | none |
| M2 | AI channel drafts for updates | S | M1 |
| M3 | Guide goals and conversion tracking | M | none |
| M4 | Acquisition attribution on end users | S | none |
| M5 | CRM sync (HubSpot first) | M–L | M3, M4 helpful |
| M6 | Review and referral prompts | S | M3 |
| Later | Native email, native social posting | L | M1, demand |

---

## M1 · Update distribution: feed and webhooks

Every published update reaches other channels without anyone copying it by hand. Zapier, Make, Buffer, Slack and Mailchimp (RSS-to-email) take it from there, so we don't maintain per-network integrations.

**Scope**
- `GET /updates/[slug]/feed.xml` (Atom; RSS 2.0 alias if cheap): published posts only (`publicWhere` in `src/lib/updates-service.ts`), title, summary, cover, labels as categories, link to the post page. `?lang=` picks a translation, falling back to English.
- `<link rel="alternate" type="application/atom+xml">` on the public updates page.
- Webhook settings per workspace: URL, secret, enabled. Store in `updatesPage` JSON or a new `Workspace.updatesWebhook` column.
- Payload: `{ event: "update.published", update: { id, title, summary, url, coverUrl, labels, publishedAt, translations } }`, signed with `X-Signature: sha256=<hmac>` like identity verification.
- Slack mode: if the URL is a Slack incoming webhook, send Block Kit instead of the raw payload.
- "Send test" button in settings.

**Scheduled posts are the catch.** A post with a future `publishedAt` goes live with no write (`updateState` in `src/lib/updates.ts`), so delivery can't hang off the save action.
- New table `UpdateDelivery { id, updateId, channel, status (PENDING|SENT|FAILED), attempts, lastError, sentAt }`, unique on `(updateId, channel)` so nothing is sent twice.
- `POST /api/cron/updates`, protected by `CRON_SECRET`, run every 10 minutes by the host's scheduler: finds live updates with no `SENT` delivery, sends them, and retries failures with backoff (max 5).
- Unpublishing doesn't recall anything already sent. Say so in the UI.

**Done when** a post scheduled for later shows up in the feed and in a Slack channel within 10 minutes of going live, exactly once.

## M2 · AI channel drafts for updates

The author gets platform-specific copy to review, not just a raw post. Nothing is posted automatically.

**Scope**
- "Promote" panel on a published update: Gemini (`src/lib/ai.ts`) drafts a LinkedIn post, a short X post, a newsletter blurb and a release-notes line from `content`, using `Workspace.aiContext` for tone.
- Editable, copy-to-clipboard, per language when translations exist.
- Optional: include the drafts in the webhook payload (`drafts.linkedin` and so on) so Zapier/Buffer can post the approved text.

**Done when** an author can go from a published update to copy ready to paste on LinkedIn in one click.

## M3 · Guide goals and conversion tracking

Show that a guide caused something, e.g. "users who finished the AI translate tour bought credits 3× as often".

**Scope**
- Optional goal on a guide: a custom event name (`track("credits_purchased")`, already stored as `Event.type = "custom"`) or a URL visit, plus a window (default 7 days).
- Conversion = goal event after `guide_shown` within the window. Compare completed vs dismissed vs not shown (holdout).
- Optional holdout: hold back N% of eligible users from the guide (decided in `sdk-service.ts` eligibility, stored on `GuideProgress`) so the lift is measured, not assumed.
- Goal and lift on the guide analytics page (`src/lib/analytics.ts`).

**Done when** the analytics page shows conversion rate and lift against the holdout for a guide with a goal.

## M4 · Acquisition attribution on end users

Find out which channels bring users who activate, not just users who sign up.

**Scope**
- The SDK reads `utm_*`, `gclid`/`fbclid` and `document.referrer` on the first visit, keeps them in localStorage, and sends them on `/api/sdk/init`.
- New `EndUser` columns: `firstSource`, `firstMedium`, `firstCampaign`, `firstReferrer`, `firstLandingUrl`. First touch only, never overwritten.
- Available as targeting rules and as filters/breakdowns in analytics and M3 conversions.

**Done when** guide completion and goal conversion can be broken down by `utm_source`.

## M5 · CRM sync (HubSpot first)

Marketing acts on in-app behaviour: a nudge email when someone is stuck, a sales task when an account is ready to expand.

**Scope**
- HubSpot private-app token per workspace (encrypted at rest).
- Push contact properties keyed by email from `identify()` attributes: last seen, guides completed, NPS score, M4 source, company.
- Push selected events as HubSpot custom behavioural events (guide completed, survey answered, M3 goal reached).
- Saved segments in the dashboard (e.g. "signed up 7+ days ago, never completed onboarding"), synced as a HubSpot list.
- Runs from the M1 cron, incremental via a `syncedAt` cursor.
- Needs a decision on consent: only sync identified users whose host app passes an email and a marketing-consent attribute.

**Done when** a HubSpot workflow can trigger on "completed onboarding checklist" from User Onboarder data.

## M6 · Review and referral prompts

Ask happy users at the right moment.

**Scope**
- Guide template "Review request": shown after an M3 goal event or an NPS answer of 9–10, linking to G2/Capterra/Trustpilot (configurable).
- Guide template "Refer a colleague": share link with a ref code. Signups are attributed through M4.
- Results show up in survey results and analytics.

**Done when** an NPS promoter gets a review prompt automatically and the click is tracked.

## Later, if customers ask

- **Native email digests** of updates to end users: needs a provider (Resend/Postmark), end-user emails, consent, unsubscribe and bounce handling. HubSpot via M5 may cover it.
- **Native social posting** (LinkedIn page, X): per-workspace OAuth, expiring tokens, LinkedIn API approval, paid X API. Zapier/Buffer via M1 + M2 covers it until then.

## Open questions

1. Where is the app hosted, and which scheduler runs the cron (Vercel Cron, Neon/pg_cron, an external pinger)?
2. HubSpot is the assumed CRM. Confirm before M5.
3. For CMS Locatify as the first customer: which custom events (`track()`) does the CMS send today? M3 needs at least "tour published" and "credits purchased".
