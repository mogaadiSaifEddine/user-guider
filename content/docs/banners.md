# Banners

A banner is a strip across the top or bottom of the page: a trial that's ending, planned maintenance, an outage, a feature launch. Unlike a modal, it doesn't block anything. It has a slot of its own, so a tour or survey can run while a banner is on screen.

## Create a banner

**Guides → New guide → Announcement**, then set **Format** to *Banner*. Banners are announcements, so they share their editor, translations and analytics.

The banner shows the headings and text of the announcement on one line, followed by the buttons of its first **Buttons** block. Images and videos aren't shown in a banner.

## Banner settings

| Setting | What it does |
| --- | --- |
| **Position** | Top or bottom of the page. |
| **Layout** | *Over the page*: the banner covers the top (or bottom) of your page. *Push the page down*: the page gets extra padding the height of the banner, removed when it closes. Headers your app fixes to the top of the window aren't moved, so they may still overlap the banner. |
| **Tone** | *Brand color* (your theme's gradient), *Info* (blue), *Success* (green) or *Warning* (amber). |
| **Background** and **Text** | Optional colors that replace the tone's. Imported UserGuiding banners use these to keep their look. *Use the tone's* goes back. |
| **Link the text to** | Optional. Makes the banner text a link. Clicking it counts as **completed**. |
| **People can close it** | On by default. Turn it off for outages: the banner has no × and stays until one of its buttons finishes it, or its [schedule](targeting#schedule) ends. |

Banners don't close with Esc, because they don't take over the page.

## How banners behave

- **One at a time.** If several banners match a page, the one with the highest **Priority** shows; the next can show after it closes.
- **Next to tours.** Banners and tours, modal announcements and surveys don't wait for each other.
- **Pages.** A banner leaves when the user moves to a page its targeting doesn't match.
- **Buttons.** *Finish the guide* and *Open a link* count as **completed**, *Close* as **dismissed**, and *Start another guide* completes the banner and starts that guide.
- **Coming back.** **Show again** on the Targeting tab decides whether a closed or finished banner returns. For a banner that can't be closed, *Never, once seen through or dismissed* means it shows on every page load until a button finishes it.

## Scheduling

Set **From** and **Until** under **Schedule** on the Targeting tab to show a banner only during a maintenance window or a sale. See [Targeting and timing](targeting#schedule).
