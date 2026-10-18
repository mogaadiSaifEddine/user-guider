# Product tours

A product tour is a sequence of steps. Each step is either a tooltip attached to an element of your app, or a modal in the middle of the screen. Users move through it with **Next** and **Back**, and can close it at any time with **×** or the Esc key.

## Create a tour

**Guides → New guide → Product tour.** A new tour starts with one welcome step. Choose **+ Add step** to add more: a template picker opens with two tabs:

- **Modal**: a card in the middle of the screen. Templates: *Create from scratch*, *Welcome modal*, *Hero modal* (full-width image with a headline on it), *Video modal*, *New feature*, *All set* (a closing step).
- **Tooltip**: a card next to an element. Templates: *Simple tooltip*, *Tooltip with image*, *Action tooltip* (the user clicks the element to continue), *Minimal hint*.

Type in the search box to search both tabs. A template is only a starting point; everything in it can be changed.

A step becomes a tooltip as soon as it has an element, which you pick in the [visual builder](builder). Until then it shows as a modal. Each step's header shows which one it is.

## Blocks

A step's content is a stack of **blocks**. Click a block to edit it, use ↑ ↓ to reorder and ✕ to remove. Add blocks with the buttons below the list (up to 20 per step). The **Preview** next to the editor shows the step as users will see it, in your workspace theme.

| Block | What it shows |
| --- | --- |
| **Heading** | A bold title. Alignment: left, center or right. |
| **Text** | Body text with [formatting](#formatting-text): bold, italic, underline, strikethrough, links, line breaks and lists. |
| **Image** | A picture. **Upload** one (PNG, JPEG, GIF or WebP, up to 2 MB) or paste an `https://` address. Options: height, *Fill* (crop to the box) or *Fit* (show the whole image), *Full width, edge to edge* for a hero look, *Text over the image* for a headline on the picture, and a description for screen readers. |
| **Video** | A YouTube or Vimeo link (the normal page address is fine), or a direct `.mp4` / `.webm` file. Plays inside the step. |
| **Buttons** | Up to four buttons, each with a label, a style (*Primary*, *Secondary*, *Link*) and an action (below). |
| **Divider** | A thin line. |
| **Spacer** | Empty space, 4–64 px. |

## Formatting text

Every text people see in a guide (headings, text, titles, descriptions, checklist items, survey questions, resource center entries) is edited with a formatting toolbar, in the dashboard and in the [builder](builder):

| Button | Shortcut | Result |
| --- | --- | --- |
| **B** | Ctrl+B (⌘B) | **Bold** |
| *I* | Ctrl+I | *Italic* |
| U | Ctrl+U | Underline |
| S | Ctrl+Shift+X | ~~Strikethrough~~ |
| Link | Ctrl+K | Link the selected words. Addresses start with `https://`, `/` (a page of your app) or `mailto:`. Links open in a new tab. Select a link and press Link again to change or remove it. |
| Bulleted / numbered list | | Lists, in texts and descriptions |
| Clear formatting | | Removes all of the above from the selection |

Titles and labels are one line, so their toolbar has no lists and Enter does nothing; it appears above the field while you type in it. Pasting from Google Docs, Word or a web page keeps bold, italic, underline, strikethrough, links and lists, and drops colors, fonts and images.

Text is stored with light markup (`**bold**`, `*italic*`, `++underline++`, `~~strike~~`, `[link](https://…)`, `- ` for list items). Guides written before the toolbar existed keep working as they are.

**Button actions**

| Action | Effect |
| --- | --- |
| Go to next step | Same as Next. On the last step, finishes the tour. |
| Go to previous step | Same as Back. |
| Finish the guide | Ends the tour and counts it as **completed**. |
| Close | Ends the tour and counts it as **dismissed**. |
| Open a link | Opens an address, in a new tab or the same tab. The tour stays on the step. |
| Start another guide | Completes this tour and starts another tour, announcement or survey. |

## Step settings

Under **Placement**:

| Setting | What it does |
| --- | --- |
| **Element** | A CSS selector for the element the step points at. Leave it empty for a centered modal. The builder fills it in for you. |
| **Size** | Small, medium or large. Tooltips are 280 / 340 / 420 px wide, modals 380 / 460 / 640 px. |
| **Position** | Where the tooltip sits relative to the element: *auto*, *top*, *bottom*, *left* or *right*. If there isn't room on the chosen side, it flips to a side that fits. *auto* tries bottom, top, right, then left. |
| **Advance on** | *Next button* (default), or *Click on element*: the step has no Next button and moves on when the user clicks the highlighted element. Use it to teach a real action, like "Click **New project**". |
| **Dim the rest of the page** | Darkens everything except the highlighted element. Turn it off for a lighter touch; the element still gets an outline. |

Under **Navigation buttons**: turn the automatic Back / Next / Done row on or off, hide the step counter ("2 of 5") or the Back button, and rename the buttons. If you turn the row off, add a **Buttons** block so people can move on. The *Hero modal* and *All set* templates do this.

Reorder steps with ↑ and ↓, remove one with ✕. A tour can have up to 50 steps.

## How tours behave

- **Scrolling.** If the element is off-screen, the page scrolls to it. The tooltip follows the element as the page scrolls or resizes.
- **Waiting for elements.** If a step's element isn't on the page yet (still loading, or on another page), the tour waits up to 15 seconds. If it still isn't there, the tour quietly stops (this counts as neither completed nor dismissed) and tries again on a later page load, from the last step the user saw.
- **Tours across pages.** A step can point at an element on a different page. Make the previous step's action take the user there (for example *Advance on: Click on element* on a menu link) and the tour picks up when the element appears.
- **Resuming.** If someone leaves mid-tour (closes the tab, navigates away), the tour resumes at the step they reached the next time it shows.
- **Finishing.** Pressing **Done** on the last step counts as *completed*. Closing with × or Esc counts as *dismissed*. With the default frequency, either one means the tour won't show again for that user.
- **One at a time.** Only one tour, announcement or survey is on screen. If several match a page, the one with the highest **Priority** goes first; the next one can show after it ends.

## Starting a tour on demand

Set **Trigger** to *Only manually* on the **Targeting** tab when a tour should only run when asked for:

- from a [checklist](checklists) item (*When clicked → Start a guide*), or
- from your app's code, e.g. a "Take the tour" button: `LocatifyGuides.start("GUIDE_ID")`. The editor shows the exact line under **Manual start**. See [JavaScript API](javascript-api).

Started manually, a tour always begins at step 1 and ignores page rules and frequency. User rules still apply: the user must be allowed to see the guide.

## Tips

- Keep steps short: one idea per step, two sentences at most.
- Four to six steps is plenty. Check the step funnel in [Analytics](analytics); a sharp drop tells you which step to cut or rewrite.
- Ask your developers to add `data-onboarding="…"` attributes to important elements so selectors keep working after redesigns. See [The visual builder](builder#making-selectors-stable).
