# Hotspots

Hotspots are small markers placed on elements of your app. Opening one shows a short hint. They draw attention without blocking anything, which makes them good for pointing out features to people who already know their way around, or for a "?" next to a field that people come back to.

## Create hotspots

**Guides → New guide → Hotspots.** One hotspot guide can hold up to 30 hotspots, typically all the hints for one page or feature.

Add them in the [visual builder](builder): **+ Add hotspot** immediately asks you to click the element, then you write the title and text. Everything else is on the **Content** tab of the dashboard.

| Setting | What it does |
| --- | --- |
| **Content** | The same [blocks](tours#blocks) as tours: headings, text, images, video, audio and buttons. |
| **Element** | Required. The marker sits on this element. |
| **Looks like** | *Pulsing beacon* (a pulsing dot) or *Icon* (a still **?** or **i**). |
| **Sits on** | Which corner of the element the marker is on, or just to its right or left. |
| **Opens on** | *Click*, or *Hover* (touch screens open it with a tap). |
| **Tooltip position** and **size** | Where the hint opens relative to the element, and how wide it is. |
| **Keep it after it's opened** | A persistent hotspot stays on the page for good: help people come back to. |

A hotspot guide can't be published while any hotspot is missing its element.

### Buttons in a hint

Add a **Buttons** block to give a hint its own buttons. *Start another guide* opens a tour from the hint: a persistent "?" with a **Show me** button that starts a tour is a good pattern. *Open a link* opens an address. *Finish the guide* and *Close* close the hint.

## How they behave

- A marker appears only while its element is visible on the page, and follows it as the page scrolls.
- **One-off hotspots** (the default): the hint has a **Got it** button, unless you added buttons of your own. **Got it**, × or one of the hint's buttons closes it, and that hotspot never shows again for that user. Clicking elsewhere or Esc closes the hint without that.
- **Persistent hotspots** never go away. Opening one is counted once per user.
- When a user has opened every hotspot in the guide, the guide counts as **completed**.
- Hotspots can be on screen at the same time as a tour, announcement, banner or checklist.
- Hotspots always appear automatically when their targeting matches; they can't be set to manual, and the delay setting doesn't apply.
- **Got it** is translated like the rest of the interface text: built in for many languages, and editable under **Settings → Languages**. See [Languages and translation](localization).

Hotspots made before content blocks existed (title and text only) are converted automatically, and keep their translations.
