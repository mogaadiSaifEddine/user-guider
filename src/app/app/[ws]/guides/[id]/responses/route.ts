import { requireGuide } from "@/lib/auth";
import { parseContent, type SurveyContent } from "@/lib/guide-schema";
import { surveyResponseRows, toCsv } from "@/lib/survey-results";

// CSV of a survey's answers: one row per respondent, one column per question.
export async function GET(_req: Request, { params }: { params: Promise<{ ws: string; id: string }> }) {
  const { ws, id } = await params;
  const { guide } = await requireGuide(ws, id);
  if (guide.type !== "SURVEY") return new Response("Not a survey", { status: 400 });
  const content = parseContent("SURVEY", guide.publishedContent ?? guide.content) as SurveyContent;
  const rows = await surveyResponseRows(id, content);
  const name = guide.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "survey";
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-responses.csv"`,
    },
  });
}
