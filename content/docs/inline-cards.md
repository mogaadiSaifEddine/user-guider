# Inline cards

An inline card is content placed inside your page rather than floating above it: an empty state ("No info points yet: watch how"), a tip at the top of a list, a short video next to a form. It scrolls with the page like the rest of your content.

## Create an inline card

**Guides → New guide → Inline card.** A new card starts with a heading, a line of text and a button.

1. Pick the element the card goes next to. Open the **Visual builder** tab and click it on your site, or type a CSS selector under **Element**.
2. Choose where the card goes under **Place the card**.
3. Write the content with the same [blocks](tours#blocks) as tours: headings, text, images, video, audio, buttons.

| Place the card | Result |
| --- | --- |
| **Above the element** | Right before it, as a sibling. |
| **Below the element** | Right after it. |
| **Inside it, at the top** / **at the bottom** | As the element's first or last child. Use this for an empty list or container. |
| **Instead of the element** | The element is hidden while the card shows, and comes back when the card is closed or finished. |

**People can close it** adds a × to the card. Closing counts as **dismissed**.

Buttons work like in announcements: *Finish the guide* removes the card and counts it as **completed**, *Start another guide* completes it and starts a tour, *Open a link* opens the address and keeps the card, *Close* dismisses it.

An inline card can't be published without an element and some content.

## How inline cards behave

- **Several at once.** Inline cards don't take turns with each other or with tours, banners and checklists. Each one appears as soon as its element is on a matching page.
- **Re-rendering apps.** Frameworks like Angular and React often rebuild part of the page. When that removes the card, or replaces the element it's attached to, the card is put back within a frame.
- **Element not there yet.** The card appears when the element shows up, for example after a list finishes loading.
- **Your page's styles don't reach it.** The card is drawn in your workspace theme and isn't affected by your app's CSS (and doesn't affect it). It takes the full width of the place it's put in.
- **Coming back.** Like hotspots, an inline card shows whenever its targeting matches until it's completed or dismissed; **Show again** decides what happens after that.
- Inline cards always appear automatically; they can't be started with `start()`.

## Tips

- Put empty-state cards *inside* the empty container (**Inside it, at the top**), so the card disappears with the empty state when your app renders the first item.
- A short [video](tours#blocks) plus a *Start another guide* button that opens a tour works well: people watch, then try it themselves.
