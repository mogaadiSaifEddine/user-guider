# Hotspots

Hotspots are small pulsing dots placed on elements of your app. Clicking one shows a short hint. They draw attention without blocking anything, which makes them good for pointing out features to people who already know their way around.

## Create hotspots

**Guides → New guide → Hotspots.** One hotspot guide can hold up to 30 hotspots, typically all the hints for one page or feature.

Add them in the [visual builder](builder): **+ Add hotspot** immediately asks you to click the element, then you write the title and text.

| Setting | What it does |
| --- | --- |
| **Title** and **Text** | Content of the hint, with [formatting](tours#formatting-text). |
| **Element** | Required. The dot sits on the top-right corner of this element. |
| **Tooltip position** | Where the hint opens relative to the element. |

A hotspot guide can't be published while any hotspot is missing its element.

## How they behave

- A dot appears only while its element is visible on the page, and follows it as the page scrolls.
- Clicking the dot opens the hint. **Got it** or × closes it, and that dot never shows again for that user.
- When a user has opened every hotspot in the guide, the guide counts as **completed**.
- Hotspots can be on screen at the same time as a tour, announcement or checklist.
- Hotspots always appear automatically when their targeting matches; they can't be set to manual, and the delay setting doesn't apply.
