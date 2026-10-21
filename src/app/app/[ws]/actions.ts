"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { GuideStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireGuide, requireWorkspace } from "@/lib/auth";
import { newPublicKey, newSecretKey } from "@/lib/keys";
import { signBuilderToken } from "@/lib/tokens";
import {
  contentSchemas,
  defaultContent,
  parseTargeting,
  targetingSchema,
  themeSchema,
  type GuideTypeName,
  type InlineContent,
  type ResourceCenterContent,
  type SurveyContent,
  type TourContent,
} from "@/lib/guide-schema";
import { companyFrom } from "@/lib/companies";
import { guideFootprint, guidesFootprint } from "@/lib/analytics";
import { AiError, aiEnabled } from "@/lib/ai";
import { translateTexts } from "@/lib/ai-translate";
import {
  languageName,
  normalizeLocale,
  pruneTranslations,
  textFields,
  translationStatus,
  workspaceLanguages,
  type Translations,
} from "@/lib/i18n";
import { UI_STRING_KEYS, UI_STRINGS_EN } from "@/lib/ui-strings";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

// ---------- Guides ----------

const guideTypes = ["TOUR", "CHECKLIST", "ANNOUNCEMENT", "HOTSPOT", "SURVEY", "RESOURCE_CENTER", "INLINE"] as const;

export async function createGuide(ws: string, form: FormData) {
  await requireWorkspace(ws);
  const type = z.enum(guideTypes).parse(form.get("type"));
  const name = z.string().trim().min(1).max(191).catch("Untitled guide").parse(form.get("name"));
  const guide = await prisma.guide.create({
    data: {
      workspaceId: ws,
      name,
      type,
      content: defaultContent(type) as Prisma.InputJsonObject,
      targeting: parseTargeting({}) as Prisma.InputJsonObject,
    },
  });
  redirect(`/app/${ws}/guides/${guide.id}`);
}

const translationsSchema = z.record(
  z.string().max(35),
  z.record(z.string().max(500), z.object({ text: z.string().max(5000), source: z.string().max(5000) })),
);

const saveSchema = z.object({
  name: z.string().trim().min(1).max(191),
  priority: z.number().int().min(-100).max(100),
  content: z.unknown(),
  targeting: targetingSchema,
  // Left out: translations stay as they are.
  translations: translationsSchema.optional(),
});

export async function saveGuide(ws: string, id: string, input: unknown): Promise<ActionResult> {
  const { guide } = await requireGuide(ws, id);
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  const content = contentSchemas[guide.type as GuideTypeName].safeParse(parsed.data.content);
  if (!content.success) return { ok: false, error: describe(content.error) };

  await prisma.guide.update({
    where: { id },
    data: {
      name: parsed.data.name,
      priority: parsed.data.priority,
      content: content.data as Prisma.InputJsonObject,
      targeting: parsed.data.targeting as Prisma.InputJsonObject,
      // Languages switched off in Settings keep their translations, in case they come back.
      translations: pruneTranslations(content.data, parsed.data.translations ?? (guide.translations as Translations | null)) as Prisma.InputJsonObject,
    },
  });
  revalidatePath(`/app/${ws}/guides`);
  return { ok: true };
}

export async function publishGuide(ws: string, id: string): Promise<ActionResult> {
  const { guide, workspace } = await requireGuide(ws, id);
  const r = await publishOne(guide, workspace);
  if ("error" in r) return { ok: false, error: r.error };
  revalidatePath(`/app/${ws}/guides`);
  return {
    ok: true,
    message:
      "Published. Live on your site within a page load." +
      (r.gaps.length ? ` Not fully translated (untranslated texts show in English): ${r.gaps.join(", ")}.` : ""),
  };
}

// Checks and publishes one guide. Returns the languages that will partly show English.
async function publishOne(
  guide: { id: string; type: string; content: Prisma.JsonValue; translations: Prisma.JsonValue },
  workspace: { languages: Prisma.JsonValue },
): Promise<{ error: string } | { gaps: string[] }> {
  const content = contentSchemas[guide.type as GuideTypeName].safeParse(guide.content);
  if (!content.success) return { error: describe(content.error) };
  const problem = publishProblem(guide.type as GuideTypeName, content.data);
  if (problem) return { error: problem };

  const languages = workspaceLanguages(workspace.languages);
  const translations = pruneTranslations(content.data, guide.translations as Translations | null, languages);
  await prisma.guide.update({
    where: { id: guide.id },
    data: {
      status: "PUBLISHED",
      publishedContent: content.data as Prisma.InputJsonObject,
      publishedTranslations: translations as Prisma.InputJsonObject,
      publishedAt: new Date(),
    },
  });
  const fields = textFields(content.data);
  const gaps = languages.slice(1).flatMap((l) => {
    const st = translationStatus(fields, translations[l]);
    if (st.missing) return [`${languageName(l)} (${st.missing} missing)`];
    return st.outdated ? [`${languageName(l)} (${st.outdated} outdated)`] : [];
  });
  return { gaps };
}

function publishProblem(type: GuideTypeName, content: unknown): string | null {
  const c = content as Record<string, unknown[]>;
  if (type === "TOUR" && !c.steps.length) return "Add at least one step before publishing.";
  if (type === "CHECKLIST" && !c.items.length) return "Add at least one item before publishing.";
  if (type === "SURVEY") {
    const qs = (content as SurveyContent).questions;
    if (!qs.length) return "Add at least one question before publishing.";
    const noText = qs.findIndex((q) => !q.title.trim());
    if (noText >= 0) return `Question ${noText + 1} has no text.`;
    const fewOptions = qs.findIndex(
      (q) => (q.type === "single" || q.type === "multiple") && q.options.filter((o) => o.label.trim()).length < 2,
    );
    if (fewOptions >= 0) return `Question ${fewOptions + 1} needs at least two answer options.`;
  }
  if (type === "RESOURCE_CENTER") {
    const rc = content as ResourceCenterContent;
    if (!rc.modules.length) return "Add at least one section before publishing.";
    for (const m of rc.modules) {
      if (m.type === "checklist" && !m.guideId) return "Pick a checklist for the checklist section.";
      if (m.type === "links" && m.links.some((l) => !l.label.trim() || !l.url.trim())) return `Every link in "${m.title}" needs a label and an address.`;
      if (m.type === "articles" && m.articles.some((a) => !a.title.trim())) return `Every article in "${m.title}" needs a title.`;
      if (m.type === "contact" && !m.value.trim() && m.action !== "event")
        return `The contact section needs ${m.action === "email" ? "an email address" : "an address"}.`;
    }
  }
  if (type === "HOTSPOT") {
    const hs = c.hotspots as { selector: string }[];
    if (!hs.length) return "Add at least one hotspot before publishing.";
    if (hs.some((h) => !h.selector)) return "Every hotspot needs an element. Pick one in the builder.";
  }
  if (type === "INLINE") {
    const card = content as InlineContent;
    if (!card.selector) return "Pick the element the card sits next to, in the builder or by hand.";
    if (!card.blocks.length) return "Add some content to the card before publishing.";
  }
  if (type === "TOUR") {
    const steps = (content as TourContent).steps;
    const i = steps.findIndex((s) => s.advanceOn.type === "element" && !s.advanceOn.selector);
    if (i >= 0) return `Step ${i + 1} waits for an element: pick which one.`;
    const j = steps.findIndex((s) => (s.advanceOn.type === "event" && !s.advanceOn.name) || (s.advanceOn.type === "url" && !s.advanceOn.rule.value));
    if (j >= 0) return `Step ${j + 1} waits for ${steps[j].advanceOn.type === "url" ? "a page" : "an event"}: fill it in.`;
  }
  return null;
}

export async function setGuideStatus(ws: string, id: string, status: "DRAFT" | "ARCHIVED"): Promise<ActionResult> {
  await requireGuide(ws, id);
  await prisma.guide.update({ where: { id }, data: { status } });
  revalidatePath(`/app/${ws}/guides`);
  return { ok: true, message: status === "DRAFT" ? "Unpublished." : "Archived." };
}

// Opens the copy, or with open=false stays put (the guides list) and reports back.
export async function duplicateGuide(ws: string, id: string, open = true): Promise<ActionResult> {
  const { guide } = await requireGuide(ws, id);
  const copy = await prisma.guide.create({
    data: {
      workspaceId: ws,
      name: `${guide.name} (copy)`.slice(0, 191),
      type: guide.type,
      content: guide.content as Prisma.InputJsonObject,
      targeting: guide.targeting as Prisma.InputJsonObject,
      translations: (guide.translations ?? {}) as Prisma.InputJsonObject,
      priority: guide.priority,
    },
  });
  if (open) redirect(`/app/${ws}/guides/${copy.id}`);
  revalidatePath(`/app/${ws}/guides`);
  return { ok: true, message: `Created "${copy.name}" as a draft.` };
}

// What deleting a guide takes with it, for the confirm dialog on the guides list.
export async function getGuideFootprint(ws: string, id: string) {
  await requireGuide(ws, id);
  return guideFootprint(id);
}

export async function deleteGuide(ws: string, id: string) {
  await requireGuide(ws, id);
  await prisma.guide.delete({ where: { id } });
  revalidatePath(`/app/${ws}/guides`);
  redirect(`/app/${ws}/guides`);
}

// ---------- Bulk actions (guides list) ----------

const bulkIdsSchema = z.array(z.string().max(64)).min(1).max(1000);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// What deleting these guides takes with it, for the bulk delete confirm.
export async function getGuidesFootprint(ws: string, ids: string[]) {
  await requireWorkspace(ws);
  const own = await prisma.guide.findMany({ where: { workspaceId: ws, id: { in: bulkIdsSchema.parse(ids) } }, select: { id: true } });
  return guidesFootprint(own.map((g) => g.id));
}

// Applies one action to several guides. Each action only touches the guides it makes
// sense for (publish: drafts, unpublish: live ones, …); the others are left alone.
export async function bulkGuides(
  ws: string,
  input: unknown,
  action: "publish" | "unpublish" | "archive" | "restore" | "delete",
): Promise<ActionResult> {
  const { workspace } = await requireWorkspace(ws);
  const ids = bulkIdsSchema.safeParse(input);
  if (!ids.success) return { ok: false, error: "Select at least one guide." };
  const where = { workspaceId: ws, id: { in: ids.data } };
  let message: string;

  if (action === "publish") {
    const drafts = await prisma.guide.findMany({ where: { ...where, status: "DRAFT" } });
    const failed: string[] = [];
    let done = 0;
    for (const g of drafts) {
      const r = await publishOne(g, workspace);
      if ("error" in r) failed.push(`"${g.name}": ${r.error}`);
      else done++;
    }
    revalidatePath(`/app/${ws}/guides`);
    if (!done && failed.length) return { ok: false, error: `Nothing published. ${failed.join(" ")}` };
    message = `Published ${plural(done, "guide")}.` + (failed.length ? ` Not published: ${failed.join(" ")}` : "");
  } else if (action === "delete") {
    const { count } = await prisma.guide.deleteMany({ where });
    message = `Deleted ${plural(count, "guide")}.`;
  } else {
    const [from, to, verb] = {
      unpublish: ["PUBLISHED", "DRAFT", "Unpublished"],
      archive: [{ not: "ARCHIVED" }, "ARCHIVED", "Archived"],
      restore: ["ARCHIVED", "DRAFT", "Restored as drafts:"],
    }[action] as [GuideStatus | { not: GuideStatus }, GuideStatus, string];
    const { count } = await prisma.guide.updateMany({ where: { ...where, status: from }, data: { status: to } });
    message = `${verb} ${plural(count, "guide")}.`;
  }
  revalidatePath(`/app/${ws}/guides`);
  return { ok: true, message };
}

// Link that opens the customer's site in builder mode for this guide.
export async function builderLink(
  ws: string,
  id: string,
  pageUrl: string,
  aiGoal: string | null = null,
): Promise<ActionResult & { url?: string }> {
  const { user } = await requireGuide(ws, id);
  let url: URL;
  try {
    url = new URL(pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    return { ok: false, error: "Enter the full address of a page on your site, starting with https://" };
  }
  const goal = aiGoal === null ? null : aiGoal.trim().slice(0, 1000);
  url.searchParams.set("lg_builder", await signBuilderToken({ userId: user.id, workspaceId: ws, guideId: id, aiGoal: goal }));
  return { ok: true, url: url.toString() };
}

// ---------- Translation ----------

const translateItemsSchema = z
  .array(z.object({ key: z.string().max(500), text: z.string().max(5000), rich: z.boolean() }))
  .max(1000);

// Translates texts from English with AI. Nothing is saved: the editor puts the
// result into its draft for review.
export async function aiTranslate(ws: string, locale: string, items: unknown) {
  return translateFor(ws, locale, items, true);
}

async function translateFor(
  ws: string,
  locale: string,
  items: unknown,
  mustBeEnabled: boolean,
): Promise<ActionResult & { translations?: Record<string, string> }> {
  const { workspace } = await requireWorkspace(ws);
  if (!aiEnabled()) return { ok: false, error: "AI isn't set up on this server (GEMINI_API_KEY is missing)." };
  const target = normalizeLocale(locale);
  if (!target || target === "en") return { ok: false, error: "Pick a language other than English." };
  if (mustBeEnabled && !workspaceLanguages(workspace.languages).includes(target))
    return { ok: false, error: "Add that language in Settings first." };
  const parsed = translateItemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  try {
    const translations = await translateTexts(parsed.data, target, workspace.aiContext ?? "");
    const skipped = parsed.data.filter((i) => i.text.trim() && !translations[i.key]).length;
    return {
      ok: true,
      translations,
      message: `Translated ${Object.keys(translations).length} texts${skipped ? `; ${skipped} need a manual translation` : ""}. Review, then save.`,
    };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, error: e.message };
    throw e;
  }
}

const languagesSchema = z.object({
  languages: z.array(z.string().max(35)).max(40),
  // { [locale]: { [key]: text } }; empty texts are dropped.
  uiStrings: z.record(z.string().max(35), z.record(z.string().max(40), z.string().max(200))).default({}),
});

export async function updateLanguages(ws: string, input: unknown): Promise<ActionResult> {
  await requireWorkspace(ws);
  const parsed = languagesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  const bad = parsed.data.languages.find((l) => !normalizeLocale(l));
  if (bad) return { ok: false, error: `"${bad}" isn't a language code like de, pt-BR or zh-CN.` };
  const languages = workspaceLanguages(parsed.data.languages).slice(1);
  const uiStrings: Record<string, Record<string, string>> = {};
  for (const l of languages) {
    const mine: Record<string, string> = {};
    for (const k of UI_STRING_KEYS) {
      const v = parsed.data.uiStrings[l]?.[k]?.trim();
      if (v) mine[k] = v;
    }
    if (Object.keys(mine).length) uiStrings[l] = mine;
  }
  await prisma.workspace.update({
    where: { id: ws },
    data: { languages: languages as Prisma.InputJsonArray, uiStrings: uiStrings as Prisma.InputJsonObject },
  });
  revalidatePath(`/app/${ws}`, "layout");
  return { ok: true, message: "Saved." };
}

// Interface text (Close, Back, Search…) for a language without built-in text.
export async function aiTranslateUi(ws: string, locale: string): Promise<ActionResult & { strings?: Record<string, string> }> {
  // Works before the new language is saved.
  const r = await translateFor(
    ws,
    locale,
    UI_STRING_KEYS.map((k) => ({ key: k, text: UI_STRINGS_EN[k], rich: false })),
    false,
  );
  return r.ok ? { ok: true, strings: r.translations, message: "Translated. Review, then save." } : r;
}

// ---------- Workspace settings ----------

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  requireIdentityVerification: z.boolean(),
  aiContext: z.string().max(4000).default(""),
  companyIdAttribute: z.string().trim().max(100).default(""),
  companyNameAttribute: z.string().trim().max(100).default(""),
  theme: themeSchema,
});

export async function updateWorkspace(ws: string, input: unknown): Promise<ActionResult> {
  const { workspace } = await requireWorkspace(ws);
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  const company = {
    companyIdAttribute: parsed.data.companyIdAttribute || null,
    companyNameAttribute: parsed.data.companyNameAttribute || null,
  };
  await prisma.workspace.update({
    where: { id: ws },
    data: {
      name: parsed.data.name,
      requireIdentityVerification: parsed.data.requireIdentityVerification,
      aiContext: parsed.data.aiContext.trim() || null,
      theme: parsed.data.theme as Prisma.InputJsonObject,
      ...company,
    },
  });
  const changed =
    company.companyIdAttribute !== workspace.companyIdAttribute || company.companyNameAttribute !== workspace.companyNameAttribute;
  const regrouped = changed ? await regroupCompanies(ws, company) : null;
  revalidatePath(`/app/${ws}`, "layout");
  return { ok: true, message: regrouped === null ? "Saved." : `Saved. Regrouped ${regrouped} users by company.` };
}

// Recomputes every user's company after the company attributes change.
async function regroupCompanies(ws: string, config: Parameters<typeof companyFrom>[1]) {
  let cursor: string | undefined;
  let count = 0;
  for (;;) {
    const batch = await prisma.endUser.findMany({
      where: { workspaceId: ws },
      select: { id: true, attributes: true },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!batch.length) return count;
    await prisma.$transaction(
      batch.map((u) => prisma.endUser.update({ where: { id: u.id }, data: companyFrom(u.attributes as Record<string, unknown>, config) })),
    );
    count += batch.length;
    cursor = batch[batch.length - 1].id;
  }
}

export async function rotateKey(ws: string, which: "public" | "secret"): Promise<ActionResult> {
  const { role } = await requireWorkspace(ws);
  if (role !== "OWNER") return { ok: false, error: "Only owners can rotate keys." };
  await prisma.workspace.update({
    where: { id: ws },
    data: which === "public" ? { publicKey: newPublicKey() } : { secretKey: newSecretKey() },
  });
  revalidatePath(`/app/${ws}`, "layout");
  return {
    ok: true,
    message: which === "public" ? "New public key. Update the snippet on your site." : "New secret key. Update your server.",
  };
}

export async function addMember(ws: string, email: string, role: "OWNER" | "EDITOR"): Promise<ActionResult> {
  const ctx = await requireWorkspace(ws);
  if (ctx.role !== "OWNER") return { ok: false, error: "Only owners can add members." };
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return { ok: false, error: "No account with that email. Ask them to sign up first." };
  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: ws } },
    create: { userId: user.id, workspaceId: ws, role },
    update: { role },
  });
  revalidatePath(`/app/${ws}/settings`);
  return { ok: true, message: `${user.name} added.` };
}

export async function removeMember(ws: string, userId: string): Promise<ActionResult> {
  const ctx = await requireWorkspace(ws);
  if (ctx.role !== "OWNER") return { ok: false, error: "Only owners can remove members." };
  const owners = await prisma.membership.count({ where: { workspaceId: ws, role: "OWNER" } });
  const target = await prisma.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId: ws } } });
  if (!target) return { ok: false, error: "Not a member." };
  if (target.role === "OWNER" && owners <= 1) return { ok: false, error: "A workspace needs at least one owner." };
  await prisma.membership.delete({ where: { userId_workspaceId: { userId, workspaceId: ws } } });
  revalidatePath(`/app/${ws}/settings`);
  return { ok: true };
}

export async function deleteWorkspace(ws: string, confirmName: string): Promise<ActionResult> {
  const { role, workspace } = await requireWorkspace(ws);
  if (role !== "OWNER") return { ok: false, error: "Only owners can delete a workspace." };
  if (confirmName.trim() !== workspace.name) return { ok: false, error: "Type the workspace name to confirm." };
  await prisma.workspace.delete({ where: { id: ws } });
  redirect("/app?all=1");
}

function describe(e: z.ZodError) {
  const i = e.issues[0];
  return i ? `${i.path.join(".") || "input"}: ${i.message}` : "Invalid input";
}
