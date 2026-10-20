# Publishing and editing

## Draft and live versions

Every guide has two versions:

- the **draft**, which you change in the editor and the builder;
- the **live** version, which is what users see.

**Publish** copies the draft to the live version. Until then, nothing you change reaches users, so it's safe to edit a guide that's already live.

The status badges at the top of the editor tell you where a guide stands:

| Badge | Meaning |
| --- | --- |
| **draft** | Not shown to anyone. |
| **live** | Published and shown to matching users. |
| **unpublished changes** | Live, and the draft differs from the live version. Choose **Publish changes** to update it. |
| **archived** | Hidden from the guide list and not shown to anyone. |

Changes reach users the next time they load a page.

## Saving

- **Save draft** (or **Ctrl+S** / **⌘S**) stores your edits. The editor warns you if you try to leave with unsaved changes.
- **Publish** / **Publish changes** saves and publishes in one go.
- Edits saved from the [builder](builder) show up in the editor when you switch back to its tab, as long as you have no unsaved changes there.

Before publishing, the editor checks that the guide isn't empty: a tour needs a step, a checklist an item, and hotspots need an element each.

## Unpublish, archive, delete

You can do all of these from the guide editor, or from the icons on each row of the **Guides** list (hover an icon to see its name). The list also has icons for **Publish**, **Duplicate**, **Analytics** and, for tours and hotspots, the **visual builder**, which opens on the page you last used it on.

| Action | Effect |
| --- | --- |
| **Unpublish** | Stops showing the guide. The draft is kept; publish again any time. User progress is kept too. |
| **Archive** | Hides the guide from the main list (find it under **Archived**) and stops showing it. **Restore** brings it back as a draft. |
| **Duplicate** | Creates a draft copy with the same content and targeting. Handy for a variant or a translated version. |
| **Delete** | Removes the guide with all its analytics and user progress. This can't be undone. |

To act on several guides at once, tick their checkboxes (or the box above the list to select every guide shown). A bar appears with **Publish**, **Unpublish**, **Archive**, **Restore as draft** and **Delete**. Each button only shows when it applies to some of the selection and only changes those guides: **Publish** publishes the drafts, **Unpublish** the live ones. When a number appears next to a button, that is how many of the selected guides it will change. If a guide can't be published yet (a tour with no steps, say), the others are still published and the message names the ones that weren't.

## Editing a live tour

Users who already completed or dismissed a tour won't see it again after you publish changes; progress belongs to the guide, not to a version. To show a reworked tour to everyone again, **Duplicate** it, publish the copy, and archive the old one.
