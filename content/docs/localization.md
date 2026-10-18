# Languages and translation

Every guide, resource center and help article can be shown in your users' languages. You write in English; each other language is a translation of it. Whatever isn't translated shows in English, so a half-translated guide still works.

## Add your languages

In **Settings → Languages**, add each language your users speak: pick one from the list, or type a code such as `fr-CA` or `pt-BR`. English is always there as the source and the fallback.

Removing a language stops showing it, but its translations are kept; add it back and they return.

## Translate a guide

Open the guide and go to the **Translations** tab. Pick a language at the top. Every text of the guide is listed, grouped by step, item, question or section, with the English on the left and the translation on the right. Headings and body text use the same rich text editor as the Content tab; button labels and other short labels are plain inputs.

- **✨ Translate missing with AI** fills every empty text for that language. It keeps bold, links, lists and placeholders like `{n}` intact; a text where the AI lost formatting is left empty for you. Nothing is saved until you press **Save draft**. Tell the AI about your product (and its terms) in Settings → **About your product**.
- The filters show only **Missing** or **Outdated** texts. A translation is *outdated* when the English changed after it was translated. Users still see the old translation until you update it, or press **Still correct** if it is.
- Translations are part of the guide's draft: save, then **Publish changes** to put them live. When you publish, the message tells you which languages still have English texts in them.

Translations are attached to each step, block and button by id, not by position, so moving or reordering steps keeps them in place. Deleting a block deletes its translations.

## Which language a user sees

The snippet picks the first of these that matches one of your languages, and falls back to English:

1. A language you set: `data-locale="de"` on the script tag, or `LocatifyGuides.setLocale("de")` (for example when the user changes language in your app). See the [JavaScript API](javascript-api#setlocale-locale).
2. A `locale` or `language` attribute from `identify()`, e.g. `identify("42", { locale: "is" })`.
3. The page's `<html lang="…">`.
4. The browser's language, then the `Accept-Language` header.

Matching is forgiving: `de-AT` uses your German, `pt` uses `pt-BR` if that's what you have.

## Interface text

The widgets show a few words of their own around your content: *Close*, *Back*, *Skip*, *2 of 5*, the resource center's *Search*. These come translated for Icelandic, Danish, Norwegian, Swedish, Finnish, German, Dutch, French, Spanish, Portuguese, Italian and Polish. For any other language, or to change a word, open **Interface text** next to the language in Settings → Languages; **✨ Translate with AI** fills them in. Keep the placeholders `{n}`, `{total}` and `{q}`.

## Help articles

[Knowledge base](knowledge-base) articles are translated as whole articles, because each language can have its own images and structure. Open an article and pick a language at the top: translate it with AI, or start from a copy of the English text. Imports from Zendesk and Intercom bring their translations along.
