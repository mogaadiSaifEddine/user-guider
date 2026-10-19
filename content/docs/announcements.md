# Announcements

Use announcements for news: a new feature, a price change, planned maintenance.

## Formats

| Format | Looks like | Closes when |
| --- | --- | --- |
| **Modal** | A card in the middle of the screen over a darkened page, with an optional header image | The user presses the button, ×, Esc, or clicks the dark area around it |
| **Banner** | A colored bar across the top of the page | The user presses the button, × or Esc |

The banner sits on top of your page's own header while it's open.

## Content

An announcement is built from the same [blocks](tours#blocks) as a tour step: heading, text, image (upload or link), video, buttons, divider and spacer. **Start from a template** offers the modal templates (*Welcome*, *Hero*, *Video*, *New feature*…). The preview on the right shows the result in your theme.

- **Size** (modals only): small, medium or large (380 / 460 / 640 px wide).
- **Buttons**: *Finish the guide* counts as **completed**. *Close* counts as **dismissed**. *Open a link* opens the address and counts as completed. *Start another guide* completes the announcement and starts a tour.
- **Banners** show their headings and text on one line, followed by the buttons of the first Buttons block. Images and videos aren't shown in a banner.

Closing with ×, Esc or a click outside a modal counts as **dismissed**.

Announcements created before blocks existed are converted automatically the first time you open them.

## Showing an announcement once vs. until acknowledged

On the **Targeting** tab, under **Show again**:

- *Never, once seen through or dismissed*: shown once per user.
- *On later visits until completed*: comes back on later page loads until the user presses the button. Good for things people must acknowledge.

See [Targeting and timing](targeting).

Like tours, an announcement waits its turn when a tour is already on screen, and can be started from a checklist or with `UserOnboarder.start()` if its trigger is *Only manually*.
