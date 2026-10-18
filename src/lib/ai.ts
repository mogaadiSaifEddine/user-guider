import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// AI drafting of tours and hotspots from a snapshot of the customer's page,
// taken by the SDK's builder mode. Gemini only picks elements by id from the
// snapshot; it never writes selectors, so every step points at something real.

export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

export function aiEnabled() {
  return Boolean(process.env.GEMINI_API_KEY);
}

const text = (max: number) => z.string().max(max).optional();

export const snapshotSchema = z.object({
  url: z.string().max(2000),
  title: z.string().max(300).default(""),
  lang: z.string().max(20).default(""),
  description: z.string().max(500).default(""),
  headings: z.array(z.string().max(200)).max(40).default([]),
  elements: z
    .array(
      z.object({
        id: z.number().int().min(0),
        tag: z.string().max(30),
        role: text(40),
        type: text(30),
        text: text(120),
        label: text(120),
        placeholder: text(120),
        href: text(300),
        region: text(30),
        onboarding: text(100),
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
  snapshot: snapshotSchema,
});

export type GenerateInput = z.infer<typeof generateSchema>;
export type DraftItem = { selector: string; title: string; body: string };

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const SYSTEM = `You design in-app onboarding for web applications.
You receive a structured snapshot of ONE page of an app: its title, headings and the visible interactive elements, each with a numeric id, tag, label text, page region and position (x, y, width, height in CSS pixels from the top-left of the page).

Your job: decide which features a user most needs to understand on this page, and write short guide content for them.

Rules:
- Refer to elements only by an "elementId" taken from the snapshot. Never invent ids.
- Prefer stable, meaningful UI: primary actions (create, add, save, publish), navigation sections, search and filters, tabs, settings entry points, help.
- Never point at destructive or account actions (delete, remove, log out, cancel subscription), at individual data rows or user-generated content (a specific project, file or person), or at elements whose label is empty or meaningless.
- Each element at most once. Order the items the way a user's eye and workflow move: usually top navigation, then the main area left-to-right and top-to-bottom, primary action last or where it naturally fits the goal.
- Titles: at most 6 words. Body: one or two short sentences, second person ("you"), concrete about what the feature does and why it helps. No marketing language, no emojis, no Markdown except **bold** for a UI label.
- Write in the language given in "lang" (a BCP 47 code). If it's empty, use the language of the page text.
- If the author gave a goal, focus on the features that serve it and skip the rest.`;

function tourInstructions(maxItems: number) {
  return `Create a product tour with at most ${maxItems} steps (fewer is better if the page is simple).
The first step may be a welcome step with "elementId": null (shown as a centered modal) that says in one sentence what this page is for. All other steps must have an elementId.`;
}

function hotspotInstructions(maxItems: number) {
  return `Create at most ${maxItems} hotspots: subtle hints on features that are useful but easy to miss. Every hotspot needs an elementId. Don't use the most obvious primary button.`;
}

const tourResponse = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          elementId: { type: ["integer", "null"], description: "id from the snapshot, or null for a centered welcome step" },
          title: { type: "string" },
          body: { type: "string" },
        },
        required: ["elementId", "title", "body"],
      },
    },
  },
  required: ["steps"],
};

const hotspotResponse = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          elementId: { type: "integer", description: "id from the snapshot" },
          title: { type: "string" },
          body: { type: "string" },
        },
        required: ["elementId", "title", "body"],
      },
    },
  },
  required: ["steps"],
};

const answerSchema = z.object({
  steps: z.array(
    z.object({
      elementId: z.number().int().nullable(),
      title: z.string(),
      body: z.string(),
    }),
  ),
});

export async function draftGuide(input: GenerateInput): Promise<DraftItem[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError("AI isn't set up on this server (GEMINI_API_KEY is missing).", 503);
  if (!input.snapshot.elements.length) throw new AiError("No visible buttons, links or fields found on this page.", 422);

  const isTour = input.kind === "TOUR";
  const prompt = [
    isTour ? tourInstructions(input.maxItems) : hotspotInstructions(input.maxItems),
    input.goal ? `Author's goal: ${input.goal}` : "No goal given: cover what a new user of this page needs most.",
    input.existing.length ? `The guide already covers these (don't repeat them): ${input.existing.join(" | ")}` : "",
    "Page snapshot (JSON):",
    // Selectors stay on our side (JSON.stringify drops undefined); the model doesn't need them.
    JSON.stringify({ ...input.snapshot, elements: input.snapshot.elements.map((e) => ({ ...e, selector: undefined })) }),
  ]
    .filter(Boolean)
    .join("\n\n");

  const ai = new GoogleGenAI({ apiKey });
  let raw: string | undefined;
  try {
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseJsonSchema: isTour ? tourResponse : hotspotResponse,
        temperature: 0.4,
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

  // Map ids back to selectors and drop anything that doesn't resolve.
  const byId = new Map(input.snapshot.elements.map((e) => [e.id, e]));
  const used = new Set<number>();
  const items: DraftItem[] = [];
  for (const s of parsed.steps) {
    if (items.length >= input.maxItems) break;
    let selector = "";
    if (s.elementId !== null) {
      const el = byId.get(s.elementId);
      if (!el || used.has(s.elementId)) continue;
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
