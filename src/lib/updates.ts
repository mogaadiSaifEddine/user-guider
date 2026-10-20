import { z } from "zod";
import type { Block } from "./guide-schema";
import { kbContentSchema, kbTranslationsSchema, type KbContent, type KbTranslations } from "./kb";

// Product updates: a changelog, written here, shown on a public page
// (/updates/<slug>) and in the resource center ("What's new" section).
// A post's content and translations have the same shape as a knowledge base
// article, so it reuses kb.ts for localizing, hashing and AI translation.
// No server-only imports (the SDK uses the types).

export const updateContentSchema = kbContentSchema;
export const updateTranslationsSchema = kbTranslationsSchema;
export type UpdateContent = KbContent;
export type UpdateTranslations = KbTranslations;

export const labelColors = ["violet", "blue", "green", "amber", "red", "pink", "gray"] as const;
export type LabelColor = (typeof labelColors)[number];

// Text / background pairs, used by the dashboard, the public page and the SDK.
export const LABEL_STYLES: Record<LabelColor, { fg: string; bg: string }> = {
  violet: { fg: "#5b34e0", bg: "#efeafe" },
  blue: { fg: "#1d5fd1", bg: "#e5efff" },
  green: { fg: "#0f7a4b", bg: "#e2f6ec" },
  amber: { fg: "#9a5b00", bg: "#fdf1d8" },
  red: { fg: "#c42b2b", bg: "#fde7e7" },
  pink: { fg: "#b8287a", bg: "#fce7f3" },
  gray: { fg: "#4b5063", bg: "#eeeff3" },
};

export const updateLabelSchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().trim().min(1, "Name every label").max(40),
  color: z.enum(labelColors).default("violet"),
});

export const updatesPageSchema = z.object({
  enabled: z.boolean().default(false),
  title: z.string().max(120).default("What's new"),
  description: z.string().max(300).default("New features, improvements and fixes."),
  logoUrl: z.string().max(1000).default(""),
  websiteUrl: z.string().max(1000).default(""),
  websiteLabel: z.string().max(40).default("Back to app"),
  // Post reactions (and comments) on the page and in the resource center.
  reactions: z.boolean().default(true),
  labels: z.array(updateLabelSchema).max(20).default([
    { id: "new", name: "New", color: "violet" },
    { id: "improvement", name: "Improvement", color: "blue" },
    { id: "fix", name: "Fix", color: "green" },
  ]),
});

export type UpdateLabel = z.infer<typeof updateLabelSchema>;
export type UpdatesPage = z.infer<typeof updatesPageSchema>;

export function parseUpdatesPage(raw: unknown): UpdatesPage {
  const r = updatesPageSchema.safeParse(raw ?? {});
  return r.success ? r.data : updatesPageSchema.parse({});
}

export function parseLabelIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, 20) : [];
}

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

export const reactionKinds = ["love", "neutral", "sad"] as const;
export type ReactionKind = (typeof reactionKinds)[number];
export const REACTION_EMOJI: Record<ReactionKind, string> = { love: "😍", neutral: "😐", sad: "😞" };

export type ReactionCounts = Record<ReactionKind, number>;
export const emptyCounts = (): ReactionCounts => ({ love: 0, neutral: 0, sad: 0 });

// Scheduled = published with a date still in the future.
export function updateState(u: { status: "DRAFT" | "PUBLISHED"; publishedAt: Date | string | null }, now = new Date()) {
  if (u.status === "DRAFT") return "draft" as const;
  return u.publishedAt && new Date(u.publishedAt) > now ? ("scheduled" as const) : ("published" as const);
}

// What the SDK gets.
export type SdkUpdateLabel = { id: string; name: string; color: LabelColor };
export type SdkUpdateHeader = {
  id: string;
  title: string;
  summary: string;
  coverUrl: string;
  labels: SdkUpdateLabel[];
  publishedAt: string;
  pinned: boolean;
};
export type SdkUpdate = SdkUpdateHeader & { blocks: Block[]; reaction: ReactionKind | null; comment: string };
export type SdkUpdateList = { locale: string; pageUrl: string | null; reactions: boolean; updates: SdkUpdateHeader[] };
