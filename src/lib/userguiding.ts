import "server-only";
import {
  checklistContentSchema,
  footerSchema,
  newId,
  parseTargeting,
  tourContentSchema,
  type Block,
  type ButtonAction,
  type ChecklistContent,
  type StepSize,
  type Targeting,
  type Theme,
  type TourContent,
  type TourStep,
  type UrlRule,
} from "./guide-schema";

// Import from UserGuiding. UserGuiding has no export, but its embed script loads
// every published guide from a public JSON file per container:
//   https://sdk.userguiding.com/sdk-<containerId>.json   (EU: eu-sdk.userguiding.com)
// This module converts that file into our guides. The format is undocumented, so
// everything here is defensive: unknown parts are skipped and reported.

export type UgImportKind = "TOUR" | "CHECKLIST";

export type UgCandidate = {
  ugId: number;
  kind: UgImportKind;
  name: string;
  active: boolean;
  stepCount: number;
  warnings: string[];
  content: TourContent | ChecklistContent;
  targeting: Targeting;
  priority: number;
};

export type UgConversion = {
  containerTitle: string;
  candidates: UgCandidate[];
  theme: Theme | null;
  // Things in the account we don't import at all (counts by kind).
  skipped: string[];
};

/* eslint-disable @typescript-eslint/no-explicit-any -- untyped third-party JSON */

const HOSTS = ["https://sdk.userguiding.com", "https://eu-sdk.userguiding.com"];

// Container id from a raw id, a snippet, or an embed-script URL.
export function parseContainerId(input: string): string | null {
  const s = input.trim();
  const fromUrl = s.match(/user-guiding-([A-Za-z0-9]+)-embedded\.js/);
  if (fromUrl) return fromUrl[1];
  const fromSnippet = s.match(/["']userGuidingLayer["']\s*,\s*["']([A-Za-z0-9]+)["']/);
  if (fromSnippet) return fromSnippet[1];
  return /^[A-Za-z0-9]{6,32}$/.test(s) ? s : null;
}

export async function fetchUserGuidingData(containerId: string): Promise<any> {
  for (const host of HOSTS) {
    const res = await fetch(`${host}/sdk-${containerId}.json?t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) return res.json();
  }
  throw new Error("No UserGuiding data found for that container id. Check the id in your UserGuiding snippet.");
}

// ---------- Rich text (Draft.js) ----------

function wrap(seg: string, mark: string) {
  const core = seg.trim();
  if (!core) return seg;
  const lead = seg.match(/^\s*/)![0];
  const trail = seg.match(/\s*$/)![0];
  return `${lead}${mark}${core}${mark}${trail}`;
}

function inlineText(block: any, entityMap: Record<string, any>, allowBold = true) {
  const text: string = block.text ?? "";
  const n = text.length;
  const bold = new Array<boolean>(n).fill(false);
  const italic = new Array<boolean>(n).fill(false);
  const link = new Array<string | null>(n).fill(null);
  for (const r of block.inlineStyleRanges ?? []) {
    const arr = r.style === "BOLD" ? bold : r.style === "ITALIC" ? italic : null;
    if (arr) for (let i = r.offset; i < Math.min(n, r.offset + r.length); i++) arr[i] = true;
  }
  for (const r of block.entityRanges ?? []) {
    const e = entityMap[String(r.key)];
    const url = e?.type === "LINK" ? e.data?.url || e.data?.href : null;
    if (url) for (let i = r.offset; i < Math.min(n, r.offset + r.length); i++) link[i] = String(url);
  }
  let out = "";
  for (let i = 0; i < n; ) {
    let j = i + 1;
    while (j < n && bold[j] === bold[i] && italic[j] === italic[i] && link[j] === link[i]) j++;
    let seg = text.slice(i, j);
    if (link[i]) seg = `[${seg.trim()}](${link[i]})`;
    if (italic[i]) seg = wrap(seg, "*");
    if (bold[i] && allowBold) seg = wrap(seg, "**");
    out += seg;
    i = j;
  }
  return out;
}

const alignOf = (a: unknown): "left" | "center" | "right" => (a === "center" || a === "right" ? a : "left");

function draftToBlocks(draft: any): Block[] {
  const out: Block[] = [];
  const entityMap = draft.entityMap ?? {};
  let lines: string[] = [];
  let lineAlign: "left" | "center" | "right" = "left";
  let ordered = 0;
  const flush = () => {
    const text = lines.join("\n").replace(/^\n+|\n+$/g, "").replace(/\n{3,}/g, "\n\n");
    if (text.trim()) out.push({ type: "text", id: newId(), text: text.slice(0, 4000), align: lineAlign });
    lines = [];
  };
  for (const b of draft.blocks ?? []) {
    const type: string = b.type ?? "unstyled";
    if (/^header-/.test(type)) {
      flush();
      const text = inlineText(b, entityMap, false).trim();
      if (text) out.push({ type: "heading", id: newId(), text: text.slice(0, 200), align: alignOf(b.data?.textAlignment) });
      ordered = 0;
      continue;
    }
    if (!lines.length) lineAlign = alignOf(b.data?.textAlignment);
    const t = inlineText(b, entityMap);
    if (type === "unordered-list-item") lines.push(`• ${t}`);
    else if (type === "ordered-list-item") lines.push(`${++ordered}. ${t}`);
    else {
      ordered = 0;
      lines.push(t);
    }
  }
  flush();
  return out;
}

// Fallback when a text component only has HTML.
function htmlToBlocks(html: string): Block[] {
  const out: Block[] = [];
  const decode = (s: string) =>
    s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const inline = (s: string) =>
    decode(
      s
        .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
        .replace(/<(strong|b)>(.*?)<\/\1>/gi, "**$2**")
        .replace(/<(em|i)>(.*?)<\/\1>/gi, "*$2*")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, ""),
    );
  let lines: string[] = [];
  const flush = () => {
    const text = lines.join("\n").trim();
    if (text) out.push({ type: "text", id: newId(), text: text.slice(0, 4000), align: "left" });
    lines = [];
  };
  for (const m of html.matchAll(/<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const tag = m[1].toLowerCase();
    if (tag.startsWith("h")) {
      flush();
      const t = inline(m[2]).replace(/\*\*/g, "").trim();
      if (t) out.push({ type: "heading", id: newId(), text: t.slice(0, 200), align: "left" });
    } else lines.push(tag === "li" ? `• ${inline(m[2])}` : inline(m[2]));
  }
  flush();
  return out;
}

// ---------- Steps ----------

function bestSelector(paths: unknown): string {
  const list = Array.isArray(paths) ? paths.filter((p): p is string => typeof p === "string" && p.length > 0) : [];
  const score = (p: string) =>
    (/#[A-Za-z][\w-]*/.test(p) && !/#[\w-]*\d{3,}/.test(p) ? 3 : 0) +
    (/\[data-[\w-]+=/.test(p) ? 4 : 0) -
    (/ng-tns-|_ngcontent|ng-star-inserted|css-[a-z0-9]{5,}/.test(p) ? 20 : 0) -
    (p.match(/:nth-child|:nth-of-type/g)?.length ?? 0) -
    p.length / 200;
  return [...list].sort((a, b) => score(b) - score(a))[0] ?? "";
}

const placementMap: Record<string, TourStep["placement"]> = { top: "top", bottom: "bottom", left: "left", right: "right" };

function placementOf(s: any): TourStep["placement"] {
  if (s.tooltipPlacementType !== "custom") return "auto";
  const pos = String(s.tooltipPlacementPosition ?? "").match(/^(top|bottom|left|right)/)?.[1];
  return pos ? placementMap[pos] : "auto";
}

function sizeOf(px: number, modal: boolean): StepSize {
  if (modal) return px <= 400 ? "sm" : px <= 520 ? "md" : "lg";
  return px <= 300 ? "sm" : px <= 390 ? "md" : "lg";
}

function videoSrc(raw: unknown): string {
  const s = String(raw ?? "");
  return s.match(/src="([^"]+)"/)?.[1] ?? s.trim();
}

type Ctx = { warnings: Set<string>; images: Set<string>; anyDomain: boolean };

function buttonAction(a: any, ctx: Ctx): ButtonAction {
  switch (a?.actionType) {
    case "next":
      return { type: "next" };
    case "prev":
    case "back":
      return { type: "back" };
    case "finish":
    case "complete":
      return { type: "complete" };
    case "close":
    case "dismiss":
      return { type: "close" };
    case "guide":
      // Rewritten to our guide id after all guides are created.
      return { type: "guide", guideId: `ug:${a.actionTarget}` };
    case "url":
    case "link":
    case "redirect":
      return { type: "url", url: String(a.actionTarget ?? ""), newTab: a.actionPayload?.newTab !== false };
    case "js":
      ctx.warnings.add("A button ran JavaScript (for example opening the Resource Center); it now finishes the guide instead.");
      return { type: "complete" };
    default:
      ctx.warnings.add(`A button action "${a?.actionType ?? "unknown"}" isn't supported; it now goes to the next step.`);
      return { type: "next" };
  }
}

function componentsToBlocks(rows: any[], ctx: Ctx): { blocks: Block[]; hasButtons: boolean } {
  const blocks: Block[] = [];
  let hasButtons = false;
  for (const row of Array.isArray(rows) ? rows : []) {
    const buttons: Extract<Block, { type: "buttons" }>["buttons"] = [];
    let buttonAlign: "left" | "center" | "right" = "right";
    for (const c of Array.isArray(row) ? row : []) {
      const content = c?.content ?? {};
      switch (c?.type) {
        case "text":
          blocks.push(...(content.draft?.blocks ? draftToBlocks(content.draft) : content.html ? htmlToBlocks(content.html) : []));
          break;
        case "image": {
          const url = String(content.publicUrl ?? content.url ?? "");
          if (!url) break;
          const p = c.paddings ?? {};
          const edge = [p.top, p.left, p.right, p.bottom].every((v) => !v);
          ctx.images.add(url);
          blocks.push({
            type: "image",
            id: newId(),
            url,
            alt: "",
            height: Math.min(480, Math.max(60, Math.round(Number(content.imageHeight) || 180))),
            fit: "contain",
            edge,
            overlay: "",
          });
          break;
        }
        case "video": {
          const url = videoSrc(content.videoUrl ?? content.url);
          if (url) blocks.push({ type: "video", id: newId(), url: url.slice(0, 1000) });
          break;
        }
        case "button":
          hasButtons = true;
          buttonAlign = alignOf(content.alignment);
          if (buttons.length < 4) {
            buttons.push({
              id: newId(),
              label: String(content.buttonContent ?? "Next").slice(0, 60),
              style: "primary",
              action: buttonAction(content.action, ctx),
            });
          }
          break;
        default:
          ctx.warnings.add(`A "${c?.type}" element isn't supported and was left out.`);
      }
    }
    if (buttons.length) {
      // Secondary look for all but the last button in a row.
      buttons.forEach((b, i) => (b.style = i === buttons.length - 1 ? "primary" : "secondary"));
      blocks.push({ type: "buttons", id: newId(), align: buttonAlign, buttons });
    }
  }
  return { blocks: blocks.slice(0, 20), hasButtons };
}

function convertStep(s: any, theme: any, ctx: Ctx): TourStep | null {
  const modal = s.type === "modal";
  const { blocks, hasButtons } = componentsToBlocks(s.components, ctx);
  const selector = modal ? "" : bestSelector(s.cssPaths);
  if (!modal && !selector) ctx.warnings.add("A step had no usable element selector; it shows as a centered modal. Re-pick its element in the builder.");
  const advanceOn = s.type === "clickContent" && selector ? "click" : "next";
  const req = s.requisiteButtons?.buttonContents ?? {};
  const widthPx = s.fixedWidthActive
    ? Number(s.fixedWidthPixel)
    : Number(modal ? theme?.preview?.modalWidthPx : theme?.preview?.tooltipWidthPx) || (modal ? 432 : 360);

  return {
    id: newId(),
    blocks,
    footer: footerSchema.parse({
      // Steps with their own buttons or click-to-continue don't need the Next/Back row.
      show: Boolean(s.requisiteButtonsActive) || (!hasButtons && advanceOn !== "click"),
      showProgress: theme?.preview?.progressNumberActive !== false,
      nextLabel: String(req.next ?? "Next").slice(0, 40),
      backLabel: String(req.back ?? req.previous ?? "Back").slice(0, 40),
      doneLabel: String(req.done ?? req.finish ?? "Done").slice(0, 40),
    }),
    size: sizeOf(widthPx, modal),
    selector,
    placement: placementOf(s),
    advanceOn,
    backdrop: !s.noBackdrop,
  };
}

// ---------- Targeting ----------

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// UserGuiding equation codes seen in the wild: "4" = contains, "2" = equals.
// targeting_condition 1 = all rules must match, 2 = any rule.
function urlRules(startUrls: any[], condition: unknown, ctx: Ctx): UrlRule[] {
  // With anyDomain, "https://cms.example.com/#/x" becomes "/#/x" so test and local copies match too.
  const strip = (v: string) => (ctx.anyDomain ? v.replace(/^https?:\/\/[^/]+/i, "") || "/" : v);
  const rules = (Array.isArray(startUrls) ? startUrls : [])
    .map((u) => {
      const raw = String(u?.value ?? "").trim();
      return { eq: String(u?.equation ?? ""), value: strip(raw), hadOrigin: /^https?:\/\//i.test(raw) };
    })
    .filter((u) => u.value && u.value !== "*");
  if (!rules.length) return [];
  for (const r of rules) if (r.eq !== "4" && r.eq !== "2") ctx.warnings.add(`A page rule of an unknown type was imported as "URL contains ${r.value}". Check it.`);
  const pattern = (r: { eq: string; value: string; hadOrigin: boolean }) =>
    r.eq === "2" ? `^${r.hadOrigin && ctx.anyDomain ? "https?://[^/]+" : ""}${escapeRe(r.value)}/?$` : escapeRe(r.value);

  if (Number(condition) === 1 && rules.length > 1) {
    // All must match: one regex with a lookahead per rule.
    return [{ op: "regex", value: `^${rules.map((r) => `(?=${r.eq === "2" ? pattern(r) : `.*${pattern(r)}`})`).join("")}`.slice(0, 500) }];
  }
  return rules.slice(0, 20).map((r) => (r.eq === "2" ? { op: "regex" as const, value: pattern(r).slice(0, 500) } : { op: "contains" as const, value: r.value.slice(0, 500) }));
}

function baseTargeting(src: any, ctx: Ctx, trigger: "auto" | "manual", delaySeconds = 0): Targeting {
  if (src.segment_type && src.segment_type !== "all") ctx.warnings.add("User segments aren't imported; it now shows to every identified user. Add user rules on the Targeting tab.");
  if (src.is_scheduled) ctx.warnings.add("Scheduling isn't imported.");
  const freq = src.appearance_frequency;
  return parseTargeting({
    urlRules: urlRules(src.start_urls, src.targeting_condition, ctx),
    trigger,
    delaySeconds: Math.min(600, Math.max(0, Math.round(Number(delaySeconds) || 0))),
    frequency: freq === "always" ? "always" : freq === "only_once" || !freq ? "once" : "until_completed",
  });
}

// ---------- Whole file ----------

export function convertUserGuiding(data: any, opts: { anyDomain?: boolean } = {}): UgConversion {
  const anyDomain = opts.anyDomain ?? true;
  const theme = Array.isArray(data?.themes) ? (data.themes.find((t: any) => t.is_default) ?? data.themes[0]) : null;
  const candidates: UgCandidate[] = [];

  for (const g of Array.isArray(data?.guides) ? data.guides : []) {
    const ctx: Ctx = { warnings: new Set(), images: new Set(), anyDomain };
    const steps = (Array.isArray(g.steps) ? g.steps : []).map((s: any) => convertStep(s, theme, ctx)).filter(Boolean) as TourStep[];
    if (Array.isArray(g.localizations) && g.localizations.length) ctx.warnings.add("Translations aren't imported; only the default language is.");
    candidates.push({
      ugId: Number(g.id),
      kind: "TOUR",
      name: String(g.title || `UserGuiding guide ${g.id}`).slice(0, 191),
      active: Boolean(g.is_active),
      stepCount: steps.length,
      content: tourContentSchema.parse({ steps: steps.slice(0, 50) }),
      targeting: baseTargeting(g, ctx, g.trigger_type === "auto" ? "auto" : "manual", g.steps?.[0]?.showAfter),
      priority: Math.max(-100, Math.min(100, Math.round(Number(g.display_priority) || 0))),
      warnings: [...ctx.warnings],
    });
  }

  for (const a of Array.isArray(data?.assistants) ? data.assistants : []) {
    const d = a?.data ?? {};
    if (d.format && d.format !== "checklist") continue;
    const ctx: Ctx = { warnings: new Set(), images: new Set(), anyDomain };
    const items = (Array.isArray(d.modules) ? d.modules : [])
      .slice()
      .sort((x: any, y: any) => (Number(x.order) || 0) - (Number(y.order) || 0))
      .flatMap((m: any) => {
        if (m.type === "checklistGuide" && m.id) {
          return [{ id: newId(), title: String(m.header || "Untitled").slice(0, 200), description: "", action: { type: "tour", guideId: `ug:${m.id}` }, completeOn: { type: "guide", guideId: `ug:${m.id}` } }];
        }
        if (m.url || m.link) {
          return [{ id: newId(), title: String(m.header || m.title || "Link").slice(0, 200), description: "", action: { type: "url", url: String(m.url || m.link) }, completeOn: { type: "click" } }];
        }
        ctx.warnings.add(`A checklist item of type "${m.type}" isn't supported and was left out.`);
        return [];
      });
    if (d.itemsOrderLocked) ctx.warnings.add("Locked item order isn't supported; items can be done in any order.");
    candidates.push({
      ugId: Number(a.id),
      kind: "CHECKLIST",
      name: String(d.title || d.assistantTitle || `UserGuiding checklist ${a.id}`).slice(0, 191),
      active: d.is_active !== false,
      stepCount: items.length,
      content: checklistContentSchema.parse({
        title: String(d.launcherText || d.assistantTitle || "Get started").slice(0, 200),
        description: String(d.assistantSubtitle ?? "").slice(0, 1000),
        items: items.slice(0, 30),
        position: Number(d.leftEdge) > 0 && Number(d.leftEdge) < 50 ? "bottom-left" : "bottom-right",
      }),
      targeting: baseTargeting({ ...d, segment_type: d.segment_type ?? "all" }, ctx, "auto"),
      priority: 0,
      warnings: [...ctx.warnings],
    });
  }

  const skipped: string[] = [];
  const count = (key: string, label: string) => {
    const v = data?.[key];
    const n = Array.isArray(v) ? v.length : 0;
    if (n) skipped.push(`${n} ${label}`);
  };
  count("hotspots", "hotspot group(s)");
  count("banners", "banner(s)");
  count("surveys", "survey(s)");
  count("resourceCenters", "resource center(s)");
  const otherAssistants = (data?.assistants ?? []).filter((a: any) => a?.data?.format && a.data.format !== "checklist").length;
  if (otherAssistants) skipped.push(`${otherAssistants} assistant(s) that aren't checklists`);

  return {
    containerTitle: String(data?.container?.title ?? data?.project?.name ?? ""),
    candidates,
    theme: theme ? themeFrom(theme.preview ?? {}) : null,
    skipped,
  };
}

function themeFrom(p: any): Theme {
  const color = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fallback);
  const font = String(p.customFontCss ?? "").match(/font-family:\s*([^;]+)/)?.[1]?.trim();
  return {
    primaryColor: color(p.buttonBackgroundColor ?? p.progressColor, "#4f46e5"),
    textColor: color(p.bodyTextColor, "#1f2937"),
    backgroundColor: color(p.backgroundColor, "#ffffff"),
    radius: p.boxRoundness === "square" ? 0 : p.boxRoundness === "round" ? 14 : 8,
    fontFamily: font ? `${font}, system-ui, sans-serif`.slice(0, 200) : "inherit",
  };
}

// Every image URL used by the converted content, so they can be copied.
export function imageUrls(content: TourContent | ChecklistContent): string[] {
  if (!("steps" in content)) return [];
  return content.steps.flatMap((s) => s.blocks.flatMap((b) => (b.type === "image" && b.url ? [b.url] : [])));
}

// Rewrites "ug:<id>" guide references once the imported guides have ids.
export function relinkGuides<T>(content: T, idMap: Map<string, string>, warn: (msg: string) => void): T {
  const fix = (ref: string) => {
    if (!ref.startsWith("ug:")) return ref;
    const id = idMap.get(ref.slice(3));
    if (!id) warn("A button or item pointed at a UserGuiding guide that wasn't imported; pick another guide for it.");
    return id ?? "";
  };
  return JSON.parse(
    JSON.stringify(content, (_k, v) => (v && typeof v === "object" && typeof v.guideId === "string" ? { ...v, guideId: fix(v.guideId) } : v)),
  );
}
