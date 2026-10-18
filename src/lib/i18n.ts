// Localization shared by the dashboard, the server and the SDK. No server-only
// imports.
//
// English is the source language: guide content is written in English and
// every other language is a translation of it. Whatever isn't translated
// shows in English.
//
// Guide translations live next to the content as
//   { [locale]: { [fieldKey]: { text, source } } }
// fieldKey is the path to a text field, with array items named by their id,
// so reordering steps or blocks keeps translations attached:
//   steps.k3j9x2.blocks.p0a8c1.text, items.a1b2c3.title, thankYou.heading
// source is the English text the translation was made from. When the English
// changes, the translation is still served but flagged as outdated.

export const DEFAULT_LOCALE = "en";

export type TranslationEntry = { text: string; source: string };
export type LocaleTranslations = Record<string, TranslationEntry>;
export type Translations = Record<string, LocaleTranslations>;

// ---------- Locales ----------

export const LANGUAGES: { code: string; name: string; native: string }[] = [
  { code: "en", name: "English", native: "English" },
  { code: "is", name: "Icelandic", native: "Íslenska" },
  { code: "da", name: "Danish", native: "Dansk" },
  { code: "nb", name: "Norwegian (Bokmål)", native: "Norsk bokmål" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "fi", name: "Finnish", native: "Suomi" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "fr", name: "French", native: "Français" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "es-419", name: "Spanish (Latin America)", native: "Español (Latinoamérica)" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "pt-BR", name: "Portuguese (Brazil)", native: "Português (Brasil)" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "cs", name: "Czech", native: "Čeština" },
  { code: "sk", name: "Slovak", native: "Slovenčina" },
  { code: "hu", name: "Hungarian", native: "Magyar" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "bg", name: "Bulgarian", native: "Български" },
  { code: "hr", name: "Croatian", native: "Hrvatski" },
  { code: "sl", name: "Slovenian", native: "Slovenščina" },
  { code: "sr", name: "Serbian", native: "Српски" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "et", name: "Estonian", native: "Eesti" },
  { code: "lv", name: "Latvian", native: "Latviešu" },
  { code: "lt", name: "Lithuanian", native: "Lietuvių" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "he", name: "Hebrew", native: "עברית" },
  { code: "fa", name: "Persian", native: "فارسی" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "zh-CN", name: "Chinese (Simplified)", native: "简体中文" },
  { code: "zh-TW", name: "Chinese (Traditional)", native: "繁體中文" },
];

// "pt_br" -> "pt-BR", "EN-us" -> "en-US", "zh-hant" -> "zh-Hant". Null if it isn't a language tag.
export function normalizeLocale(tag: unknown): string | null {
  if (typeof tag !== "string") return null;
  const parts = tag.trim().replace(/_/g, "-").split("-").filter(Boolean);
  if (!parts.length || !/^[a-z]{2,3}$/i.test(parts[0])) return null;
  const out = [parts[0].toLowerCase()];
  for (const p of parts.slice(1)) {
    if (!/^[a-z0-9]{2,8}$/i.test(p)) break;
    out.push(p.length === 2 ? p.toUpperCase() : p.length === 4 ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p);
  }
  return out.join("-").slice(0, 35);
}

const base = (tag: string) => tag.split("-")[0].toLowerCase();

// Best of `available` for a list of wanted tags in order of preference:
// exact match, then same language (de-AT -> de, pt -> pt-BR).
export function matchLocale(wanted: (string | null | undefined)[], available: string[]): string | null {
  const avail = available.map((a) => ({ tag: a, lower: a.toLowerCase(), base: base(a) }));
  for (const w of wanted) {
    const n = normalizeLocale(w);
    if (!n) continue;
    const lower = n.toLowerCase();
    const exact = avail.find((a) => a.lower === lower);
    if (exact) return exact.tag;
    const sameBase = avail.find((a) => a.lower === base(n)) ?? avail.find((a) => a.base === base(n));
    if (sameBase) return sameBase.tag;
  }
  return null;
}

// Workspace.languages -> every language served, English first.
export function workspaceLanguages(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.map(normalizeLocale).filter((x): x is string => Boolean(x)) : [];
  return [DEFAULT_LOCALE, ...new Set(list.filter((l) => l !== DEFAULT_LOCALE))];
}

export function languageName(tag: string, native = false) {
  const exact = LANGUAGES.find((l) => l.code.toLowerCase() === tag.toLowerCase());
  if (exact) return native ? exact.native : exact.name;
  const b = LANGUAGES.find((l) => l.code === base(tag));
  return b ? `${native ? b.native : b.name} (${tag})` : tag;
}

// ---------- Text fields of guide content ----------

// Field names that hold text people read. Everything else (urls, selectors,
// ids, event names, email addresses) is never translated.
const RICH_FIELDS = new Set(["text", "title", "description", "subtitle", "summary", "body", "heading", "overlay"]);
const PLAIN_FIELDS = new Set(["label", "alt", "placeholder", "nextLabel", "backLabel", "doneLabel", "submitLabel", "buttonLabel", "lowLabel", "highLabel"]);

const BLOCK_TYPES = new Set(["heading", "text", "image"]);

const GROUPS: Record<string, string> = {
  steps: "Step",
  items: "Item",
  hotspots: "Hotspot",
  questions: "Question",
  modules: "Section",
};

export type TextField = {
  key: string;
  text: string;
  // Written with the rich text editor (light markup) or a plain input.
  rich: boolean;
  // Where it is, for people: "Step 2", "General".
  group: string;
  // What it is: "Heading", "Button", "Next label".
  label: string;
};

const pretty = (k: string) => {
  const s = k.replace(/([A-Z])/g, " $1").toLowerCase();
  return s[0].toUpperCase() + s.slice(1);
};

// Every non-empty text field of a guide's (or article's) content, in reading order.
export function textFields(content: unknown): TextField[] {
  const out: TextField[] = [];
  const walk = (v: unknown, path: string[], group: string, owner: string | null) => {
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        const id = item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id : String(i);
        const g = path.length === 1 && GROUPS[path[0]] ? `${GROUPS[path[0]]} ${i + 1}` : group;
        walk(item, [...path, id], g, owner);
      });
      return;
    }
    if (!v || typeof v !== "object") return;
    const obj = v as Record<string, unknown>;
    const type = typeof obj.type === "string" ? obj.type : null;
    for (const [k, val] of Object.entries(obj)) {
      if (typeof val === "string") {
        const rich = RICH_FIELDS.has(k);
        if (!rich && !PLAIN_FIELDS.has(k)) continue;
        if (!val.trim()) continue;
        // Blocks: "Heading", "Text", "Image alt"; buttons: "Button".
        const label =
          owner === "button"
            ? "Button"
            : type && BLOCK_TYPES.has(type) && (k === "text" || k === "alt" || k === "overlay")
              ? pretty(type) + (k === "text" ? "" : ` ${k}`)
              : pretty(k);
        out.push({ key: [...path, k].join("."), text: val, rich, group, label });
      } else if (val && typeof val === "object") {
        walk(val, [...path, k], group, k === "buttons" ? "button" : owner === "button" ? "button" : null);
      }
    }
  };
  walk(content, [], "General", null);
  return out;
}

// Content with the translated texts swapped in; anything missing stays English.
export function applyTranslations<T>(content: T, map: LocaleTranslations | undefined): T {
  if (!map || !Object.keys(map).length) return content;
  const walk = (v: unknown, path: string[]): unknown => {
    if (Array.isArray(v)) {
      return v.map((item, i) => {
        const id = item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id : String(i);
        return walk(item, [...path, id]);
      });
    }
    if (!v || typeof v !== "object") return v;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "string") {
        const t = map[[...path, k].join(".")]?.text;
        out[k] = t && val.trim() && (RICH_FIELDS.has(k) || PLAIN_FIELDS.has(k)) ? t : val;
      } else {
        out[k] = walk(val, [...path, k]);
      }
    }
    return out;
  };
  return walk(content, []) as T;
}

export type LocaleStatus = { total: number; translated: number; outdated: number; missing: number };

export function translationStatus(fields: TextField[], map: LocaleTranslations | undefined): LocaleStatus {
  let translated = 0;
  let outdated = 0;
  for (const f of fields) {
    const e = map?.[f.key];
    if (!e?.text.trim()) continue;
    translated++;
    if (e.source !== f.text) outdated++;
  }
  return { total: fields.length, translated, outdated, missing: fields.length - translated };
}

// Drops entries for fields that no longer exist, empty ones, and languages that are switched off.
export function pruneTranslations(content: unknown, all: Translations | null | undefined, languages?: string[]): Translations {
  const keys = new Set(textFields(content).map((f) => f.key));
  const out: Translations = {};
  for (const [locale, map] of Object.entries(all ?? {})) {
    if (locale === DEFAULT_LOCALE || (languages && !languages.includes(locale))) continue;
    const kept: LocaleTranslations = {};
    for (const [k, e] of Object.entries(map ?? {})) if (keys.has(k) && e?.text?.trim()) kept[k] = { text: e.text, source: e.source ?? "" };
    if (Object.keys(kept).length) out[locale] = kept;
  }
  return out;
}

// Short stable hash of the text of some content, to tell whether a whole
// translated article still matches its English version.
export function textHash(content: unknown) {
  const s = textFields(content)
    .map((f) => f.text)
    .join("\u0000");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
