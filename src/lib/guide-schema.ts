import { z } from "zod";

// Shapes of Guide.content / Guide.targeting / Workspace.theme. The SDK imports
// the inferred types from here, so keep this file free of server-only imports.

export const placements = ["auto", "top", "bottom", "left", "right"] as const;

export const tourStepSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(200).default(""),
  body: z.string().max(4000).default(""),
  // Empty selector = centered modal step.
  selector: z.string().max(1000).default(""),
  placement: z.enum(placements).default("auto"),
  // "next": user presses Next. "click": clicking the target element advances.
  advanceOn: z.enum(["next", "click"]).default("next"),
  // Darken the rest of the page around the target.
  backdrop: z.boolean().default(true),
});

export const tourContentSchema = z.object({
  steps: z.array(tourStepSchema).max(50).default([]),
});

export const checklistItemSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(200).default(""),
  description: z.string().max(1000).default(""),
  // What clicking the item does.
  action: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("none") }),
      z.object({ type: z.literal("tour"), guideId: z.string() }),
      z.object({ type: z.literal("url"), url: z.string().max(1000) }),
    ])
    .default({ type: "none" }),
  // When the item counts as done.
  completeOn: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("click") }),
      z.object({ type: z.literal("event"), name: z.string().max(191) }),
      z.object({ type: z.literal("guide"), guideId: z.string() }),
    ])
    .default({ type: "click" }),
});

export const checklistContentSchema = z.object({
  title: z.string().max(200).default("Get started"),
  description: z.string().max(1000).default(""),
  items: z.array(checklistItemSchema).max(30).default([]),
  position: z.enum(["bottom-right", "bottom-left"]).default("bottom-right"),
});

export const announcementContentSchema = z.object({
  format: z.enum(["modal", "banner"]).default("modal"),
  title: z.string().max(200).default(""),
  body: z.string().max(4000).default(""),
  imageUrl: z.string().max(1000).default(""),
  buttonText: z.string().max(100).default("Got it"),
  // Optional link opened by the button.
  buttonUrl: z.string().max(1000).default(""),
});

export const hotspotSchema = z.object({
  id: z.string().min(1).max(64),
  selector: z.string().max(1000).default(""),
  title: z.string().max(200).default(""),
  body: z.string().max(2000).default(""),
  placement: z.enum(placements).default("auto"),
});

export const hotspotContentSchema = z.object({
  hotspots: z.array(hotspotSchema).max(30).default([]),
});

export const contentSchemas = {
  TOUR: tourContentSchema,
  CHECKLIST: checklistContentSchema,
  ANNOUNCEMENT: announcementContentSchema,
  HOTSPOT: hotspotContentSchema,
} as const;

export type GuideTypeName = keyof typeof contentSchemas;
export type TourStep = z.infer<typeof tourStepSchema>;
export type TourContent = z.infer<typeof tourContentSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type ChecklistContent = z.infer<typeof checklistContentSchema>;
export type AnnouncementContent = z.infer<typeof announcementContentSchema>;
export type Hotspot = z.infer<typeof hotspotSchema>;
export type HotspotContent = z.infer<typeof hotspotContentSchema>;

export function parseContent(type: GuideTypeName, raw: unknown) {
  return contentSchemas[type].parse(raw ?? {});
}

// ---------- Targeting ----------

export const urlRuleSchema = z.object({
  // contains / regex test the full URL; equals / starts_with test the path.
  op: z.enum(["contains", "equals", "starts_with", "regex"]),
  value: z.string().max(500),
});

export const userRuleSchema = z.object({
  attribute: z.string().min(1).max(100),
  op: z.enum(["equals", "not_equals", "contains", "gt", "lt", "exists", "not_exists"]),
  value: z.string().max(500).default(""),
});

export const targetingSchema = z.object({
  // Empty = every page. Any matching rule is enough.
  urlRules: z.array(urlRuleSchema).max(20).default([]),
  // All rules must match.
  userRules: z.array(userRuleSchema).max(20).default([]),
  // auto: shown when targeting matches. manual: only via start() or a checklist.
  trigger: z.enum(["auto", "manual"]).default("auto"),
  delaySeconds: z.number().int().min(0).max(600).default(0),
  // once: never again after completed or dismissed.
  // until_completed: comes back on the next page load after a dismissal.
  // always: every page load.
  frequency: z.enum(["once", "until_completed", "always"]).default("once"),
  // Include anonymous (not identified) visitors.
  includeAnonymous: z.boolean().default(false),
});

export type UrlRule = z.infer<typeof urlRuleSchema>;
export type UserRule = z.infer<typeof userRuleSchema>;
export type Targeting = z.infer<typeof targetingSchema>;

export function parseTargeting(raw: unknown): Targeting {
  return targetingSchema.parse(raw ?? {});
}

// ---------- Theme ----------

const color = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);

export const themeSchema = z.object({
  primaryColor: color.default("#4f46e5"),
  textColor: color.default("#1f2937"),
  backgroundColor: color.default("#ffffff"),
  radius: z.number().int().min(0).max(24).default(10),
  fontFamily: z.string().max(200).default("inherit"),
});

export type Theme = z.infer<typeof themeSchema>;

export function parseTheme(raw: unknown): Theme {
  return themeSchema.parse(raw ?? {});
}

export { matchesUrl, matchesUser } from "./targeting";

// Default content for a new guide of each type.
export function defaultContent(type: GuideTypeName) {
  switch (type) {
    case "TOUR":
      return tourContentSchema.parse({
        steps: [{ id: newId(), title: "Welcome!", body: "Let us show you around." }],
      });
    case "CHECKLIST":
      return checklistContentSchema.parse({
        items: [{ id: newId(), title: "Complete your profile" }],
      });
    case "ANNOUNCEMENT":
      return announcementContentSchema.parse({ title: "What's new", body: "" });
    case "HOTSPOT":
      return hotspotContentSchema.parse({ hotspots: [] });
  }
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}
