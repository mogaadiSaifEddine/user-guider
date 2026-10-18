import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { htmlToBlocks, htmlToText } from "./html-blocks";
import { DEFAULT_LOCALE, matchLocale, normalizeLocale, workspaceLanguages } from "./i18n";
import {
  kbHash,
  parseCollectionTranslations,
  parseKbTranslations,
  searchTextOf,
  type KbCollectionTranslations,
  type KbContent,
  type KbTranslations,
} from "./kb";

// Imports help center articles from Zendesk or Intercom into the knowledge
// base. Both are read into one shape first, then upserted by their id there,
// so importing again updates instead of duplicating.
//
// Zendesk: categories → sections → articles; sections become collections.
//   Public help centers need no credentials; an API token adds drafts and
//   restricted articles. Each language is listed separately.
// Intercom: collections → articles, every language inside the article's
//   translated_content. Always needs an access token.
//
// The English version becomes the article; other languages become
// translations when the workspace has that language. Images stay on the
// source's servers.

export type ImportSource =
  | { kind: "zendesk"; url: string; email?: string; token?: string }
  | { kind: "intercom"; token: string; region: "us" | "eu" | "au" };

export type ImportOptions = {
  // source: published there = published here. draft: new articles start as drafts.
  status: "source" | "draft";
};

export type ImportReport = {
  collections: { created: number; updated: number };
  articles: { created: number; updated: number };
  translations: number;
  // Languages the source has but this workspace doesn't use.
  skippedLocales: string[];
  sourceLocale: string;
  warnings: { title: string; issues: string[] }[];
};

export class ImportError extends Error {}

type ExtCollection = {
  externalId: string;
  name: string;
  description: string;
  position: number;
  translations: Record<string, { name: string; description: string }>;
};

type ExtArticle = {
  externalId: string;
  collectionExternalId: string | null;
  title: string;
  html: string;
  summary: string;
  published: boolean;
  url: string;
  position: number;
  translations: Record<string, { title: string; html: string; summary: string }>;
};

type Extracted = { sourceLocale: string; collections: ExtCollection[]; articles: ExtArticle[]; skippedLocales: string[] };

// ---------- HTTP ----------

async function getJson(url: string, headers: Record<string, string>, what: string) {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json", ...headers }, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new ImportError(`Couldn't reach ${what}. Check the address.`);
  }
  if (res.status === 401 || res.status === 403)
    throw new ImportError(`${what} refused access (${res.status}). Check the credentials, or that the help center is public.`);
  if (res.status === 404) throw new ImportError(`${what} has no help center at that address (404).`);
  if (res.status === 429) throw new ImportError(`${what} is rate limiting us. Wait a minute and try again.`);
  if (!res.ok) throw new ImportError(`${what} answered ${res.status}.`);
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    throw new ImportError(`${what} didn't answer with JSON. Is that the help center address?`);
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

function summarize(html: string) {
  const text = htmlToText(html);
  if (text.length <= 160) return text;
  const cut = text.slice(0, 157);
  return cut.slice(0, cut.lastIndexOf(" ") > 100 ? cut.lastIndexOf(" ") : 157) + "…";
}

// Which source locales to bring in: the English one (or the default) as the
// article, the rest as translations for the workspace's languages.
function planLocales(sourceLocales: string[], defaultLocale: string, workspaceLangs: string[]) {
  const english = sourceLocales.filter((l) => l.toLowerCase().startsWith("en"));
  const source = english.find((l) => l.toLowerCase() === defaultLocale.toLowerCase()) ?? english[0] ?? defaultLocale;
  const targets = new Map<string, string>(); // source locale -> workspace language
  const skipped: string[] = [];
  for (const l of sourceLocales) {
    if (l.toLowerCase() === source.toLowerCase()) continue;
    if (l.toLowerCase().startsWith("en")) continue;
    const ws = matchLocale([l], workspaceLangs.filter((x) => x !== DEFAULT_LOCALE));
    // Two source locales for one language (pt and pt-br): the closer one wins.
    if (ws && ![...targets.values()].includes(ws)) targets.set(l, ws);
    else if (!ws) skipped.push(normalizeLocale(l) ?? l);
  }
  return { source, targets, skipped };
}

// ---------- Zendesk ----------

function zendeskBase(input: string) {
  const v = input.trim().replace(/\/+$/, "");
  if (!v) throw new ImportError("Enter your Zendesk subdomain or help center address.");
  if (/^[a-z0-9-]+$/i.test(v)) return `https://${v}.zendesk.com`;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.origin;
  } catch {
    throw new ImportError("That doesn't look like a Zendesk address.");
  }
}

async function zendeskList(base: string, path: string, key: string, headers: Record<string, string>) {
  const out: Record<string, unknown>[] = [];
  let url: string | null = `${base}${path}${path.includes("?") ? "&" : "?"}page[size]=100`;
  for (let page = 0; url && page < 200; page++) {
    const data = await getJson(url, headers, "Zendesk");
    out.push(...((data[key] as Record<string, unknown>[]) ?? []));
    const meta = data.meta as { has_more?: boolean } | undefined;
    const links = data.links as { next?: string } | undefined;
    url = meta?.has_more && links?.next ? links.next : typeof data.next_page === "string" ? data.next_page : null;
  }
  return out;
}

async function extractZendesk(src: Extract<ImportSource, { kind: "zendesk" }>, workspaceLangs: string[]): Promise<Extracted> {
  const base = zendeskBase(src.url);
  const headers: Record<string, string> = {};
  if (src.email?.trim() && src.token?.trim())
    headers.Authorization = "Basic " + Buffer.from(`${src.email.trim()}/token:${src.token.trim()}`).toString("base64");

  // Enabled help center languages; older or locked-down accounts may not answer.
  let locales: string[] = [];
  let defaultLocale = "";
  try {
    const data = await getJson(`${base}/api/v2/help_center/locales.json`, headers, "Zendesk");
    locales = ((data.locales as unknown[]) ?? []).map((l) => (typeof l === "string" ? l : str((l as { locale?: unknown }).locale))).filter(Boolean);
    defaultLocale = str(data.default_locale);
  } catch (e) {
    if (e instanceof ImportError && /refused|404|reach/.test(e.message)) {
      // Fall through: the article list says which locale it's in.
    } else throw e;
  }
  if (!locales.length) {
    const first = await getJson(`${base}/api/v2/help_center/articles.json?per_page=1`, headers, "Zendesk");
    const l = str((first.articles as Record<string, unknown>[] | undefined)?.[0]?.locale) || "en-us";
    locales = [l];
    defaultLocale = l;
  }
  const plan = planLocales(locales, defaultLocale || locales[0], workspaceLangs);

  const load = async (locale: string) => {
    const [categories, sections, articles] = await Promise.all([
      zendeskList(base, `/api/v2/help_center/${locale}/categories.json`, "categories", headers),
      zendeskList(base, `/api/v2/help_center/${locale}/sections.json`, "sections", headers),
      zendeskList(base, `/api/v2/help_center/${locale}/articles.json?sort_by=position&sort_order=asc`, "articles", headers),
    ]);
    // Only content really written in that language (not a fallback copy).
    const own = <T extends Record<string, unknown>>(list: T[]) => list.filter((x) => !x.locale || str(x.locale).toLowerCase() === locale.toLowerCase());
    return { categories: own(categories), sections: own(sections), articles: own(articles) };
  };

  const main = await load(plan.source);
  const categoryName = new Map(main.categories.map((c) => [str(c.id), str(c.name)]));
  const multiCategory = main.categories.length > 1;
  const collections: ExtCollection[] = main.sections.map((s) => ({
    externalId: str(s.id),
    name: (multiCategory && categoryName.get(str(s.category_id)) ? `${categoryName.get(str(s.category_id))} › ${str(s.name)}` : str(s.name)).slice(0, 191),
    description: str(s.description),
    position: num(s.position),
    translations: {},
  }));
  const articles: ExtArticle[] = main.articles.map((a) => ({
    externalId: str(a.id),
    collectionExternalId: a.section_id ? str(a.section_id) : null,
    title: str(a.title),
    html: str(a.body),
    summary: summarize(str(a.body)),
    published: !a.draft,
    url: str(a.html_url),
    position: num(a.position),
    translations: {},
  }));

  for (const [zLocale, wsLocale] of plan.targets) {
    const t = await load(zLocale);
    const catNames = new Map(t.categories.map((c) => [str(c.id), str(c.name)]));
    const sectionsById = new Map(t.sections.map((s) => [str(s.id), s]));
    for (const c of collections) {
      const s = sectionsById.get(c.externalId);
      if (!s) continue;
      const cat = catNames.get(str(s.category_id));
      c.translations[wsLocale] = { name: multiCategory && cat ? `${cat} › ${str(s.name)}` : str(s.name), description: str(s.description) };
    }
    const byId = new Map(t.articles.map((a) => [str(a.id), a]));
    for (const a of articles) {
      const ta = byId.get(a.externalId);
      if (ta && !ta.draft && str(ta.title).trim()) a.translations[wsLocale] = { title: str(ta.title), html: str(ta.body), summary: summarize(str(ta.body)) };
    }
  }
  return { sourceLocale: plan.source, collections, articles, skippedLocales: plan.skipped };
}

// ---------- Intercom ----------

const INTERCOM_HOSTS = { us: "https://api.intercom.io", eu: "https://api.eu.intercom.io", au: "https://api.au.intercom.io" };

async function intercomList(base: string, path: string, headers: Record<string, string>) {
  const out: Record<string, unknown>[] = [];
  let url: string | null = `${base}${path}?per_page=50`;
  for (let page = 0; url && page < 400; page++) {
    const data = await getJson(url, headers, "Intercom");
    out.push(...((data.data as Record<string, unknown>[]) ?? []));
    const pages = data.pages as { next?: unknown; page?: number; total_pages?: number } | undefined;
    const next = pages?.next;
    if (typeof next === "string") url = next.startsWith("http") ? next : `${base}${next}`;
    else if (next && typeof next === "object" && (next as { starting_after?: string }).starting_after)
      url = `${base}${path}?per_page=50&starting_after=${encodeURIComponent((next as { starting_after: string }).starting_after)}`;
    else if (pages?.page && pages.total_pages && pages.page < pages.total_pages) url = `${base}${path}?per_page=50&page=${pages.page + 1}`;
    else url = null;
  }
  return out;
}

type Translated = Record<string, Record<string, unknown> | string | undefined>;

async function extractIntercom(src: Extract<ImportSource, { kind: "intercom" }>, workspaceLangs: string[]): Promise<Extracted> {
  if (!src.token.trim()) throw new ImportError("Enter an Intercom access token.");
  const base = INTERCOM_HOSTS[src.region] ?? INTERCOM_HOSTS.us;
  const headers = { Authorization: `Bearer ${src.token.trim()}`, "Intercom-Version": "2.11" };
  const [rawCollections, rawArticles] = await Promise.all([
    intercomList(base, "/help_center/collections", headers),
    intercomList(base, "/articles", headers),
  ]);

  // Every locale that appears anywhere.
  const localesOf = (tc: unknown) => (tc && typeof tc === "object" ? Object.keys(tc).filter((k) => k !== "type") : []);
  const seen = new Set<string>();
  let defaultLocale = "";
  for (const x of [...rawCollections, ...rawArticles]) {
    for (const l of localesOf(x.translated_content)) seen.add(l);
    if (!defaultLocale && x.default_locale) defaultLocale = str(x.default_locale);
  }
  defaultLocale ||= "en";
  seen.add(defaultLocale);
  const plan = planLocales([...seen], defaultLocale, workspaceLangs);

  // Prefer the English translation as the article; fall back to the top-level fields (the default language).
  const inLocale = (x: Record<string, unknown>, locale: string) => {
    const tc = x.translated_content as Translated | null | undefined;
    const t = tc?.[locale];
    return t && typeof t === "object" ? t : null;
  };

  const byId = new Map(rawCollections.map((c) => [str(c.id), c]));
  const depth = (id: string) => {
    let d = 0;
    for (let c = byId.get(id); c?.parent_id && d < 10; c = byId.get(str(c.parent_id))) d++;
    return d;
  };
  const nameOf = (c: Record<string, unknown>, locale: string | null) => {
    const own = (x: Record<string, unknown>) => str((locale ? inLocale(x, locale)?.name : null) ?? x.name);
    const parent = c.parent_id ? byId.get(str(c.parent_id)) : undefined;
    return (parent ? `${own(parent)} › ${own(c)}` : own(c)).slice(0, 191);
  };

  const collections: ExtCollection[] = rawCollections.map((c) => {
    const src0 = inLocale(c, plan.source);
    const translations: ExtCollection["translations"] = {};
    for (const [iLocale, wsLocale] of plan.targets) {
      const t = inLocale(c, iLocale);
      if (t && str(t.name).trim()) translations[wsLocale] = { name: nameOf(c, iLocale), description: str(t.description) };
    }
    return {
      externalId: str(c.id),
      name: src0 ? nameOf(c, plan.source) : nameOf(c, null),
      description: str(src0?.description ?? c.description),
      position: num(c.order),
      translations,
    };
  });

  const articles: ExtArticle[] = rawArticles.map((a) => {
    const main = inLocale(a, plan.source) ?? a;
    // The most specific collection the article sits in.
    const parents = [a.parent_id, ...(Array.isArray(a.parent_ids) ? a.parent_ids : [])].map(str).filter((id) => byId.has(id));
    const collection = parents.sort((x, y) => depth(y) - depth(x))[0] ?? null;
    const translations: ExtArticle["translations"] = {};
    for (const [iLocale, wsLocale] of plan.targets) {
      const t = inLocale(a, iLocale);
      if (t && str(t.title).trim() && str(t.body).trim() && str(t.state) !== "draft")
        translations[wsLocale] = { title: str(t.title), html: str(t.body), summary: str(t.description) || summarize(str(t.body)) };
    }
    return {
      externalId: str(a.id),
      collectionExternalId: collection,
      title: str(main.title),
      html: str(main.body),
      summary: str(main.description) || summarize(str(main.body)),
      published: str(main.state ?? a.state) === "published",
      url: str(main.url ?? a.url),
      position: 0,
      translations,
    };
  });
  return { sourceLocale: plan.source, collections, articles, skippedLocales: plan.skipped };
}

// Reads everything from the source without saving (also handy for checking a source by hand).
export function extractSource(src: ImportSource, workspaceLangs: string[]) {
  return src.kind === "zendesk" ? extractZendesk(src, workspaceLangs) : extractIntercom(src, workspaceLangs);
}

// ---------- Save ----------

const escapeMarkup = (s: string) => s.replace(/[\\*_~+[\]]/g, "\\$&");

export async function importKnowledgeBase(workspaceId: string, src: ImportSource, opts: ImportOptions): Promise<ImportReport> {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { languages: true } });
  const langs = workspaceLanguages(workspace.languages);
  const data = await extractSource(src, langs);
  const source = src.kind === "zendesk" ? "ZENDESK" : "INTERCOM";
  const sourceBase = src.kind === "zendesk" ? zendeskBase(src.url) : "";

  const report: ImportReport = {
    collections: { created: 0, updated: 0 },
    articles: { created: 0, updated: 0 },
    translations: 0,
    skippedLocales: data.skippedLocales,
    sourceLocale: data.sourceLocale,
    warnings: [],
  };

  // Collections
  const collectionIds = new Map<string, string>();
  for (const c of data.collections) {
    const existing = await prisma.kbCollection.findUnique({
      where: { workspaceId_source_externalId: { workspaceId, source, externalId: c.externalId } },
    });
    const translations: KbCollectionTranslations = { ...parseCollectionTranslations(existing?.translations), ...c.translations };
    const fields = { name: c.name || "Untitled collection", description: c.description || null, position: c.position, translations };
    const row = existing
      ? await prisma.kbCollection.update({ where: { id: existing.id }, data: fields })
      : await prisma.kbCollection.create({ data: { workspaceId, source, externalId: c.externalId, ...fields } });
    report.collections[existing ? "updated" : "created"]++;
    collectionIds.set(c.externalId, row.id);
  }

  // Articles
  for (const a of data.articles) {
    if (!a.title.trim()) continue;
    const base = a.url || sourceBase;
    const main = htmlToBlocks(a.html, base);
    const content: KbContent = { title: escapeMarkup(a.title).slice(0, 255), summary: escapeMarkup(a.summary).slice(0, 500), blocks: main.blocks };
    const hash = kbHash(content);
    const issues = new Set(main.warnings);

    const existing = await prisma.kbArticle.findUnique({
      where: { workspaceId_source_externalId: { workspaceId, source, externalId: a.externalId } },
    });
    // Imported languages replace what was there; others (say, AI translations) stay.
    const translations: KbTranslations = parseKbTranslations(existing?.translations);
    for (const [locale, t] of Object.entries(a.translations)) {
      const converted = htmlToBlocks(t.html, base);
      converted.warnings.forEach((w) => issues.add(w));
      translations[locale] = {
        title: escapeMarkup(t.title).slice(0, 255),
        summary: escapeMarkup(t.summary).slice(0, 500),
        blocks: converted.blocks,
        source: hash,
      };
      report.translations++;
    }

    const status = opts.status === "source" ? (a.published ? "PUBLISHED" : "DRAFT") : existing ? existing.status : "DRAFT";
    const fields = {
      title: a.title.slice(0, 255),
      content: content as unknown as Prisma.InputJsonObject,
      translations: translations as unknown as Prisma.InputJsonObject,
      searchText: searchTextOf(content, translations),
      collectionId: a.collectionExternalId ? (collectionIds.get(a.collectionExternalId) ?? null) : null,
      position: a.position,
      externalUrl: a.url.slice(0, 1024) || null,
      status,
    } as const;
    if (existing) await prisma.kbArticle.update({ where: { id: existing.id }, data: fields });
    else await prisma.kbArticle.create({ data: { workspaceId, source, externalId: a.externalId, ...fields } });
    report.articles[existing ? "updated" : "created"]++;
    if (!main.blocks.length) issues.add("no content came through");
    if (issues.size && report.warnings.length < 50) report.warnings.push({ title: a.title, issues: [...issues] });
  }
  return report;
}
