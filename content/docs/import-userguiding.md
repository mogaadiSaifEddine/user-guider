# Import from UserGuiding

Moving from UserGuiding? Import your guides and checklists instead of rebuilding them. UserGuiding has no export button, so the importer reads the same published data that UserGuiding's own script loads on your site. Your UserGuiding account isn't changed.

## Run an import

1. Go to **Guides → Import from UserGuiding**.
2. Enter your **container id**. It's the last value in your UserGuiding snippet:

   ```js
   })(window, document, "script", "userGuiding", "userGuidingLayer", "9KR96062DT9ID");
   ```

   You can also paste the whole snippet, or the address of its `user-guiding-…-embedded.js` script.
3. Choose **Load guides**. You get a list of every guide and checklist with its number of steps, whether it starts automatically, and anything that needs checking.
4. Untick what you don't want. Guides with the same name as one already in this workspace are unticked and marked **already here**.
5. Pick the options (below) and choose **Import**.

Imported guides are **drafts**. Open each one, preview it, fix what the import flagged, then publish. If the [visual builder](builder) shows an amber dot on a step, re-pick its element.

## Options

| Option | What it does |
| --- | --- |
| **Copy images to User Onboarder** | Downloads every image used in the selected guides and stores it here. Recommended: images hosted by UserGuiding may stop loading when you cancel your subscription. Images over 5 MB or in unsupported formats keep their UserGuiding address. |
| **Match any domain in page rules** | Drops the domain from page rules, so a rule recorded on `https://cms.example.com/#/projects` also matches `http://localhost:8080/#/projects` and test servers. |
| **Import theme** | Replaces this workspace's primary color, text and background colors, corner radius and font with your UserGuiding theme. |
| **Publish guides that are active in UserGuiding** | Publishes straight away. Leave it off while the UserGuiding snippet is still on your site, or people will see both. |

## What's imported

| UserGuiding | Becomes |
| --- | --- |
| Guide | [Product tour](tours) |
| Modal step | Modal step |
| Tooltip step | Tooltip step attached to the same element (the most stable of the selectors UserGuiding recorded) |
| Click-to-continue step | Tooltip with *Advance on: Click on element* |
| Text (headings, bold, italic, bullet and numbered lists, links) | Heading and Text [blocks](tours#blocks) |
| Image, video | Image and Video blocks |
| Buttons: next, previous, finish, start a guide | Buttons blocks with the same actions; "start a guide" points at the imported copy |
| Default Next/Back buttons, step width, backdrop | Navigation buttons, step size, *Dim the page* |
| Start URLs ("contains", "equals"; all or any) | [Page rules](targeting#pages); "all must match" becomes one combined rule |
| Trigger: automatic / other | Automatic / Only manually |
| Frequency: only once / always | Show again: never / every page load |
| Display priority | Priority |
| Checklist (assistant) | [Checklist](checklists): each item starts its guide and is ticked off when that guide is completed |
| Theme | Workspace theme (optional) |

## What isn't imported

These are listed as **things to check** on each guide, or under *Not imported* for the whole account:

- **User segments**: imported guides show to every identified user. Add [user rules](targeting#users) where needed.
- **Buttons that run JavaScript** (often used to open the Resource Center): they now finish the guide.
- **Translations**: only the default language is imported.
- **Scheduling**, **locked checklist order**, text colors and custom fonts inside steps.
- **Hotspots, banners, surveys, the Resource Center, product update posts and the knowledge base.**
- **Page rules of other types.** UserGuiding stores some rule types under codes we can't identify for sure. They're imported as "URL contains" and flagged.

## If the container id isn't found

The importer tries UserGuiding's US and EU servers. If neither has data for the id, check the snippet on your live site. If your network blocks the request, open `https://sdk.userguiding.com/sdk-<container id>.json` in a browser (or `eu-sdk.` for EU accounts), save the file, and use **upload a saved sdk-….json file** on the import page.
