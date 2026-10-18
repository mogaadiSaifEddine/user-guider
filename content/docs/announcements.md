# Announcements

Use announcements for news: a new feature, a price change, planned maintenance.

## Formats

| Format | Looks like | Closes when |
| --- | --- | --- |
| **Modal** | A card in the middle of the screen over a darkened page, with an optional header image | The user presses the button, ×, Esc, or clicks the dark area around it |
| **Banner** | A colored bar across the top of the page | The user presses the button, × or Esc |

The banner sits on top of your page's own header while it's open.

## Settings

| Setting | What it does |
| --- | --- |
| **Title** | Bold heading. In a banner it's shown in bold before the text. |
| **Text** | The message. Supports **\*\*bold\*\***, *\*italic\**, `[links](https://…)` and line breaks. |
| **Image URL** | Modal only. An `https://` image shown across the top of the card. |
| **Button text** | Label of the main button. Leave empty for no button (users close it with ×). |
| **Button link** | Optional. The button opens this address in a new tab. |

Pressing the button counts as **completed**; closing it any other way counts as **dismissed**.

## Showing an announcement once vs. until acknowledged

On the **Targeting** tab, under **Show again**:

- *Never, once seen through or dismissed*: shown once per user.
- *On later visits until completed*: comes back on later page loads until the user presses the button. Good for things people must acknowledge.

See [Targeting and timing](targeting).

Like tours, an announcement waits its turn when a tour is already on screen, and can be started from a checklist or with `LocatifyGuides.start()` if its trigger is *Only manually*.
