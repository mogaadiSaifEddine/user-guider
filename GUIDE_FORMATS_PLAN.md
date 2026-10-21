# New guide formats

Ways to show guides that the SDK can't render today. Separate from [NEXT_MILESTONES.md](NEXT_MILESTONES.md) (marketing). Conditional triggers (show on goal success or failure) are their own plan; the formats here work with today's targeting.

## What exists already

Some of this is half there, so the plan builds on it rather than starting over:

- **Banner**: `ANNOUNCEMENT` with `format: "banner"` (`announcementContentSchema`). One line, fixed to the top, closable. It runs in the **modal slot** (`show()` in `sdk/index.ts`), so a banner blocks every tour and survey until it's closed, and the other way round.
- **Video**: a `video` block (YouTube, Vimeo, .mp4/.webm via `videoEmbed` in `src/lib/format.ts`) that tours and announcements can use.
- **Interactive steps**: `advanceOn: "click"` on tour steps. Nothing else: the step can't wait for typing, a URL change, an element appearing or a `track()` event.
- **Beacons**: hotspots. A beacon disappears for good after the user clicks "Got it", the tooltip only has a title and a body, and the "Got it" label is hard-coded English (`sdk/widgets.ts`, `openTip`), so translations and `uiStrings` don't apply to it.

Translations come for free as long as new text fields use the names in `RICH_FIELDS` / `PLAIN_FIELDS` (`src/lib/i18n.ts`). Pick field names from those lists.

| # | Format | Size | Depends on |
| --- | --- | --- | --- |
| F1 | Banners in their own slot | S–M | none |
| F2 | Interactive tour steps | M | none |
| F3 | Persistent launchers (hotspots that stay) | S–M | none |
| F4 | Inline cards inside the host page | M | none |
| F5 | Media steps and narration | S, plus M for TTS | F2 for "advance when the video ends" |

The order is by value for effort. Each format ships on its own.

---

## F1 · Banners in their own slot

Trial-ending notices, outages and feature launches without a modal, and without blocking onboarding.

**Scope**
- Keep `ANNOUNCEMENT` + `format: "banner"`, so existing banners and their translations keep working and no enum migration is needed. Add `banner: { position: top|bottom, mode: overlay|push, tone: brand|info|success|warning, dismissible, link? }` with `prefault({})`.
- SDK: banners get a slot of their own next to the modal slot. They are evaluated in `evaluate()` like hotspots and checklists, with one banner on screen at a time (highest priority). A tour can run while a banner is showing.
- `push` mode: pad `document.body` by the banner height (`ResizeObserver`), and remove the padding on close. The note must tell authors that fixed headers on the host page may still overlap.
- `dismissible: false` for outages; then `frequency` decides when it comes back.
- Optional schedule: `startsAt` / `endsAt` on `targetingSchema`, checked in `sdkInit`. This is generic, so every type gets it.
- Editor: banner settings in `content-editors.tsx`, with a live preview strip.
- UserGuiding import: `src/lib/userguiding.ts` currently skips banners (`count("banners", …)`). Map them onto this format.

**Done when** a banner and an auto tour show on the same page, and an imported UserGuiding banner looks the same as in UserGuiding.

## F2 · Interactive tour steps

The tour moves on when the user actually does the thing, not when they click Next.

**Scope**
- Replace `advanceOn` with a union (old values parse into it):
  - `next`: today's behaviour.
  - `click`: today's behaviour.
  - `input`: the target field has a value (optionally `minLength`, or a regex for a URL or email).
  - `element`: another selector appears (for example the dialog the user just opened).
  - `url`: the URL matches a `urlRule` (multi-page tours).
  - `event`: `track(name)` is called. This needs the SDK to fan `track()` out to the running tour, which is the same hook conditional triggers will use.
- Per step `skipIf: element-present | element-absent` (with a selector), so "Open settings" is skipped when settings are already open.
- `optional: true`: when the target isn't found within `ELEMENT_TIMEOUT_MS`, skip the step instead of ending the tour as `lost`.
- Next button: hidden for `click` / `input` / `element`, shown as a "Skip" link when the step is optional.
- Builder: pick the second selector for `element` the same way as the target.
- Analytics: record which step a tour got `lost` on (`stepIndex` on the event), so broken steps show up in the step funnel.

**Done when** a tour can say "type a project name", wait for it, then "click Create", land on the next page and carry on there.

## F3 · Persistent launchers (hotspots that stay)

A small "?" or "i" next to a field that is always there, for help people come back to.

**Scope**
- Per hotspot:
  - `style: beacon|icon` (pulse or a static icon).
  - `persistent` (don't remove it after opening; `hotspot_opened` is still recorded once).
  - `openOn: click|hover`.
  - `offset` (corner of the target).
- Tooltip content as `blocks` (the same block editor as tours). This allows images, video and buttons, and the button actions include `guide` (start a tour) and `url`.
- Fix: the "Got it" label uses `t()` / `uiStrings` instead of hard-coded English.
- Migration: hotspots with `title` / `body` and no `blocks` are converted when parsed, the way `legacyStep` does for steps.

**Done when** a persistent "?" next to a field opens a tooltip with a "Show me" button that starts a tour, and the tooltip text is translated.

## F4 · Inline cards inside the host page

Content placed inside the page rather than floating above it: an empty state ("No info points yet: watch how") or a tip at the top of a list.

**Scope**
- New `GuideType.INLINE` (enum migration). Content: `{ selector, position: before|after|prepend|append|replace, blocks, dismissible }`.
- SDK: the card gets its own shadow host inserted at the selector. The single overlay root from `shadow()` in `sdk/ui.ts` won't do, because the card has to scroll and flow with the page. A `MutationObserver` re-inserts it when the host app re-renders (Angular in the CMS will).
- `replace` hides the matched element and puts it back on dismiss or teardown.
- Not in the modal slot; several inline cards can show at once.
- Builder: pick the anchor element and preview it in place.

**Done when** the CMS "no info points" empty state shows an inline card with a video and a "Start tour" button, and the card survives Angular re-rendering the list.

## F5 · Media steps and narration

**Scope**
- Video block: `autoplay` (muted, as browsers require), and Loom URLs in `videoEmbed`.
- `advanceOn: "media_end"` (F2's union) for .mp4/.webm. YouTube and Vimeo would need their player APIs, so leave them out at first.
- New `audio` block: a URL or an uploaded asset, with a play button and a progress bar.
- **Narration from text** (optional, M): "Generate voice-over" in the editor turns a step's text into audio for each language through the Locatify TTS service (localization_service). Store it as an `Asset` for each locale, in `audio.byLocale`. URLs aren't translated fields, so `applyTranslations` won't do this. Regenerate when the text's translation `source` hash changes. This needs a cross-repo call; agree on the API first.
- Analytics: new `media_completed` event type.

**Done when** a step plays its narration in the user's language and moves on when the video ends.

## Every format touches

- `src/lib/guide-schema.ts`: schemas, defaults (`defaultContent`), and parsers that keep old content working.
- `sdk/widgets.ts`, `sdk/blocks.ts`, `sdk/ui.ts` (CSS) and `sdk/index.ts` (slots, `evaluate()`), then rebuild `public/sdk.js`.
- The editor: `content-editors.tsx` / `blocks-editor.tsx`, plus `template-picker.tsx` for starter templates.
- `src/lib/sdk-service.ts` when targeting changes (F1 schedule).
- `EventType` in `sdk/widgets.ts` and the events route for new event types, plus the analytics page.
- Docs under `content/docs/` (tours.md, plus a new page each for banners and inline cards).
- AI drafting (`src/lib/ai.ts`, `kind: TOUR | HOTSPOT`) can be extended later; it isn't needed to ship.

## Status (2026-10-21)

Built, uncommitted. Migration `20261021120000_inline_cards` is applied.

- **F1**: done as planned (banner stays an announcement format; open question 1 answered "no new type" for now). Schedule (`startsAt` / `endsAt`) works for every type. UserGuiding banners are imported, mapped from the banner shape in UserGuiding's embed script; no real account with banners was available to test against.
- **F2**: done. Multi-page tours survive full page loads through `sessionStorage` (30 minutes). Lost tours send a new `guide_lost` event with the step index.
- **F3**: done. Old hotspot title/body become blocks with ids derived from the hotspot id, and their translation keys are renamed on read.
- **F4**: done in User Onboarder (SDK, editor, builder, docs). The CMS cards themselves (the "Done when" example) aren't created: that needs a published inline card for the CMS workspace.
- **F5**: autoplay, Loom, `media_end`, the audio block with per-language uploads, and `media_completed` are done. **Narration from text (TTS) is not built**: it needs the cross-repo API and the AI-credits question (open question 3) settled first.

## Open questions

1. F1: should banners become their own `GuideType.BANNER` in the dashboard list (clearer for authors), at the cost of a migration? The plan keeps them as an announcement format.
2. F4: which CMS screens get inline cards first? This decides how hard the Angular re-render handling has to be.
3. F5: is calling the TTS service from this app OK, and who pays for the characters (AI credits)?
