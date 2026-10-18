# Targeting and timing

The **Targeting** tab of a guide decides where it appears, who sees it, when it starts and whether it comes back.

## Pages

A guide shows on pages that match **any** of its page rules. With no rules, it shows on every page.

| Rule | Compares against | Example | Matches |
| --- | --- | --- | --- |
| **URL contains** | the full address, including `?query` and `#hash` | `/projects` | `https://app.example.com/projects/42?tab=map` |
| **Path is** | the path only; a trailing `/` is ignored | `/dashboard` | `/dashboard` and `/dashboard/`, not `/dashboard/stats` |
| **Path starts with** | the path only | `/settings` | `/settings`, `/settings/team` |
| **URL matches regex** | the full address | `/projects/\d+$` | `/projects/42`, not `/projects/new` |

Single-page apps are handled: when the address changes without a full page load, the rules are checked again.

## Users

A guide shows to users who match **all** of its user rules. Rules test the **attributes** your app sends when it [identifies the user](identify), for example `plan`, `role` or `signedUpAt`. Ask your developers which attributes are available. The [Users](analytics#users) page shows what each person has.

| Operator | Matches when the attribute… |
| --- | --- |
| is / is not | equals / doesn't equal the value (text comparison) |
| contains | contains the value, ignoring upper/lower case |
| greater than / less than | is larger / smaller. Numbers compare as numbers; dates like `2026-10-01` compare as dates |
| is set / is not set | has any value / is missing or empty |

Examples:

- New users only: `signedUpAt` *greater than* `2026-10-01`
- Admins on the free plan: `role` *is* `admin` and `plan` *is* `free`

**Anonymous visitors.** People your app hasn't identified (for example on a public page, or before login) only see a guide if **Also show to anonymous visitors** is ticked. User rules can't match them because they have no attributes, so leave user rules empty for guides meant for anonymous visitors.

## Trigger

| Trigger | Behavior |
| --- | --- |
| **Automatically when targeting matches** | Starts on its own on a matching page. |
| **Only manually** | Never starts on its own; only from a checklist item or `LocatifyGuides.start()` in your app. Tours and announcements only. |

## Delay

Seconds to wait after a matching page loads before a tour or announcement starts (0–600). Use a few seconds so users get their bearings first. If the user leaves the page during the delay, the guide waits for the next matching page.

## How often

**Show again** controls whether a user sees the guide again:

| Option | Behavior |
| --- | --- |
| **Never, once seen through or dismissed** (default) | Shown until the user completes or dismisses it, then never again. A tour left halfway resumes on the next visit. |
| **On later visits until completed** | Dismissing hides it for the rest of that page load only; it returns on later page loads until completed. |
| **On every page load** | Shown on every page load, even after completion. Mostly useful for testing. |

Within a single page load, a tour or announcement starts automatically at most once. In a single-page app, a "page load" lasts until the browser fully reloads; moving between screens of the app doesn't count as a new one.

## Priority

When several tours or announcements match the same page, the one with the highest **Priority** (−100 to 100, default 0) shows first. The next one can start after it closes. With equal priority, the guide published (or last re-published) earliest goes first.
