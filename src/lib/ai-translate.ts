import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { AiError, DEFAULT_GEMINI_MODEL } from "./ai";
import { languageName } from "./i18n";

// Translates guide and article text from English with Gemini. Texts keep the
// light markup of src/lib/format.ts, so the prompt insists on leaving markers,
// links and placeholders alone; anything that comes back without them is
// dropped rather than saved broken.

export type TranslateItem = { key: string; text: string; rich: boolean };

const SYSTEM = `You translate the text of in-app product guides (tours, checklists, surveys, help articles) from English.

Rules:
- Translate meaning, not word by word. Write the way a native product copywriter would for this UI: short, clear, friendly, second person. Match the informal or formal address that is usual for software in the target language (e.g. "du" in German and Scandinavian languages, "vous" in French).
- Keep every formatting marker exactly: **bold**, _italic_ or *italic*, ++underline++, ~~strike~~, [link text](url) (translate the link text, never the url), line breaks, and list prefixes "- " and "1. " at the start of lines. Keep backslash escapes.
- Keep placeholders in curly braces like {n}, {total}, {q} unchanged.
- Don't translate product names, brand names, code, URLs, email addresses, or UI labels that are quoted from the product and look like proper names. Translate ordinary UI labels in bold.
- Keep length similar: button labels stay short (one to three words).
- Never add explanations. Return one translation per input key.`;

const answerSchema = z.object({ translations: z.array(z.object({ key: z.string(), text: z.string() })) });

const markers = (s: string) => (s.match(/\*\*|\+\+|~~|\]\(|\{\w+\}/g) ?? []).sort().join(" ");

function chunks(items: TranslateItem[]) {
  const out: TranslateItem[][] = [];
  let cur: TranslateItem[] = [];
  let size = 0;
  for (const it of items) {
    if (cur.length && (cur.length >= 60 || size + it.text.length > 12_000)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(it);
    size += it.text.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

export async function translateTexts(items: TranslateItem[], locale: string, productContext = ""): Promise<Record<string, string>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError("AI isn't set up on this server (GEMINI_API_KEY is missing).", 503);
  const todo = items.filter((i) => i.text.trim());
  if (!todo.length) return {};

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const target = `${languageName(locale)} (${locale})`;
  const result: Record<string, string> = {};

  // A few chunks in parallel; big help articles can have hundreds of texts.
  const groups = chunks(todo);
  for (let i = 0; i < groups.length; i += 4) {
    await Promise.all(
      groups.slice(i, i + 4).map(async (group) => {
        const prompt = [
          `Translate into ${target}.`,
          productContext.trim() ? `About the product:\n${productContext.trim()}` : "",
          `Texts (JSON):\n${JSON.stringify(group.map((g) => ({ key: g.key, text: g.text })))}`,
        ]
          .filter(Boolean)
          .join("\n\n");
        let raw: string | undefined;
        try {
          const res = await ai.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              systemInstruction: SYSTEM,
              responseMimeType: "application/json",
              responseJsonSchema: {
                type: "object",
                properties: {
                  translations: {
                    type: "array",
                    items: { type: "object", properties: { key: { type: "string" }, text: { type: "string" } }, required: ["key", "text"] },
                  },
                },
                required: ["translations"],
              },
              temperature: 0.2,
              ...(/gemini-3/.test(model) ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
            },
          });
          raw = res.text;
        } catch (e) {
          console.error("[ai-translate] Gemini request failed", e);
          throw new AiError("The AI service didn't answer. Try again in a moment.", 502);
        }
        let parsed: z.infer<typeof answerSchema>;
        try {
          parsed = answerSchema.parse(JSON.parse(raw ?? ""));
        } catch {
          console.error("[ai-translate] unexpected output", raw?.slice(0, 500));
          throw new AiError("The AI returned something unusable. Try again.", 502);
        }
        const byKey = new Map(group.map((g) => [g.key, g]));
        for (const t of parsed.translations) {
          const src = byKey.get(t.key);
          const text = t.text.trim();
          if (!src || !text) continue;
          // Lost or invented markup would render wrong; leave that one untranslated.
          if (src.rich && markers(src.text) !== markers(text)) continue;
          if (!src.rich && /\{\w+\}/.test(src.text) && markers(src.text) !== markers(text)) continue;
          result[t.key] = text;
        }
      }),
    );
  }
  return result;
}
