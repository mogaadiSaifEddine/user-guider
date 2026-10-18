import "server-only";
import { z } from "zod";
import { Prisma, type EndUser, type Guide, type GuideProgress, type Workspace } from "@prisma/client";
import { prisma } from "./db";
import { verifyUserHash } from "./keys";
import { companyFrom } from "./companies";
import { parseUserAgent, primaryLanguage } from "./user-agent";
import {
  matchesUser,
  normalizeAnswer,
  parseContent,
  parseTargeting,
  parseTheme,
  type ChecklistContent,
  type HotspotContent,
  type GuideTypeName,
  type SurveyContent,
} from "./guide-schema";

// ---------- Request shapes ----------

const attributeValue = z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]);

export const sdkUserSchema = z
  .object({
    id: z.string().min(1).max(191).optional(),
    anonymousId: z.string().min(1).max(191).optional(),
    hash: z.string().max(128).optional(),
    attributes: z.record(z.string().max(100), attributeValue).optional(),
  })
  .refine((u) => u.id || u.anonymousId, "id or anonymousId is required");

// Browser details the SDK adds to init; the user agent itself comes from the request header.
const contextSchema = z.object({
  language: z.string().max(35).optional(),
  timezone: z.string().max(64).optional(),
  touch: z.boolean().optional(),
  mobile: z.boolean().optional(),
});

export const initSchema = z.object({
  key: z.string().min(1).max(100),
  user: sdkUserSchema,
  url: z.string().max(2000).optional(),
  context: contextSchema.optional(),
});

export type RequestInfo = { userAgent: string | null; acceptLanguage: string | null };

export const eventTypes = [
  "guide_shown",
  "step_viewed",
  "guide_completed",
  "guide_dismissed",
  "checklist_item_completed",
  "hotspot_opened",
  "survey_answered",
  "custom",
] as const;

export const eventsSchema = z.object({
  key: z.string().min(1).max(100),
  user: sdkUserSchema,
  events: z
    .array(
      z.object({
        type: z.enum(eventTypes),
        guideId: z.string().max(64).optional(),
        name: z.string().max(191).optional(),
        stepIndex: z.number().int().min(0).max(1000).optional(),
        url: z.string().max(1024).optional(),
        // survey_answered: the answer (checked against the question on the server).
        value: z.union([z.number(), z.string().max(2000), z.array(z.string().max(64)).max(12)]).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export class SdkError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// ---------- Identity ----------

type Client = Partial<Pick<EndUser, "browser" | "os" | "device" | "language" | "timezone">>;

function clientFields(context: z.infer<typeof contextSchema> | undefined, req: RequestInfo): Client {
  const fields: Client = {};
  if (req.userAgent) Object.assign(fields, parseUserAgent(req.userAgent, { touch: context?.touch, mobile: context?.mobile }));
  const language = context?.language?.trim() || primaryLanguage(req.acceptLanguage);
  if (language) fields.language = language;
  if (context?.timezone) fields.timezone = context.timezone;
  return fields;
}

async function resolveEndUser(
  workspace: Workspace,
  user: z.infer<typeof sdkUserSchema>,
  touch: boolean,
  client: Client = {},
) {
  const identified = Boolean(user.id);
  const externalId = identified ? user.id! : `anon:${user.anonymousId}`;

  if (identified) {
    const ok = verifyUserHash(workspace.secretKey, user.id!, user.hash);
    // A wrong hash is always rejected; a missing one only when verification is required.
    if (user.hash && !ok) throw new SdkError("Invalid user hash", 401);
    if (!user.hash && workspace.requireIdentityVerification) throw new SdkError("User hash required", 401);
  }

  const existing = await prisma.endUser.findUnique({
    where: { workspaceId_externalId: { workspaceId: workspace.id, externalId } },
  });

  if (!existing) {
    try {
      return await prisma.endUser.create({
        data: {
          workspaceId: workspace.id,
          externalId,
          anonymous: !identified,
          attributes: user.attributes ?? {},
          ...companyFrom(user.attributes ?? {}, workspace),
          ...client,
        },
      });
    } catch (e) {
      // Two first requests raced; the other one created the row.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return prisma.endUser.findUniqueOrThrow({
          where: { workspaceId_externalId: { workspaceId: workspace.id, externalId } },
        });
      }
      throw e;
    }
  }

  if (!touch && !user.attributes) return existing;
  const attributes = user.attributes ? { ...(existing.attributes as Record<string, unknown>), ...user.attributes } : null;
  return prisma.endUser.update({
    where: { id: existing.id },
    data: {
      lastSeenAt: new Date(),
      ...client,
      ...(attributes ? { attributes: attributes as Prisma.InputJsonObject, ...companyFrom(attributes, workspace) } : {}),
    },
  });
}

async function workspaceByKey(key: string) {
  const workspace = await prisma.workspace.findUnique({ where: { publicKey: key } });
  if (!workspace) throw new SdkError("Unknown workspace key", 404);
  return workspace;
}

// ---------- init ----------

function progressView(p: GuideProgress | undefined) {
  return p
    ? { status: p.status, currentStep: p.currentStep, completedItems: p.completedItems as string[] }
    : null;
}

function autoShowAllowed(frequency: string, p: GuideProgress | undefined) {
  if (!p) return true;
  if (frequency === "always") return true;
  if (frequency === "until_completed") return p.status !== "COMPLETED";
  return p.status === "STARTED";
}

function utcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function sdkInit(input: z.infer<typeof initSchema>, req: RequestInfo = { userAgent: null, acceptLanguage: null }) {
  const workspace = await workspaceByKey(input.key);
  const endUser = await resolveEndUser(workspace, input.user, true, clientFields(input.context, req));
  // Daily/weekly/monthly active users count the days the snippet loaded.
  await prisma.userActivity.createMany({
    data: [{ endUserId: endUser.id, workspaceId: workspace.id, day: utcDay() }],
    skipDuplicates: true,
  });

  const [guides, progress] = await Promise.all([
    prisma.guide.findMany({
      where: { workspaceId: workspace.id, status: "PUBLISHED" },
      orderBy: [{ priority: "desc" }, { publishedAt: "asc" }],
    }),
    prisma.guideProgress.findMany({ where: { endUserId: endUser.id } }),
  ]);
  const progressByGuide = new Map(progress.map((p) => [p.guideId, p]));
  const attributes = endUser.attributes as Record<string, unknown>;

  const visible = guides.flatMap((g) => {
    const targeting = parseTargeting(g.targeting);
    if (endUser.anonymous && !targeting.includeAnonymous) return [];
    if (!matchesUser(targeting.userRules, attributes)) return [];
    const p = progressByGuide.get(g.id);
    return [
      {
        id: g.id,
        name: g.name,
        type: g.type,
        priority: g.priority,
        content: parseContent(g.type as GuideTypeName, g.publishedContent),
        targeting: {
          urlRules: targeting.urlRules,
          trigger: targeting.trigger,
          delaySeconds: targeting.delaySeconds,
        },
        // Checklists and hotspots can't be started by hand, so they always run automatically.
        // Surveys can, like tours and announcements.
        autoShow:
          (targeting.trigger === "auto" || g.type === "CHECKLIST" || g.type === "HOTSPOT") &&
          autoShowAllowed(targeting.frequency, p),
        progress: progressView(p),
      },
    ];
  });

  return {
    user: { id: endUser.externalId, anonymous: endUser.anonymous },
    theme: parseTheme(workspace.theme),
    guides: visible,
  };
}

// ---------- events ----------

type ProgressPatch = { status?: "STARTED" | "COMPLETED" | "DISMISSED"; currentStep?: number; addItem?: string };

export async function sdkEvents(input: z.infer<typeof eventsSchema>) {
  const workspace = await workspaceByKey(input.key);
  const endUser = await resolveEndUser(workspace, input.user, false);

  // Only accept guide ids that belong to this workspace.
  const guideIds = [...new Set(input.events.map((e) => e.guideId).filter(Boolean))] as string[];
  const ownGuides = guideIds.length
    ? await prisma.guide.findMany({ where: { id: { in: guideIds }, workspaceId: workspace.id } })
    : [];
  const guidesById = new Map<string, Guide>(ownGuides.map((g) => [g.id, g]));

  const rows: Prisma.EventCreateManyInput[] = [];
  const touched = new Set<string>();

  for (const e of input.events) {
    const guideId = e.guideId && guidesById.has(e.guideId) ? e.guideId : null;
    if (e.type !== "custom" && !guideId) continue;
    rows.push({
      workspaceId: workspace.id,
      endUserId: endUser.id,
      guideId,
      type: e.type,
      name: e.name ?? null,
      stepIndex: e.stepIndex ?? null,
      url: e.url ?? null,
    });
  }
  if (rows.length) await prisma.event.createMany({ data: rows });

  // Checklists can be completed by custom events or finished guides, so load them once.
  let checklists: { guide: Guide; content: ChecklistContent }[] | null = null;
  const loadChecklists = async () => {
    checklists ??= (
      await prisma.guide.findMany({ where: { workspaceId: workspace.id, status: "PUBLISHED", type: "CHECKLIST" } })
    ).map((guide) => ({ guide, content: parseContent("CHECKLIST", guide.publishedContent) as ChecklistContent }));
    return checklists;
  };

  for (const e of input.events) {
    const guide = e.guideId ? guidesById.get(e.guideId) : undefined;
    switch (e.type) {
      case "guide_shown":
        if (guide) await applyProgress(endUser, guide, { status: "STARTED" }, touched);
        break;
      case "step_viewed":
        if (guide && e.stepIndex !== undefined)
          await applyProgress(endUser, guide, { currentStep: e.stepIndex }, touched);
        break;
      case "guide_completed":
        if (guide) {
          await applyProgress(endUser, guide, { status: "COMPLETED" }, touched);
          for (const c of await loadChecklists())
            for (const item of c.content.items)
              if (item.completeOn.type === "guide" && item.completeOn.guideId === guide.id)
                await completeItem(workspace, endUser, c.guide, itemIds(c.content), item.id, touched);
        }
        break;
      case "guide_dismissed":
        if (guide) await applyProgress(endUser, guide, { status: "DISMISSED" }, touched);
        break;
      case "checklist_item_completed":
        if (guide && guide.type === "CHECKLIST" && e.name) {
          const content = parseContent("CHECKLIST", guide.publishedContent) as ChecklistContent;
          await completeItem(workspace, endUser, guide, itemIds(content), e.name, touched);
        }
        break;
      case "hotspot_opened":
        // Opening every hotspot of a guide completes it.
        if (guide && guide.type === "HOTSPOT" && e.name) {
          const content = parseContent("HOTSPOT", guide.publishedContent) as HotspotContent;
          await completeItem(workspace, endUser, guide, content.hotspots.map((h) => h.id), e.name, touched);
        }
        break;
      case "survey_answered":
        if (guide && guide.type === "SURVEY" && e.name) {
          const content = parseContent("SURVEY", guide.publishedContent) as SurveyContent;
          const question = content.questions.find((q) => q.id === e.name);
          const value = question ? normalizeAnswer(question, e.value) : null;
          if (value === null) break;
          await prisma.surveyAnswer.upsert({
            where: { guideId_endUserId_questionId: { guideId: guide.id, endUserId: endUser.id, questionId: e.name } },
            create: { workspaceId: workspace.id, guideId: guide.id, endUserId: endUser.id, questionId: e.name, value },
            update: { value },
          });
        }
        break;
      case "custom":
        if (e.name)
          for (const c of await loadChecklists())
            for (const item of c.content.items)
              if (item.completeOn.type === "event" && item.completeOn.name === e.name)
                await completeItem(workspace, endUser, c.guide, itemIds(c.content), item.id, touched);
        break;
    }
  }

  const progress = touched.size
    ? await prisma.guideProgress.findMany({ where: { endUserId: endUser.id, guideId: { in: [...touched] } } })
    : [];
  return { progress: Object.fromEntries(progress.map((p) => [p.guideId, progressView(p)])) };
}

const itemIds = (c: ChecklistContent) => c.items.map((i) => i.id);

async function completeItem(
  workspace: Workspace,
  endUser: EndUser,
  guide: Guide,
  allIds: string[],
  itemId: string,
  touched: Set<string>,
) {
  if (!allIds.includes(itemId)) return;
  const p = await applyProgress(endUser, guide, { addItem: itemId }, touched);
  const done = new Set(p.completedItems as string[]);
  if (p.status !== "COMPLETED" && allIds.length && allIds.every((id) => done.has(id))) {
    await applyProgress(endUser, guide, { status: "COMPLETED" }, touched);
    await prisma.event.create({
      data: { workspaceId: workspace.id, endUserId: endUser.id, guideId: guide.id, type: "guide_completed" },
    });
  }
}

async function applyProgress(endUser: EndUser, guide: Guide, patch: ProgressPatch, touched: Set<string>) {
  touched.add(guide.id);
  const key = { endUserId_guideId: { endUserId: endUser.id, guideId: guide.id } };
  const current = await prisma.guideProgress.findUnique({ where: key });

  let status = current?.status ?? "STARTED";
  if (patch.status === "COMPLETED") status = "COMPLETED";
  // Re-showing or dismissing never undoes a completion.
  else if (patch.status && status !== "COMPLETED") status = patch.status;

  const items = new Set((current?.completedItems as string[] | undefined) ?? []);
  if (patch.addItem) items.add(patch.addItem);

  const data = {
    status,
    currentStep: patch.currentStep ?? current?.currentStep ?? 0,
    completedItems: [...items],
  };
  return prisma.guideProgress.upsert({
    where: key,
    create: { endUserId: endUser.id, guideId: guide.id, ...data },
    update: data,
  });
}
