# Checklists

A checklist is a button in the bottom corner of your app, labelled with the checklist title and progress (for example *Get started 1/3*). Clicking it opens a panel with a progress bar and the list of tasks. Items tick themselves off as users do things, so people can come back to it over several days.

## Checklist settings

| Setting | What it does |
| --- | --- |
| **Checklist title** | Heading of the panel and label of the launcher button. |
| **Description** | Short text under the title. |
| **Launcher position** | Bottom right or bottom left. |

## Items

Each item has a title, an optional description, and two rules: what happens when it's clicked, and when it counts as done. A checklist can have up to 30 items.

**When clicked**

| Option | Effect |
| --- | --- |
| Nothing | Clicking does nothing (useful with *Done when: The item is clicked* for "read this" items). |
| Start a guide | Closes the panel and starts a tour, announcement or survey. Pair it with a tour whose trigger is *Only manually*. |
| Go to a page | Navigates to an address, e.g. `/projects/new` or `https://help.example.com`. |

**Done when**

| Option | Effect |
| --- | --- |
| The item is clicked | Ticked as soon as the user clicks it. |
| An event is tracked | Ticked when your app reports that event, e.g. `project_created`. Your developers send it with `LocatifyGuides.track("project_created")` in the browser or from the server ([HTTP API](http-api)). The editor shows the exact line to give them. |
| A guide is completed | Ticked when the user completes another guide, e.g. the welcome tour. |

Events and completed guides count even when the checklist isn't on screen, and progress follows the user across devices if your app [identifies](identify) them.

## Example

| Item | When clicked | Done when |
| --- | --- | --- |
| Take the welcome tour | Start a guide: *Welcome tour* | A guide is completed: *Welcome tour* |
| Create your first project | Go to a page: `/projects/new` | An event is tracked: `project_created` |
| Invite a teammate | Go to a page: `/settings/team` | An event is tracked: `teammate_invited` |

## Finishing and dismissing

- When every item is done, the checklist counts as **completed**.
- **Dismiss checklist** at the bottom of the panel hides it and counts as **dismissed**.
- With the default **Show again** setting, a completed or dismissed checklist doesn't come back on later visits. See [Targeting and timing](targeting#how-often).

Checklists always appear automatically when their targeting matches; they can't be set to manual.
