# Troubleshooting

Start with the browser's developer tools on the page where the guide should appear: the **Console** (messages start with `[LocatifyGuides]`) and the **Network** tab (requests to `/api/sdk/`).

## A guide doesn't show up

Go through these in order:

1. **Is the script loading?** The network tab should show `sdk.js` and `/api/sdk/init` returning 200. If `sdk.js` is blocked, check your [Content Security Policy](install#content-security-policy) and ad blockers.
2. **Is the guide published?** Drafts and archived guides are never shown. After editing a live guide, did you **Publish changes**?
3. **Is it this user's guide?** Open the person on the **Users** page:
   - Compare their attributes with the guide's user rules.
   - If they're anonymous, the guide needs *Also show to anonymous visitors*.
   - If the guide is listed as *completed* or *dismissed*, the **Show again** setting may keep it hidden. See [How often](targeting#how-often).
4. **Is it this page?** Check the page rules against the address in the browser. *Path is* and *Path starts with* ignore the domain and `?query`; *URL contains* includes them.
5. **Is the trigger manual?** Then it only starts from a checklist or `start()`.
6. **Is something else on screen?** Only one tour, announcement or survey shows at a time; a higher-priority one may be first. A tour or announcement also starts at most once per page load, so reload the page after dismissing one while testing.
7. **Is the element there?** For tours, the first step's element must appear within 15 seconds. Open the [builder](builder) on that page: an amber dot means the selector doesn't match anything there.
8. **Is `data-wait-for-identify` set** while your code never calls `identify()`? Then nothing loads.

## Testing as a fresh user

Your own progress hides guides you've already seen. Options:

- Use a private window and a test account (or no account, for anonymous guides).
- Temporarily set **Show again** to *On every page load*.
- Call `LocatifyGuides.reset()` in the console for a new anonymous visitor.

## Console messages

| Message | Cause |
| --- | --- |
| `Missing data-key on the script tag.` | The second script tag has no `data-key`. |
| `Unknown workspace key` | The key is wrong or was rotated. Copy the snippet from the Install page again. |
| `Invalid user hash` / `User hash required` | See [Identity verification](identity-verification). The signed id must be exactly the id passed to `identify()`. |
| `Guide not available for this user: …` | `start()` was called with an id that isn't published or doesn't match this user's rules. |

## The tooltip points at the wrong thing or nothing

The element's selector no longer matches after a change to your app. Open the builder, re-pick the element, save, and publish. To prevent it, add `data-onboarding` attributes to key elements; see [Making selectors stable](builder#making-selectors-stable).

## The builder says the session expired

Builder links last 4 hours, and the author must still be a member of the workspace. Open the builder again from the dashboard.

## Checklist items don't tick

- *Event* items: the name passed to `track()` must match exactly (case-sensitive), and the event must be sent for the same user. Check the person's activity on the **Users** page; tracked events are listed there.
- *Guide* items: the other guide must be **completed**, not dismissed.
