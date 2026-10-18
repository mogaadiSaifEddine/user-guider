import "server-only";
import { GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import { z } from "zod";

// AI drafting of tours and hotspots from a snapshot of the customer's page,
// taken by the SDK's builder mode: a marked screenshot plus a list of the
// boxed elements. Gemini only picks elements by id; it never writes
// selectors, so every step points at something real.

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function aiEnabled() {
  return Boolean(process.env.GEMINI_API_KEY);
}

const text = (max: number) => z.string().max(max).optional();

export const snapshotSchema = z.object({
  url: z.string().max(2000),
  path: z.string().max(300).default(""),
  title: z.string().max(300).default(""),
  lang: z.string().max(20).default(""),
  description: z.string().max(500).default(""),
  viewport: z.object({ w: z.number(), h: z.number() }).optional(),
  // Older builders sent plain strings.
  headings: z
    .array(z.union([z.string().max(200), z.object({ level: z.number().int(), text: z.string().max(200) })]))
    .max(80)
    .default([]),
  text: z.string().max(4000).default(""),
  elements: z
    .array(
      z.object({
        id: z.number().int().min(0),
        tag: z.string().max(30),
        role: text(40),
        type: text(30),
        text: text(120),
        label: text(120),
        hint: text(160),
        placeholder: text(120),
        href: text(300),
        region: text(40),
        section: text(120),
        onboarding: text(100),
        current: z.boolean().optional(),
        disabled: z.boolean().optional(),
        prominent: z.boolean().optional(),
        repeated: z.number().int().optional(),
        inView: z.boolean().optional(),
        selector: z.string().min(1).max(1000),
        rect: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
      }),
    )
    .max(250),
});

export const generateSchema = z.object({
  kind: z.enum(["TOUR", "HOTSPOT"]),
  goal: z.string().max(1000).default(""),
  maxItems: z.number().int().min(1).max(15).default(6),
  // Titles already in the guide, so an "add more" run doesn't repeat them.
  existing: z.array(z.string().max(200)).max(50).default([]),
  // JPEG (base64) of the viewport with numbered boxes on the elements.
  screenshot: z.string().max(4_000_000).optional(),
  snapshot: snapshotSchema,
});

export type GenerateInput = z.infer<typeof generateSchema>;
export type DraftItem = { selector: string; title: string; body: string };
type Snapshot = z.infer<typeof snapshotSchema>;
type SnapElement = Snapshot["elements"][number];

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const SYSTEM = `You are a senior product onboarding designer. You write in-app guides (product tours and hotspots) that help people succeed with a web application.

You get ONE page of the app:
- possibly a screenshot of the visible part of the page, where interactive elements have red boxes with their id number (form fields are greyed out on purpose);
- the page's address, headings and visible text;
- the list of interactive elements, one per line: "#id tag "visible text" label=… section=… region=… [flags]".
  Flags: current = link to the page the user is already on; disabled; primary = a prominent filled button; repeated×N = first of N identical list rows; offscreen = not visible without scrolling.

Work like a designer, in this order:
1. Understand the page: what it is for, who uses it, what they're trying to get done. Use the product description and author's goal if given.
2. Identify the main task on this page and the order a user works through it.
3. Choose the few elements that matter most for that task: things a new user must find or understand to succeed. Good picks: the page's primary action; inputs or settings that change the outcome and aren't self-explanatory; tabs or sections that hide important options; valuable features that are easy to miss.
4. Write the content.

Never pick:
- the link to the page the user is on (flag current), or generic navigation, unless the goal is to orient a brand-new user across the app;
- self-explanatory controls (Save, Cancel, Close, Back, Next, a search box with an obvious placeholder) unless they behave unusually;
- disabled elements; destructive or exit actions (delete, remove, archive, unpublish, sign out, cancel subscription);
- individual data rows or records (flag repeated, or anything that looks like user content such as a specific project or person);
- anything you can't identify confidently from its label, section and position.

Writing rules:
- Title: 2–6 words, the task or benefit in the user's terms ("Choose who sees it"), not the widget ("Targeting tab").
- Body: one or two sentences, at most about 30 words. Say what it does and why or when to use it, or what happens next. Be specific: use the real labels and options on this page. Put a UI label in **bold** when you mention it.
- Never write tautologies or filler: "Click Save to save", "This is the X button", "Use this to manage X", "Here you can…", "This section allows you to…". No hype words (powerful, seamless, effortlessly, robust), no emojis.
- Second person, present tense, plain language.
- Language: the BCP 47 code in "lang"; if it's empty, the language of the page text.

Example of a bad step: {"title": "Done when dropdown", "body": "Use this dropdown to select when the item is done."}
Example of a good step: {"title": "Decide what ticks it off", "body": "**Done when** sets what completes this item: a click, an event your app sends, or finishing another guide."}`;

function tourInstructions(maxItems: number) {
  return `Create a product tour with at most ${maxItems} steps. Fewer, sharper steps beat covering everything: use only as many as the main task needs.
Order the steps the way a user works through the task.
The first step may be a welcome step with "elementId": null (a centered modal), but only if it adds context the other steps don't: one sentence on what this page lets the user achieve. All other steps need an elementId.`;
}

function hotspotInstructions(maxItems: number) {
  return `Create at most ${maxItems} hotspots: small independent hints on features that are useful but easy to miss or misunderstand. Each must make sense on its own (no order). Every hotspot needs an elementId. Don't use the page's obvious primary button.`;
}

const responseSchema = (isTour: boolean) => ({
  type: "object",
  properties: {
    pageSummary: { type: "string", description: "What this page is for and who uses it, in one or two sentences." },
    mainTask: { type: "string", description: "The main task a user does on this page, and its steps in order." },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          elementId: isTour
            ? { type: ["integer", "null"], description: "id from the element list, or null for a centered welcome step" }
            : { type: "integer", description: "id from the element list" },
          why: { type: "string", description: "Why this element matters for the main task (not shown to users)." },
          title: { type: "string" },
          body: { type: "string" },
        },
        required: ["elementId", "why", "title", "body"],
      },
    },
  },
  required: ["pageSummary", "mainTask", "steps"],
});

const answerSchema = z.object({
  pageSummary: z.string().optional(),
  mainTask: z.string().optional(),
  steps: z.array(z.object({ elementId: z.number().int().nullable(), title: z.string(), body: z.string() })),
});

const q = (s: string) => JSON.stringify(s);

function elementLine(e: SnapElement) {
  const parts = [`#${e.id}`, e.role ? `${e.tag}[${e.role}]` : e.tag];
  if (e.type) parts.push(`type=${e.type}`);
  if (e.text) parts.push(q(e.text));
  if (e.label && e.label !== e.text) parts.push(`label=${q(e.label)}`);
  if (e.placeholder) parts.push(`placeholder=${q(e.placeholder)}`);
  if (e.hint) parts.push(`hint=${q(e.hint)}`);
  if (e.href) parts.push(`href=${q(e.href)}`);
  if (e.section) parts.push(`section=${q(e.section)}`);
  if (e.region) parts.push(`region=${e.region}`);
  if (e.onboarding) parts.push(`tag=${q(e.onboarding)}`);
  const flags = [
    e.current && "current",
    e.disabled && "disabled",
    e.prominent && "primary",
    e.repeated && `repeated×${e.repeated}`,
    e.inView === false && "offscreen",
  ].filter(Boolean);
  if (flags.length) parts.push(`[${flags.join(", ")}]`);
  parts.push(`at ${Math.round(e.rect.x)},${Math.round(e.rect.y)} ${Math.round(e.rect.w)}×${Math.round(e.rect.h)}`);
  return parts.join(" ");
}

function pageBlock(s: Snapshot) {
  const headings = s.headings.map((h) => (typeof h === "string" ? `- ${h}` : `${"  ".repeat(Math.max(0, h.level - 1))}- ${h.text}`));
  return [
    `Address: ${s.url}`,
    s.title && `Title: ${s.title}`,
    `lang: ${s.lang || "(empty)"}`,
    s.description && `Description: ${s.description}`,
    headings.length ? `Headings:\n${headings.join("\n")}` : "",
    s.text && `Visible text (truncated):\n${s.text}`,
    `Interactive elements:\n${s.elements.map(elementLine).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const DESTRUCTIVE = /\b(delete|remove|archive|unpublish|sign ?out|log ?out|deactivate|cancel (?:subscription|plan)|supprimer|eyða|löschen|eliminar)\b/i;

export async function draftGuide(input: GenerateInput, productContext = ""): Promise<DraftItem[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError("AI isn't set up on this server (GEMINI_API_KEY is missing).", 503);
  if (!input.snapshot.elements.length) throw new AiError("No visible buttons, links or fields found on this page.", 422);

  const isTour = input.kind === "TOUR";
  const prompt = [
    isTour ? tourInstructions(input.maxItems) : hotspotInstructions(input.maxItems),
    productContext.trim() ? `About the product (from the team that builds it):\n${productContext.trim()}` : "",
    input.goal.trim()
      ? `Author's goal for this guide (highest priority; only cover what serves it):\n${input.goal.trim()}`
      : "No goal given: cover what a new user of this page needs most to complete its main task.",
    input.existing.length ? `The guide already covers these; don't repeat them:\n${input.existing.map((t) => `- ${t}`).join("\n")}` : "",
    input.screenshot ? "The screenshot shows the visible part of the page; box numbers match element ids." : "No screenshot available: rely on the text below.",
    pageBlock(input.snapshot),
  ]
    .filter(Boolean)
    .join("\n\n");

  const parts: Part[] = [{ text: prompt }];
  if (input.screenshot) parts.push({ inlineData: { mimeType: "image/jpeg", data: input.screenshot } });

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  let raw: string | undefined;
  try {
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseJsonSchema: responseSchema(isTour),
        temperature: 0.4,
        // Gemini 3 models think before answering; "low" keeps drafting to a few seconds.
        ...(/gemini-3/.test(model) ? { thinkingConfig: { thinkingLevel: (process.env.GEMINI_THINKING as ThinkingLevel) || ThinkingLevel.LOW } } : {}),
      },
    });
    raw = res.text;
  } catch (e) {
    console.error("[ai] Gemini request failed", e);
    throw new AiError("The AI service didn't answer. Try again in a moment.", 502);
  }

  let parsed: z.infer<typeof answerSchema>;
  try {
    parsed = answerSchema.parse(JSON.parse(raw ?? ""));
  } catch {
    console.error("[ai] unexpected Gemini output", raw?.slice(0, 500));
    throw new AiError("The AI returned something unusable. Try again.", 502);
  }

  // Map ids back to selectors and drop anything that breaks the rules.
  const byId = new Map(input.snapshot.elements.map((e) => [e.id, e]));
  const used = new Set<number>();
  const items: DraftItem[] = [];
  for (const s of parsed.steps) {
    if (items.length >= input.maxItems) break;
    let selector = "";
    if (s.elementId !== null) {
      const el = byId.get(s.elementId);
      if (!el || used.has(s.elementId) || el.disabled) continue;
      if (DESTRUCTIVE.test(`${el.text ?? ""} ${el.label ?? ""}`)) continue;
      used.add(s.elementId);
      selector = el.selector;
    } else if (!isTour || items.length > 0) {
      // Only a tour's first step may be a centered modal.
      continue;
    }
    items.push({ selector, title: s.title.trim().slice(0, 200), body: s.body.trim().slice(0, 2000) });
  }
  if (!items.length) throw new AiError("The AI didn't find anything to highlight on this page. Try adding a goal.", 422);
  return items;
}
