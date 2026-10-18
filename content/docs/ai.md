# Draft guides with AI

AI can read a page of your app, decide which features are worth pointing out, and write a first draft of a **product tour** or a set of **hotspots**, attached to the real buttons and menus on that page. You review and edit the draft before anything is saved or published.

This feature appears only if the server has a Gemini API key; see [Deploy](self-hosting#environment-variables).

## Get better drafts

- **Describe your product once.** In **Settings → About your product (for AI drafting)**, write a few sentences on what your app does, who uses it and the words they use (e.g. what a "project" or "pin" is). The AI reads it before every draft. This makes the biggest difference for specialised products.
- **Give a goal.** "Show a first-time editor how to add a pin with audio" produces a focused workflow. Without a goal, the AI covers what a new user of the page needs most.
- **Open the right state first.** The AI sees what's on screen: open the tab, menu or dialog you want to explain before choosing **Generate**.
- **Make sure buttons have names.** Icon-only buttons with no `aria-label` or tooltip are hard to explain. Adding labels also helps people using screen readers.

## From the dashboard

1. Open a tour or hotspot guide.
2. On the **Visual builder** tab, enter the page address and tick **✨ Let AI draft the steps on that page**.
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
- Rewrite the text in your product's voice; the AI only knows what's on the page and in your product description.
- Delete steps you don't need, reorder, and set *Advance on: Click on element* where users should really click.
- Then **Save**, and **Publish** in the dashboard.

## How it decides

The AI first works out what the page is for and the main task on it, then picks the few elements that matter most for that task, and only then writes. It's told to skip:

- the link to the page you're on, and generic navigation (unless the goal is orientation);
- obvious controls (Save, Cancel, Close) unless they behave unusually;
- disabled elements, and destructive or exit actions (delete, archive, unpublish, sign out); these are also filtered out after the AI answers;
- individual records in lists and tables (only the first row of a repeated list is offered at all).

## What the AI does and doesn't do

- For a tour, it may start with a centered welcome step; every other step is attached to an element on the page. Hotspots are always attached to elements.
- It can only choose elements that are actually on the page; it can't invent selectors. Selectors come from the same logic as picking by hand, so the [selector tips](builder#making-selectors-stable) apply.
- It's told to avoid destructive actions (delete, log out), individual data rows, and unlabeled icons.
- It writes in the page's language (the `lang` of the page, or the browser's language).
- It doesn't create checklists or announcements.

## What is sent to the AI

When you choose **Generate**, the builder collects from the current page:

- the page address, title, language and description;
- the headings (including bold titles that act as headings) and the page's visible text, up to about 2,500 characters;
- each visible button, link, tab, menu item and form field: its type, its label (button text, `aria-label`, `<label>`, `title` or tooltip, placeholder), the section and page region it's in, whether it's disabled or the current page's link, its position and size, and any `data-onboarding` tag;
- a **screenshot of the visible part of the page** with a numbered box on each element. Before it's taken, **every form field is painted over in grey**, so values typed into fields (including passwords and keys) never appear in it. The builder panel itself isn't included.

It does **not** send field values, the page's HTML, cookies, or anything about your app's end users. Visible page text and the screenshot can include data shown on the page (for example names in a list), so draft on pages with test or non-sensitive data when you can.

The snapshot goes to the Locatify Guides server, which forwards it with your product description to Google's Gemini API. Only authors with builder access can trigger it, and nothing is stored.
