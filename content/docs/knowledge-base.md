# Knowledge base

The knowledge base holds your help articles. People read them inside the [resource center](resource-center), in their own language, and can search their full text. Write articles here, or import your existing help center from Zendesk or Intercom.

## Articles and collections

Open **Knowledge base** in the sidebar.

- **New article** opens the editor: a title, a one-line summary (shown in lists and searched), and the content, built from the same blocks as announcements: headings, text, images, videos, buttons, dividers. An article can have up to 400 blocks.
- **Collections** group articles, like *Billing* or *Getting started*. Create, rename, translate and order them in the Collections box; pick an article's collection in its editor. Deleting a collection keeps its articles, without a collection.
- An article is a **draft** until you press **Publish**. Only published articles show in resource centers, and changes to a published article show right away: there's no separate live version, so save drafts of big rewrites as a new article.

Search at the top of the list looks through titles and text in every language.

## Translations

With more than one language in Settings → Languages, the article editor shows a tab per language. Each translation is a full copy of the article: translate it with **✨ Translate with AI**, or press **Start from the English text** and translate by hand. The dot on each tab is green when translated, amber when the English changed since, and grey when missing. A missing translation shows the English article. See [Languages and translation](localization).

## Show articles in the resource center

In a resource center, add a **Knowledge base** section. Leave *All collections* ticked, or pick the collections it should show. With several collections, people browse by collection; with one, they see its articles straight away. The panel's search box searches the full text of every article in the section, in any language, and shows matches in the user's language.

Articles load when someone opens the panel, so a large knowledge base doesn't slow down your pages. Opening an article counts as a click in the resource center's analytics.

## Import from Zendesk or Intercom

**Knowledge base → Import from Zendesk or Intercom.**

**Zendesk Guide**: enter your subdomain (`acme`), `acme.zendesk.com`, or your help center's own domain. Public help centers need nothing else. For a help center that requires sign-in, or to bring over drafts, open *Add an API token* and enter an agent's email and an API token (Admin Center → Apps and integrations → Zendesk API). Zendesk *sections* become collections; with several categories they're named *Category › Section*.

**Intercom Articles**: enter an access token from the Intercom Developer Hub (your app → Authentication) and the region your workspace is hosted in. Collections become collections; nested ones are named *Parent › Child*.

Then choose whether published articles go live right away or every new article starts as a draft.

What comes over:

- The English version of each article becomes the article. Every language your workspace also uses comes over as a translation. Languages the source has that your workspace doesn't are listed after the import; add them in Settings and import again to get them.
- Headings, paragraphs, bold, italic, links, lists, images, YouTube and Vimeo videos and dividers convert directly. Screenshots inside numbered steps stay between the steps. Tables become lines of text, code blocks become plain text, and other embeds become links. The import report lists the articles where that happened, so you can check them.
- Images keep loading from Zendesk or Intercom. If your help center requires sign-in, its images won't load for your users; re-upload them in the editor.
- Credentials are used for the import only and aren't stored.

Importing again updates the same articles and collections instead of duplicating them, and **overwrites edits you made to imported articles** (and their imported translations). Translations you added here in other languages are kept. Articles you deleted come back.
