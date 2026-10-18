# Product tours

A product tour is a sequence of steps. Each step is either a tooltip attached to an element of your app, or a modal in the middle of the screen. Users move through it with **Next** and **Back**, and can close it at any time with **×** or the Esc key.

## Create a tour

**Guides → New guide → Product tour.** A new tour starts with one welcome step. Add steps with **+ Add step** in the editor, or in the [visual builder](builder), which is the easier way to attach steps to elements.

## Step settings

| Setting | What it does |
| --- | --- |
| **Title** | Bold heading of the step. Optional. |
| **Text** | The body. You can use **\*\*bold\*\***, *\*italic\**, links written as `[text](https://…)` (they open in a new tab) and line breaks. |
| **Element** | A CSS selector for the element the step points at. Leave it empty for a centered modal. The builder fills it in for you. |
| **Position** | Where the tooltip sits relative to the element: *auto*, *top*, *bottom*, *left* or *right*. If there isn't room on the chosen side, it flips to a side that fits. *auto* tries bottom, top, right, then left. |
| **Advance on** | *Next button* (default), or *Click on element*: the step has no Next button and moves on when the user clicks the highlighted element. Use it to teach a real action, like "Click **New project**". |
| **Dim the page** | Darkens everything except the highlighted element. Turn it off for a lighter touch; the element still gets an outline. |

Reorder steps with ↑ and ↓, remove one with ✕. A tour can have up to 50 steps.

## How tours behave

- **Scrolling.** If the element is off-screen, the page scrolls to it. The tooltip follows the element as the page scrolls or resizes.
- **Waiting for elements.** If a step's element isn't on the page yet (still loading, or on another page), the tour waits up to 15 seconds. If it still isn't there, the tour quietly stops (this counts as neither completed nor dismissed) and tries again on a later page load, from the last step the user saw.
- **Tours across pages.** A step can point at an element on a different page. Make the previous step's action take the user there (for example *Advance on: Click on element* on a menu link) and the tour picks up when the element appears.
- **Resuming.** If someone leaves mid-tour (closes the tab, navigates away), the tour resumes at the step they reached the next time it shows.
- **Finishing.** Pressing **Done** on the last step counts as *completed*. Closing with × or Esc counts as *dismissed*. With the default frequency, either one means the tour won't show again for that user.
- **One at a time.** Only one tour or announcement is on screen. If several match a page, the one with the highest **Priority** goes first; the next one can show after it ends.

## Starting a tour on demand

Set **Trigger** to *Only manually* on the **Targeting** tab when a tour should only run when asked for:

- from a [checklist](checklists) item (*When clicked → Start a guide*), or
- from your app's code, e.g. a "Take the tour" button: `LocatifyGuides.start("GUIDE_ID")`. The editor shows the exact line under **Manual start**. See [JavaScript API](javascript-api).

Started manually, a tour always begins at step 1 and ignores page rules and frequency. User rules still apply: the user must be allowed to see the guide.

## Tips

- Keep steps short: one idea per step, two sentences at most.
- Four to six steps is plenty. Check the step funnel in [Analytics](analytics); a sharp drop tells you which step to cut or rewrite.
- Ask your developers to add `data-onboarding="…"` attributes to important elements so selectors keep working after redesigns. See [The visual builder](builder#making-selectors-stable).
