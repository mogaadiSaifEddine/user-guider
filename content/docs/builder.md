# The visual builder

The builder opens your real app with an editing panel, so you can attach tour steps and hotspots to elements by clicking them. It's available for **product tours** and **hotspots**; checklists and announcements don't point at elements and are edited in the dashboard only.

## Open the builder

1. Open a tour or hotspot guide in the dashboard.
2. In the **Visual builder** box, enter the full address of the page you want to start on, e.g. `https://cms.locatify.com/projects`. The dashboard remembers it for next time.
3. Choose **Open builder**. Your app opens in a new tab with the builder panel in the bottom-left corner.

Requirements:

- The [snippet must be installed](install) on that page.
- Sign in to your app in that browser first if the page needs a login.
- The builder link is valid for 4 hours. After that, open it again from the dashboard.

If you have unsaved changes in the dashboard, save them first: the builder edits the saved draft.

## The panel

Each step (or hotspot) is a row with a number, its title and a colored dot:

| Dot | Meaning |
| --- | --- |
| Green | Its element is on the current page. |
| Amber | It has an element, but that element isn't on this page. Normal for multi-page tours. |
| Grey | No element: a centered modal (tours) or not picked yet (hotspots). |

Click a row to expand it and edit the title, text, position, *Advance on* and *Dim the page*. These are the same settings as in the dashboard; see [Product tours](tours#step-settings).

## Let AI draft it

If AI is set up on your server, **✨ Draft steps with AI** at the top of the panel reads the page and drafts the steps or hotspots for you. See [Draft guides with AI](ai).

## Pick an element

1. Expand a step and choose **Pick element** (or **Re-pick element**).
2. The panel hides. Move the mouse over the page: the element under the pointer is outlined.
3. Click the element. The panel comes back showing the new selector.

Press **Esc** to cancel. While picking, clicks don't trigger anything in your app, so you can safely pick buttons and links.

For tours, **Make modal** removes the element so the step shows in the middle of the screen.

You can browse your app normally between picks (open menus, go to other pages). The builder stays open as you navigate in the same tab.

## Preview, save, exit

- **Preview** runs the tour from the expanded step (or shows the hotspots) exactly as users will see it. Nothing is recorded in analytics. For hotspots, end the preview with **End preview**.
- **Save** writes your changes to the guide's draft. Live users don't see them until you **Publish** in the dashboard.
- **Exit** leaves builder mode and reloads the page. You're warned if there are unsaved changes.

While the builder is open, live guides don't run in that tab.

## Making selectors stable

The builder writes a CSS selector for the element you click, preferring things that rarely change:

1. the element's `id`, unless it looks auto-generated;
2. attributes `data-onboarding`, `data-guide`, `data-testid`, `data-test`, `data-cy`, `aria-label`, `name` or `title`;
3. otherwise a path through parent elements, using class names that don't look generated and position among siblings.

Path selectors (option 3) can break when the page layout changes. The fix is to ask a developer to add a stable attribute to elements you guide people to:

```html
<button data-onboarding="new-project">New project</button>
```

Then re-pick the element. The builder will use `button[data-onboarding="new-project"]`.

If a step stops appearing after a release, open the builder: an amber dot on a page where the element obviously exists means the selector broke. Re-pick it, save and publish.
