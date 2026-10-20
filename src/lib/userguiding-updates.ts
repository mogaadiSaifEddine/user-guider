import "server-only";
import { htmlToBlocks } from "./html-blocks";
import { normalizeLocale } from "./i18n";
import { plainText } from "./format";
import { kbHash } from "./kb";
import { updateContentSchema, type LabelColor, type UpdateContent, type UpdateLabel, type UpdateTranslations } from "./updates";

// UserGuiding product updates, from the same public sdk-<containerId>.json as
// guides (see userguiding.ts): productUpdatesPosts (date, labels), one
// productUpdatesPostLocales row per post and language (title, cover, HTML
// content), productUpdatesLabels and productUpdatesPage (branding).

/* eslint-disable @typescript-eslint/no-explicit-any -- untyped third-party JSON */

export type UgUpdate = {
  ugId: number;
  title: string;
  publishedAt: Date;
  active: boolean;
  coverUrl: string;
  // Ids of our labels (see `labels`).
  labels: string[];
  content: UpdateContent;
  translations: UpdateTranslations;
  warnings: string[];
};

export type UgUpdatesPage = {
  slug: string;
  title: string;
  description: string;
  logoUrl: string;
  websiteUrl: string;
  websiteLabel: string;
};

export type UgUpdatesConversion = { updates: UgUpdate[]; labels: UpdateLabel[]; page: UgUpdatesPage | null };

// Nearest of our label colors, by hue.
export function labelColorFor(hex: unknown): LabelColor {
  const m = typeof hex === "string" ? hex.trim().match(/^#?([0-9a-f]{6})$/i) : null;
  if (!m) return "violet";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.12) return "gray";
  const d = max - min;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 345) return "red";
  if (h < 65) return "amber";
  if (h < 170) return "green";
  if (h < 250) return "blue";
  if (h < 290) return "violet";
  return "pink";
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function convertLocale(data: any, fallbackTitle: string) {
  const { blocks, warnings } = htmlToBlocks(String(data?.content ?? ""));
  const tooltip = data?.boosters?.rcTooltip;
  const content = updateContentSchema.parse({
    title: str(data?.postTitle, 255) || fallbackTitle,
    // UserGuiding's resource center teaser, when it was used.
    summary: tooltip?.enabled ? str(tooltip.description, 500) : "",
    blocks: blocks.slice(0, 400),
  });
  return { content, warnings, cover: str(data?.coverImageUrl, 1000), active: data?.is_active !== false && data?.is_draft !== true };
}

export function convertUserGuidingUpdates(data: any): UgUpdatesConversion {
  const langs = new Map<number, string>(
    (Array.isArray(data?.productUpdatesLanguages) ? data.productUpdatesLanguages : []).map((l: any) => [Number(l.id), normalizeLocale(l.lang_code) ?? "en"]),
  );
  const defaultLang = normalizeLocale(
    (data?.productUpdatesLanguages ?? []).find((l: any) => l?.is_default)?.lang_code ?? "en",
  )?.split("-")[0];

  const labels: UpdateLabel[] = (Array.isArray(data?.productUpdatesLabels) ? data.productUpdatesLabels : [])
    .filter((l: any) => l?.id && (l.title || l.locales?.[0]?.title))
    .map((l: any) => ({ id: `ug${l.id}`, name: str(l.title || l.locales[0].title, 40), color: labelColorFor(l.color) }));
  const labelIds = new Set(labels.map((l) => l.id));

  const locales = Array.isArray(data?.productUpdatesPostLocales) ? data.productUpdatesPostLocales : [];
  const updates: UgUpdate[] = [];
  for (const p of Array.isArray(data?.productUpdatesPosts) ? data.productUpdatesPosts : []) {
    const rows = locales.filter((l: any) => Number(l.post_id) === Number(p.id));
    const langOf = (l: any) => langs.get(Number(l.language_id ?? l.language)) ?? "en";
    // English is our source language; otherwise UserGuiding's default.
    const source = rows.find((l: any) => langOf(l) === "en") ?? rows.find((l: any) => langOf(l).split("-")[0] === defaultLang) ?? rows[0];
    if (!source) continue;
    const title = str(p.title, 255) || `UserGuiding update ${p.id}`;
    const main = convertLocale(source.data, title);
    const warnings = new Set(main.warnings.map((w) => `Content: ${w}.`));
    if (langOf(source) !== "en") warnings.add(`Imported the ${langOf(source)} text as the English version; check it.`);
    if (p.require_authentication) warnings.add("Was visible to signed-in users only in UserGuiding; here published posts are public.");

    const translations: UpdateTranslations = {};
    for (const row of rows) {
      const l = langOf(row);
      if (row === source || l === "en") continue;
      const t = convertLocale(row.data, main.content.title);
      translations[l] = { ...t.content, source: kbHash(main.content) };
    }

    const date = new Date(p.post_date ?? p.created);
    updates.push({
      ugId: Number(p.id),
      title: plainText(main.content.title) || title,
      publishedAt: Number.isNaN(date.getTime()) ? new Date() : date,
      active: main.active,
      coverUrl: main.cover,
      labels: (Array.isArray(p.labels) ? p.labels : []).map((id: unknown) => `ug${id}`).filter((id: string) => labelIds.has(id)),
      content: main.content,
      translations,
      warnings: [...warnings],
    });
  }
  updates.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const pd = data?.productUpdatesPage?.data;
  const texts = pd?.texts?.en ?? (pd?.texts ? Object.values(pd.texts)[0] : null) as any;
  const header = Array.isArray(texts?.headerLinks) ? texts.headerLinks[0] : null;
  const page: UgUpdatesPage | null = pd
    ? {
        slug: str(data?.productUpdatesPage?.userguiding_host, 64).toLowerCase().replace(/[^a-z0-9-]/g, ""),
        title: str(texts?.title || pd.header?.title, 120),
        description: str(texts?.subtitle || pd.header?.subtitle, 300),
        logoUrl: str(pd.logo?.url, 1000),
        websiteUrl: str(header?.href || pd.companyLogoHref, 1000),
        websiteLabel: str(header?.label, 40),
      }
    : null;

  return { updates, labels, page };
}
