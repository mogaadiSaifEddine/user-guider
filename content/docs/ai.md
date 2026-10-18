# Draft guides with AI

AI can read a page of your app, decide which features are worth pointing out, and write a first draft of a **product tour** or a set of **hotspots**, attached to the real buttons and menus on that page. You review and edit the draft before anything is saved or published.

This feature appears only if the server has a Gemini API key; see [Deploy](self-hosting#environment-variables).

## From the dashboard

1. Open a tour or hotspot guide.
2. In the **Visual builder** box, enter the page address and tick **✨ Let AI draft the steps on that page**.
3. Optionally describe a **goal**, e.g. *Show new users how to create and publish a tour*. Without a goal, the AI covers what a new user of that page needs most.
4. Choose **Open builder and draft with AI**. Your app opens with the builder, and after a moment the drafted steps appear in the panel.

This replaces the guide's current steps in the builder. Nothing is saved until you choose **Save**, and **Exit** without saving keeps the old version.

## From the builder

With the builder already open, choose **✨ Draft steps with AI** (or *hotspots*) at the top of the panel:

| Field | Meaning |
| --- | --- |
| **Goal** | Optional. What the guide should achieve. The more specific, the better the selection. |
| **How many** | The maximum number of steps or hotspots. The AI may use fewer on a simple page. |
| **Existing steps** | *Replace them*, or *Keep, add more*. With *add more*, the AI is told what the guide already covers so it doesn't repeat it. |

Choose **Generate**. It usually takes a few seconds.

Open the right page, menu or tab first: the AI only sees what's on screen in that moment. For a multi-page tour, draft one page, save, navigate to the next page in the same tab, and draft again with *Keep, add more*.

## Review the draft

Treat it as a first draft:

- **Preview** the tour and check that each step points at the right element.
- Rewrite the text in your product's voice; the AI only knows what's visible on the page, not your business.
- Delete steps you don't need, reorder, and set *Advance on: Click on element* where users should really click.
- Then **Save**, and **Publish** in the dashboard.

## What the AI does and doesn't do

- For a tour, it may start with a centered welcome step; every other step is attached to an element on the page. Hotspots are always attached to elements.
- It can only choose elements that are actually on the page; it can't invent selectors. Selectors come from the same logic as picking by hand, so the [selector tips](builder#making-selectors-stable) apply.
- It's told to avoid destructive actions (delete, log out), individual data rows, and unlabeled icons.
- It writes in the page's language (the `lang` of the page, or the browser's language).
- It doesn't create checklists or announcements.

## What is sent to the AI

When you choose **Generate**, the builder collects from the current page:

- the page address, title, language and description;
- the visible headings (h1–h3);
- each visible button, link, tab, menu item and form field: its type, its label text (button text, `aria-label`, `title`, placeholder), the page region it's in (header, navigation, main…), its position and size, and any `data-onboarding` tag.

It does **not** send what anyone has typed into fields, the page's HTML, screenshots, cookies, or anything about your app's end users. The snapshot goes to the Locatify Guides server, which forwards it to Google's Gemini API to get the draft. Only authors with builder access can trigger it.
