import { z } from "zod";
import { plainText } from "./format";

// Shapes of Guide.content / Guide.targeting / Workspace.theme. The SDK imports
// the inferred types from here, so keep this file free of server-only imports.

export const placements = ["auto", "top", "bottom", "left", "right"] as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);

export const urlRuleSchema = z.object({
  // contains / regex test the full URL; equals / starts_with test the path.
  op: z.enum(["contains", "equals", "starts_with", "regex"]),
  value: z.string().max(500),
});

// ---------- Blocks (content of tour steps and announcements) ----------

const align = z.enum(["left", "center", "right"]).default("left");
const blockId = z.string().min(1).max(64);

export const buttonActionSchema = z.discriminatedUnion("type", [
  // Tours: next / previous step. Announcements: "next" finishes like "complete".
  z.object({ type: z.literal("next") }),
  z.object({ type: z.literal("back") }),
  // Ends the guide as dismissed.
  z.object({ type: z.literal("close") }),
  // Ends the guide as completed.
  z.object({ type: z.literal("complete") }),
  z.object({ type: z.literal("url"), url: z.string().max(1000).default(""), newTab: z.boolean().default(true) }),
  // Completes this guide and starts another tour or announcement.
  z.object({ type: z.literal("guide"), guideId: z.string().max(64).default("") }),
]);

export const stepButtonSchema = z.object({
  id: blockId,
  label: z.string().max(60).default("Next"),
  style: z.enum(["primary", "secondary", "link"]).default("primary"),
  action: buttonActionSchema.default({ type: "next" }),
});

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), id: blockId, text: z.string().max(200).default(""), align }),
  z.object({ type: z.literal("text"), id: blockId, text: z.string().max(4000).default(""), align }),
  z.object({
    type: z.literal("image"),
    id: blockId,
    url: z.string().max(1000).default(""),
    alt: z.string().max(200).default(""),
    height: z.number().int().min(60).max(480).default(180),
    fit: z.enum(["cover", "contain"]).default("cover"),
    // Full card width, flush with the edges (hero style).
    edge: z.boolean().default(false),
    // Text drawn over the image (hero style).
    overlay: z.string().max(120).default(""),
  }),
  // YouTube, Vimeo, Loom, or a direct .mp4/.webm link.
  z.object({
    type: z.literal("video"),
    id: blockId,
    url: z.string().max(1000).default(""),
    // Starts muted (browsers only allow muted autoplay).
    autoplay: z.boolean().default(false),
    // autoplay + loop + no controls plays it like a GIF. A looping video never ends, so media_end can't fire.
    loop: z.boolean().default(false),
    controls: z.boolean().default(true),
  }),
  // An audio clip with a play button, e.g. a voice-over. byLocale: a recording per language; the rest get `url`.
  z.object({
    type: z.literal("audio"),
    id: blockId,
    url: z.string().max(1000).default(""),
    label: z.string().max(120).default(""),
    byLocale: z.record(z.string().max(35), z.string().max(1000)).default({}),
    autoplay: z.boolean().default(false),
  }),
  z.object({ type: z.literal("buttons"), id: blockId, align, buttons: z.array(stepButtonSchema).max(4).default([]) }),
  z.object({ type: z.literal("divider"), id: blockId }),
  z.object({ type: z.literal("spacer"), id: blockId, size: z.number().int().min(4).max(64).default(16) }),
]);

export const blockTypes = ["heading", "text", "image", "video", "audio", "buttons", "divider", "spacer"] as const;

// Automatic Back / Next / Done row at the bottom of tour steps.
export const footerSchema = z.object({
  show: z.boolean().default(true),
  showProgress: z.boolean().default(true),
  showBack: z.boolean().default(true),
  nextLabel: z.string().max(40).default("Next"),
  backLabel: z.string().max(40).default("Back"),
  doneLabel: z.string().max(40).default("Done"),
});

export const stepSizes = ["sm", "md", "lg"] as const;

// Steps saved before blocks existed had `title` and `body`; turn them into blocks.
function legacyStep(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray((raw as { blocks?: unknown }).blocks)) return raw;
  const r = raw as { title?: string; body?: string };
  const blocks = [];
  if (r.title) blocks.push({ type: "heading", id: newId(), text: r.title });
  if (r.body) blocks.push({ type: "text", id: newId(), text: r.body });
  return { ...r, blocks };
}

// What moves a tour step on. Saved before this was an object: "next" or "click".
export const advanceTypes = ["next", "click", "input", "element", "url", "event", "media_end"] as const;
export const inputFormats = ["any", "email", "url", "regex"] as const;

export const advanceSchema = z.preprocess(
  (raw) => (typeof raw === "string" ? { type: raw } : raw),
  z.discriminatedUnion("type", [
    // The Next button.
    z.object({ type: z.literal("next") }),
    // Clicking the target element.
    z.object({ type: z.literal("click") }),
    // The target field has a valid value.
    z.object({
      type: z.literal("input"),
      minLength: z.number().int().min(1).max(500).default(1),
      format: z.enum(inputFormats).default("any"),
      pattern: z.string().max(300).default(""),
    }),
    // Another element appears, e.g. the dialog the click opened.
    z.object({ type: z.literal("element"), selector: z.string().max(1000).default("") }),
    // The URL matches (multi-page tours).
    z.object({ type: z.literal("url"), rule: urlRuleSchema.default({ op: "contains", value: "" }) }),
    // The host app calls UserOnboarder.track(name).
    z.object({ type: z.literal("event"), name: z.string().max(191).default("") }),
    // A video (.mp4/.webm) or audio clip in the step plays to the end.
    z.object({ type: z.literal("media_end") }),
  ]),
);

export const tourStepSchema = z.preprocess(
  legacyStep,
  z.object({
    id: z.string().min(1).max(64),
    blocks: z.array(blockSchema).max(20).default([]),
    footer: footerSchema.prefault({}),
    size: z.enum(stepSizes).default("md"),
    // Empty selector = centered modal step.
    selector: z.string().max(1000).default(""),
    placement: z.enum(placements).default("auto"),
    advanceOn: advanceSchema.default({ type: "next" }),
    // Skipped when an element is (or isn't) on the page, e.g. "Open settings" when settings are open.
    skipIf: z
      .object({ when: z.enum(["never", "present", "absent"]).default("never"), selector: z.string().max(1000).default("") })
      .prefault({}),
    // Target not found: skip this step instead of ending the tour.
    optional: z.boolean().default(false),
    // Darken the rest of the page around the target.
    backdrop: z.boolean().default(true),
  }),
);

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

// Announcements saved before blocks existed had title/body/image/button fields.
function legacyAnnouncement(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray((raw as { blocks?: unknown }).blocks)) return raw;
  const r = raw as { title?: string; body?: string; imageUrl?: string; buttonText?: string; buttonUrl?: string };
  const blocks = [];
  if (r.imageUrl) blocks.push({ type: "image", id: newId(), url: r.imageUrl, edge: true });
  if (r.title) blocks.push({ type: "heading", id: newId(), text: r.title });
  if (r.body) blocks.push({ type: "text", id: newId(), text: r.body });
  const label = r.buttonText ?? "Got it";
  if (label) {
    blocks.push({
      type: "buttons",
      id: newId(),
      align: "right",
      buttons: [{ id: newId(), label, action: r.buttonUrl ? { type: "url", url: r.buttonUrl } : { type: "complete" } }],
    });
  }
  return { ...r, blocks };
}

export const bannerTones = ["brand", "info", "success", "warning"] as const;
const optionalColor = z.union([hexColor, z.literal("")]).default("");

// Banners run in their own slot next to tours, so both can show at once.
export const bannerSettingsSchema = z.object({
  position: z.enum(["top", "bottom"]).default("top"),
  // overlay: over the page. push: the page moves to make room.
  mode: z.enum(["overlay", "push"]).default("overlay"),
  tone: z.enum(bannerTones).default("brand"),
  // Override the tone's colors, e.g. to keep an imported banner's look. Empty: the tone's.
  background: optionalColor,
  textColor: optionalColor,
  // false: no close button (outages); targeting's "Show again" decides when it returns.
  dismissible: z.boolean().default(true),
  // Makes the banner text a link.
  link: z.object({ url: z.string().max(1000).default(""), newTab: z.boolean().default(true) }).prefault({}),
});

export const announcementContentSchema = z.preprocess(
  legacyAnnouncement,
  z.object({
    format: z.enum(["modal", "banner"]).default("modal"),
    size: z.enum(stepSizes).default("md"),
    blocks: z.array(blockSchema).max(20).default([]),
    banner: bannerSettingsSchema.prefault({}),
  }),
);

export const hotspotStyles = ["beacon", "icon"] as const;
export const hotspotIcons = ["help", "info"] as const;
export const hotspotOffsets = ["top-right", "top-left", "bottom-right", "bottom-left", "right", "left"] as const;

// Hotspots saved before blocks existed had `title` and `body`. The block ids
// come from the hotspot id so every parse gives the same ones.
function legacyHotspot(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray((raw as { blocks?: unknown }).blocks)) return raw;
  const { title, body, ...rest } = raw as { id?: string; title?: string; body?: string };
  const blocks = [];
  if (title) blocks.push({ type: "heading", id: `${rest.id}-t`, text: title });
  if (body) blocks.push({ type: "text", id: `${rest.id}-b`, text: body });
  return { ...rest, blocks };
}

// Translation key of a pre-blocks hotspot title/body, renamed to the blocks above.
export function legacyHotspotKey(key: string) {
  const m = /^hotspots\.([^.]+)\.(title|body)$/.exec(key);
  return m ? `hotspots.${m[1]}.blocks.${m[1]}-${m[2] === "title" ? "t" : "b"}.text` : key;
}

export const hotspotSchema = z.preprocess(
  legacyHotspot,
  z.object({
    id: z.string().min(1).max(64),
    selector: z.string().max(1000).default(""),
    blocks: z.array(blockSchema).max(20).default([]),
    size: z.enum(stepSizes).default("sm"),
    placement: z.enum(placements).default("auto"),
    // beacon: pulsing dot. icon: a still "?" or "i".
    style: z.enum(hotspotStyles).default("beacon"),
    icon: z.enum(hotspotIcons).default("help"),
    // Stays after it's been opened, for help people come back to.
    persistent: z.boolean().default(false),
    openOn: z.enum(["click", "hover"]).default("click"),
    // Which corner (or side) of the element it sits on.
    offset: z.enum(hotspotOffsets).default("top-right"),
  }),
);

export const hotspotContentSchema = z.object({
  hotspots: z.array(hotspotSchema).max(30).default([]),
});

// ---------- Inline card ----------

// Content placed inside the host page next to (or instead of) an element and
// scrolling with it: an empty state, a tip above a list.
export const inlinePositions = ["before", "after", "prepend", "append", "replace"] as const;

export const inlineContentSchema = z.object({
  selector: z.string().max(1000).default(""),
  // before / after: next to the element. prepend / append: inside it. replace: hides it while the card shows.
  position: z.enum(inlinePositions).default("before"),
  blocks: z.array(blockSchema).max(20).default([]),
  dismissible: z.boolean().default(true),
});

// ---------- Survey ----------

export const questionTypes = ["nps", "rating", "single", "multiple", "text"] as const;

export const surveyOptionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().max(200).default(""),
});

export const surveyQuestionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(questionTypes).default("nps"),
  title: z.string().max(300).default(""),
  description: z.string().max(1000).default(""),
  required: z.boolean().default(true),
  // single / multiple
  options: z.array(surveyOptionSchema).max(12).default([]),
  // rating: 1..scale
  scale: z.number().int().min(3).max(10).default(5),
  // nps / rating: words under the ends of the scale
  lowLabel: z.string().max(60).default(""),
  highLabel: z.string().max(60).default(""),
  // text
  placeholder: z.string().max(200).default(""),
});

export const surveyContentSchema = z.object({
  questions: z.array(surveyQuestionSchema).max(20).default([]),
  position: z.enum(["bottom-right", "bottom-left", "center"]).default("bottom-right"),
  showProgress: z.boolean().default(true),
  nextLabel: z.string().max(40).default("Next"),
  submitLabel: z.string().max(40).default("Submit"),
  thankYou: z
    .object({
      show: z.boolean().default(true),
      heading: z.string().max(200).default("Thank you!"),
      text: z.string().max(1000).default("Your feedback helps us improve."),
    })
    .prefault({}),
});

// ---------- Resource center ----------

// A help launcher that opens a panel of modules. One per page: the highest
// priority resource center whose targeting matches.

export const launcherIcons = ["help", "book", "chat", "sparkle", "rocket"] as const;
export const rcPositions = ["bottom-right", "bottom-left", "center-right", "center-left", "top-right", "top-left"] as const;

const rcGuideItemSchema = z.object({
  id: blockId,
  guideId: z.string().max(64).default(""),
  // Empty: the guide's name.
  label: z.string().max(120).default(""),
  description: z.string().max(300).default(""),
});

const rcLinkSchema = z.object({
  id: blockId,
  label: z.string().max(120).default(""),
  description: z.string().max(300).default(""),
  url: z.string().max(1000).default(""),
  newTab: z.boolean().default(true),
});

const rcArticleSchema = z.object({
  id: blockId,
  title: z.string().max(200).default(""),
  // One line under the title in the list; also searched.
  summary: z.string().max(300).default(""),
  blocks: z.array(blockSchema).max(30).default([]),
});

const moduleTitle = (fallback: string) => z.string().max(120).default(fallback);

export const rcModuleSchema = z.discriminatedUnion("type", [
  // Tours, announcements and surveys people can start (or restart) themselves.
  z.object({ type: z.literal("guides"), id: blockId, title: moduleTitle("Guides"), items: z.array(rcGuideItemSchema).max(30).default([]) }),
  // A checklist shown inline; its own corner launcher is hidden while the resource center is on the page.
  z.object({ type: z.literal("checklist"), id: blockId, guideId: z.string().max(64).default("") }),
  // Help articles written here, opened inside the panel.
  z.object({ type: z.literal("articles"), id: blockId, title: moduleTitle("Help articles"), articles: z.array(rcArticleSchema).max(50).default([]) }),
  z.object({ type: z.literal("links"), id: blockId, title: moduleTitle("Resources"), links: z.array(rcLinkSchema).max(30).default([]) }),
  // Articles from the workspace's knowledge base (src/lib/kb.ts), in the user's language. No collections picked: all of them.
  z.object({
    type: z.literal("knowledge"),
    id: blockId,
    title: moduleTitle("Knowledge base"),
    collectionIds: z.array(z.string().max(64)).max(50).default([]),
  }),
  // Latest posts from the workspace's product updates (src/lib/updates.ts), with an unread badge.
  z.object({
    type: z.literal("updates"),
    id: blockId,
    title: moduleTitle("What's new"),
    limit: z.number().int().min(1).max(20).default(3),
  }),
  z.object({
    type: z.literal("contact"),
    id: blockId,
    title: moduleTitle("Still need help?"),
    text: z.string().max(500).default("Our team usually answers within a day."),
    buttonLabel: z.string().max(60).default("Contact us"),
    // email: mailto link. url: opens a page. event: dispatches `user-onboarder:contact` on window so the
    // host app can open its own chat widget.
    action: z.enum(["email", "url", "event"]).default("email"),
    value: z.string().max(1000).default(""),
  }),
]);

export const rcModuleTypes = ["guides", "checklist", "updates", "knowledge", "articles", "links", "contact"] as const;

export const resourceCenterContentSchema = z.object({
  title: z.string().max(120).default("Help center"),
  subtitle: z.string().max(300).default("Find answers, take a tour, or get in touch."),
  launcher: z
    .object({
      // Hidden: open it from your own help button with UserOnboarder.openResourceCenter().
      show: z.boolean().default(true),
      label: z.string().max(40).default("Help"),
      icon: z.enum(launcherIcons).default("help"),
      // center-*: a vertical tab on the edge of the screen.
      position: z.enum(rcPositions).default("bottom-right"),
    })
    .prefault({}),
  search: z.boolean().default(true),
  modules: z.array(rcModuleSchema).max(20).default([]),
});

export const contentSchemas = {
  TOUR: tourContentSchema,
  CHECKLIST: checklistContentSchema,
  ANNOUNCEMENT: announcementContentSchema,
  HOTSPOT: hotspotContentSchema,
  SURVEY: surveyContentSchema,
  RESOURCE_CENTER: resourceCenterContentSchema,
  INLINE: inlineContentSchema,
} as const;

export type GuideTypeName = keyof typeof contentSchemas;
export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type StepButton = z.infer<typeof stepButtonSchema>;
export type ButtonAction = z.infer<typeof buttonActionSchema>;
export type StepFooter = z.infer<typeof footerSchema>;
export type StepSize = (typeof stepSizes)[number];
export type TourStep = z.infer<typeof tourStepSchema>;
export type Advance = z.infer<typeof advanceSchema>;
export type AdvanceType = Advance["type"];
export type BannerSettings = z.infer<typeof bannerSettingsSchema>;
export type InlineContent = z.infer<typeof inlineContentSchema>;
export type InlinePosition = (typeof inlinePositions)[number];
export type HotspotOffset = (typeof hotspotOffsets)[number];
export type TourContent = z.infer<typeof tourContentSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type ChecklistContent = z.infer<typeof checklistContentSchema>;
export type AnnouncementContent = z.infer<typeof announcementContentSchema>;
export type Hotspot = z.infer<typeof hotspotSchema>;
export type HotspotContent = z.infer<typeof hotspotContentSchema>;
export type QuestionType = (typeof questionTypes)[number];
export type SurveyQuestion = z.infer<typeof surveyQuestionSchema>;
export type SurveyContent = z.infer<typeof surveyContentSchema>;
export type SurveyAnswerValue = number | string | string[];
export type ResourceCenterContent = z.infer<typeof resourceCenterContentSchema>;
export type RcModule = z.infer<typeof rcModuleSchema>;
export type RcModuleType = RcModule["type"];
export type RcArticle = z.infer<typeof rcArticleSchema>;
export type LauncherIcon = (typeof launcherIcons)[number];
export type RcPosition = (typeof rcPositions)[number];

export function newRcModule(type: RcModuleType, guideId = ""): RcModule {
  const id = newId();
  switch (type) {
    case "guides":
      return rcModuleSchema.parse({ type, id, items: guideId ? [{ id: newId(), guideId }] : [] });
    case "checklist":
      return rcModuleSchema.parse({ type, id, guideId });
    case "articles":
      return rcModuleSchema.parse({
        type,
        id,
        articles: [
          {
            id: newId(),
            title: "Getting started",
            summary: "The basics in two minutes.",
            blocks: [{ type: "text", id: newId(), text: "Write your article here." }],
          },
        ],
      });
    case "links":
      return rcModuleSchema.parse({ type, id, links: [{ id: newId(), label: "Documentation", url: "" }] });
    case "contact":
    case "knowledge":
    case "updates":
      return rcModuleSchema.parse({ type, id });
  }
}

// Checks one answer against its question; returns the value to store, or null if invalid.
export function normalizeAnswer(q: SurveyQuestion, value: unknown): SurveyAnswerValue | null {
  switch (q.type) {
    case "nps":
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10 ? (value as number) : null;
    case "rating":
      return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= q.scale ? (value as number) : null;
    case "single":
      return typeof value === "string" && q.options.some((o) => o.id === value) ? value : null;
    case "multiple": {
      if (!Array.isArray(value)) return null;
      const ids = [...new Set(value.filter((v): v is string => typeof v === "string" && q.options.some((o) => o.id === v)))];
      return ids.length ? ids : null;
    }
    case "text": {
      const t = typeof value === "string" ? value.trim().slice(0, 2000) : "";
      return t || null;
    }
  }
}

export function newQuestion(type: QuestionType): SurveyQuestion {
  const base = { id: newId(), type };
  switch (type) {
    case "nps":
      return surveyQuestionSchema.parse({
        ...base,
        title: "How likely are you to recommend us to a friend or colleague?",
        lowLabel: "Not likely",
        highLabel: "Very likely",
      });
    case "rating":
      return surveyQuestionSchema.parse({ ...base, title: "How easy was that?", lowLabel: "Hard", highLabel: "Easy" });
    case "single":
    case "multiple":
      return surveyQuestionSchema.parse({
        ...base,
        title: type === "single" ? "What do you use us for most?" : "Which features do you use?",
        options: ["Option 1", "Option 2", "Option 3"].map((label) => ({ id: newId(), label })),
      });
    case "text":
      return surveyQuestionSchema.parse({ ...base, title: "Anything we could do better?", required: false, placeholder: "Type your answer" });
  }
}

export function parseContent(type: GuideTypeName, raw: unknown) {
  return contentSchemas[type].parse(raw ?? {});
}

// ---------- Targeting ----------

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
  // Optional schedule as ISO dates; empty = no limit. Checked by the server on init.
  startsAt: z.string().max(40).default(""),
  endsAt: z.string().max(40).default(""),
});

export type UrlRule = z.infer<typeof urlRuleSchema>;
export type UserRule = z.infer<typeof userRuleSchema>;
export type Targeting = z.infer<typeof targetingSchema>;

export function parseTargeting(raw: unknown): Targeting {
  return targetingSchema.parse(raw ?? {});
}

// ---------- Theme ----------

export const themeSchema = z.object({
  primaryColor: hexColor.default("#6847f5"),
  textColor: hexColor.default("#14152b"),
  backgroundColor: hexColor.default("#ffffff"),
  radius: z.number().int().min(0).max(24).default(14),
  fontFamily: z.string().max(200).default("inherit"),
});

export type Theme = z.infer<typeof themeSchema>;

export function parseTheme(raw: unknown): Theme {
  return themeSchema.parse(raw ?? {});
}

export { inSchedule, matchesUrl, matchesUser } from "./targeting";

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
      return announcementContentSchema.parse({ title: "What's new", body: "", buttonText: "Got it" });
    case "HOTSPOT":
      return hotspotContentSchema.parse({ hotspots: [] });
    case "SURVEY":
      return surveyContentSchema.parse({ questions: [newQuestion("nps"), newQuestion("text")] });
    case "RESOURCE_CENTER":
      return resourceCenterContentSchema.parse({
        modules: [newRcModule("guides"), newRcModule("articles"), newRcModule("contact")],
      });
    case "INLINE":
      return inlineContentSchema.parse({
        blocks: [
          { type: "heading", id: newId(), text: "Nothing here yet" },
          { type: "text", id: newId(), text: "Here's how to get started in two minutes." },
          { type: "buttons", id: newId(), align: "left", buttons: [{ id: newId(), label: "Show me", action: { type: "complete" } }] },
        ],
      });
  }
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

// Short label for a step in lists and analytics: its first heading or text.
export function blocksLabel(blocks: Block[]) {
  for (const b of blocks) {
    if ((b.type === "heading" || b.type === "text") && b.text.trim()) return plainText(b.text.trim().split("\n")[0]).slice(0, 80);
  }
  return "";
}

export function newBlock(type: BlockType): Block {
  return blockSchema.parse(
    type === "buttons"
      ? { type, id: newId(), align: "right", buttons: [{ id: newId(), label: "Next", action: { type: "next" } }] }
      : { type, id: newId() },
  );
}
