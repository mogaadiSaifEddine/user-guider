# Product updates

Product updates are your changelog. Each post tells users what you shipped: a new feature, an improvement, a fix. Published posts appear in two places:

- a **public updates page** at `/updates/<your-address>`, which you can link from your app, your website or your emails;
- a **What's new** section in your [resource center](resource-center). An unread badge on the launcher tells users when there's something new.

Coming from UserGuiding? [Import your posts](import-userguiding) along with your guides.

## Write an update

Open **Product updates** in the sidebar and press **New update**. The editor has:

- **Labels** such as *New*, *Improvement* or *Fix*. Readers filter the public page by label. You manage the labels in **Page settings**.
- **Cover image**: shown above the post and in the resource center. Wide images (2:1) work best. Upload one or paste an address.
- **Pin to the top**: keeps an important post above newer ones.
- **Title** and **Summary**: the summary is the one or two lines under the title in the resource center list.
- **Content** uses the same blocks as announcements: headings, text, images, videos, buttons and dividers. On the public page, buttons that open a link work. Buttons that start a guide only work inside your app, so the public page leaves them out.

The preview on the right shows the post as it looks on the public page.

## Publish and schedule

A new post is a **draft**: nobody sees it.

- **Publish** makes it live right away, on the page and in resource centers.
- **Schedule…** picks a date and time. The post stays hidden until then and goes live on its own. The list marks it *scheduled*.
- Once a post is published, you can change its **Publish date**. That date is the one readers see, so you can backdate a post you forgot to write. A date in the future schedules the post again.
- **Unpublish** turns the post back into a draft.

To handle several posts at once, tick their checkboxes in the list. The bar above the list can **Publish now** (drafts only), **Unpublish** (published and scheduled posts), **Pin**, **Unpin** and **Delete** them.

There's no separate live version: saving a published post changes it for readers right away.

## The public page

Open **Product updates → Page settings**:

| Setting | What it does |
| --- | --- |
| **Page is on** | Turns the public page on or off. While it's off, the page and its RSS feed return *not found*. |
| **Address** | The page's address, such as `/updates/acme`. Lowercase letters, numbers and dashes. Changing it breaks links you already shared. |
| **Title, Description** | The page header. |
| **Logo** | Shown at the top left. A transparent PNG about 40 px high works best. |
| **Link to your app** | A button in the header that takes readers back to your app. Leave it empty to hide the button. |
| **Reactions** | Lets readers react 😍 😐 😞 and leave a comment, both on the page and in the resource center. |
| **Labels** | Name, color and order of your labels. Removing a label takes it off every post. |

The page uses your workspace's primary color (Settings → Theme). It lists posts newest first, with pinned posts on top and 10 posts per page. Every post also has its own page, so you can link to one post. The page has an RSS feed at `/updates/<your-address>/rss.xml`.

## In your app: the What's new section

In a [resource center](resource-center), add a **What's new** section and choose how many posts it shows (3 by default). It lists the newest published posts, pinned ones first, with their labels and dates. People open a post inside the panel and can react there. When the public page is on, a *See all updates* link closes the section.

Posts a user hasn't seen yet count toward the **badge on the launcher**, together with unfinished checklist items, and show a *New* mark. Opening the panel clears the badge. The browser remembers which posts were seen (in `localStorage`), so the badge also appears for users who aren't identified.

Opening a post counts as a click in the resource center's analytics.

## Translations

With more than one language in Settings → Languages, the editor shows a tab per language, just as for [knowledge base articles](knowledge-base). Translate with **✨ Translate with AI**, or start from the English text. Readers see a post in their language when one exists, and in English otherwise:

- in the resource center, the language comes from the user's language, the same way as for guides (see [Languages and translation](localization));
- on the public page, it comes from the browser's languages. A language switcher in the header adds `?lang=` to the address.

Labels and the page header aren't translated.

## Reactions and comments

Each post's editor shows how readers reacted, with the share for each reaction and their comments. A reader can change or take back their reaction. In your app, a reaction belongs to the identified user (their id shows next to the comment) or to the browser for anonymous users. On the public page, a reaction belongs to the browser. With [identity verification](identity-verification) on, reactions from identified users need a valid hash, just like their other calls.

Reactions aren't verified votes: treat them as a signal, not as a count of unique people.
