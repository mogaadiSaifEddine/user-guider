# Resource center

A resource center is a help button in the corner of your app. Clicking it opens a panel where people can search, restart a tour, work through their onboarding checklist, read short help articles, follow links to your docs, or contact you. It's the place users go back to when they need help, instead of waiting for a guide to show up.

Create one under **Guides → New guide → Resource center**. It starts with a Guides, an Articles and a Contact section that you can change or remove.

## Panel settings

| Setting | What it does |
| --- | --- |
| **Title** and **Subtitle** | The colored header at the top of the panel. |
| **Search box** | Searches guide names, article titles, summaries and text, and link labels. When nothing matches, the Contact section is shown instead. |

## Launcher

| Setting | What it does |
| --- | --- |
| **Show a launcher button** | Turn off to use your own help button or menu item instead; see [Open it from your app](#open-it-from-your-app). |
| **Label** | Text on the button, e.g. *Help*. Leave it empty for a round icon-only button. |
| **Icon** | Question mark, book, chat bubble, sparkle or rocket. |
| **Position** | Bottom, top or center, on the right or the left. In the center positions the launcher is a vertical tab on the edge of the screen and the panel opens next to it. |

When the panel contains a checklist, the launcher shows how many checklist items are left.

## Sections

Add sections at the bottom of the Content tab and order them with the arrows. A resource center can have up to 20 sections.

| Section | Shows | Notes |
| --- | --- | --- |
| **Guides** | A list of tours, announcements and surveys. Clicking one closes the panel and starts it from the beginning. | Each entry can have its own label (default: the guide's name) and a one-line description. A guide someone has completed gets a tick. Tours set to *Only manually* work well here. |
| **Checklist** | One of your [checklists](checklists), with its progress bar and items. | The checklist's own corner launcher is hidden on pages where the resource center shows, so users don't see it twice. Items behave exactly as in the checklist. |
| **Articles** | Help articles written right here. Clicking one opens it inside the panel. | Articles use the same blocks as announcements: headings, text, images, videos, buttons. A button that goes to a page or starts a guide works as usual; *Close* closes the panel; any other button goes back to the list. |
| **Links** | Links to your docs, videos, status page… | Each link opens in a new tab unless you untick it. |
| **Contact** | A short text and a button. | The button can open an email to an address, open a page, or send an event your app listens to (see below). |

Guides and checklists only appear for users they target: an entry pointing at a guide the user can't see is left out, and an empty section is hidden. Guides and checklists must be published.

### Opening your chat widget from Contact

Pick **Your chat widget (event)** as what the button opens. The panel closes and the page receives a `locatify-guides:contact` event, so your developers can open Intercom, Crisp, HubSpot or your own chat:

```js
window.addEventListener("locatify-guides:contact", () => {
  Intercom("show");
});
```

## Open it from your app

```js
LocatifyGuides.openResourceCenter();
LocatifyGuides.closeResourceCenter();
```

This works with or without the launcher button, e.g. from a *Help* item in your menu. If it's called before the snippet has loaded, the panel opens as soon as it's ready. See [JavaScript API](javascript-api#openresourcecenter).

## Targeting

Page and user rules work as for other guides ([Targeting and timing](targeting)). Trigger, delay and *Show again* don't apply: the launcher is there on every matching page, for every matching user, and the panel never opens by itself.

Only **one resource center shows on a page**. When several match, the one with the highest **Priority** wins. Use this to give, say, admins and regular users different help: one resource center per audience, targeted with user rules.

## Analytics

| Figure | Meaning |
| --- | --- |
| **Opened it** | People who opened the panel. |
| **Clicked something** | People who clicked a guide, article, link or contact button. |
| **Most used** | How many people clicked each entry, as a share of those who opened the panel. |

Ticks made in an embedded checklist count towards the checklist's own analytics.
