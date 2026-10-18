import "server-only";
import { prisma } from "./db";
import { plainText } from "./format";
import type { SurveyContent, SurveyQuestion } from "./guide-schema";

// Aggregates the stored answers of a survey per question. Each user's latest
// answer to a question counts once.

export type QuestionResult =
  | { question: SurveyQuestion; kind: "nps"; responses: number; counts: number[]; promoters: number; passives: number; detractors: number; score: number }
  | { question: SurveyQuestion; kind: "rating"; responses: number; counts: number[]; average: number }
  | { question: SurveyQuestion; kind: "choice"; responses: number; options: { id: string; label: string; count: number }[] }
  | { question: SurveyQuestion; kind: "text"; responses: number; latest: TextAnswer[] };

export type TextAnswer = { text: string; at: Date; user: { id: string; label: string; company: string | null } };

const MAX_ROWS = 50_000;

export async function surveyResults(guideId: string, content: SurveyContent, days: number) {
  const from = new Date(Date.now() - days * 86_400_000);
  const answers = await prisma.surveyAnswer.findMany({
    where: { guideId, updatedAt: { gte: from } },
    orderBy: { updatedAt: "desc" },
    take: MAX_ROWS,
    select: {
      questionId: true,
      value: true,
      updatedAt: true,
      endUser: { select: { id: true, externalId: true, anonymous: true, companyName: true, companyId: true } },
    },
  });

  const byQuestion = new Map<string, typeof answers>();
  for (const a of answers) {
    const list = byQuestion.get(a.questionId) ?? [];
    list.push(a);
    byQuestion.set(a.questionId, list);
  }
  const respondents = new Set(answers.map((a) => a.endUser.id)).size;

  const results = content.questions.map((q): QuestionResult => {
    const list = byQuestion.get(q.id) ?? [];
    const responses = list.length;
    switch (q.type) {
      case "nps": {
        const counts = Array(11).fill(0) as number[];
        for (const a of list) if (typeof a.value === "number" && a.value >= 0 && a.value <= 10) counts[a.value]++;
        const promoters = counts[9] + counts[10];
        const passives = counts[7] + counts[8];
        const detractors = counts.slice(0, 7).reduce((x, y) => x + y, 0);
        const n = promoters + passives + detractors;
        return {
          question: q,
          kind: "nps",
          responses,
          counts,
          promoters,
          passives,
          detractors,
          score: n ? Math.round(((promoters - detractors) / n) * 100) : 0,
        };
      }
      case "rating": {
        const counts = Array(q.scale).fill(0) as number[];
        let sum = 0;
        let n = 0;
        for (const a of list) {
          if (typeof a.value === "number" && a.value >= 1 && a.value <= q.scale) {
            counts[a.value - 1]++;
            sum += a.value;
            n++;
          }
        }
        return { question: q, kind: "rating", responses, counts, average: n ? Math.round((sum / n) * 10) / 10 : 0 };
      }
      case "single":
      case "multiple": {
        const tally = new Map<string, number>();
        for (const a of list) {
          const ids = Array.isArray(a.value) ? a.value : [a.value];
          for (const id of ids) if (typeof id === "string") tally.set(id, (tally.get(id) ?? 0) + 1);
        }
        return {
          question: q,
          kind: "choice",
          responses,
          options: q.options.map((o) => ({ id: o.id, label: o.label || "Untitled", count: tally.get(o.id) ?? 0 })),
        };
      }
      case "text":
        return {
          question: q,
          kind: "text",
          responses,
          latest: list.slice(0, 50).map((a) => ({
            text: String(a.value),
            at: a.updatedAt,
            user: {
              id: a.endUser.id,
              label: a.endUser.anonymous ? "Anonymous visitor" : a.endUser.externalId,
              company: a.endUser.companyName ?? a.endUser.companyId,
            },
          })),
        };
    }
  });

  return { respondents, results };
}

// One row per respondent with a column per question, for the CSV export.
export async function surveyResponseRows(guideId: string, content: SurveyContent) {
  const answers = await prisma.surveyAnswer.findMany({
    where: { guideId },
    orderBy: { updatedAt: "asc" },
    take: MAX_ROWS,
    select: {
      questionId: true,
      value: true,
      updatedAt: true,
      endUser: { select: { id: true, externalId: true, anonymous: true, companyId: true, companyName: true } },
    },
  });
  const optionLabel = new Map(content.questions.flatMap((q) => q.options.map((o) => [`${q.id}:${o.id}`, o.label] as const)));
  const rows = new Map<string, { user: (typeof answers)[number]["endUser"]; at: Date; values: Map<string, string> }>();
  for (const a of answers) {
    const row = rows.get(a.endUser.id) ?? { user: a.endUser, at: a.updatedAt, values: new Map() };
    const ids = Array.isArray(a.value) ? a.value : [a.value];
    const text = ids.map((v) => (typeof v === "string" ? (optionLabel.get(`${a.questionId}:${v}`) ?? v) : String(v))).join("; ");
    row.values.set(a.questionId, text);
    if (a.updatedAt > row.at) row.at = a.updatedAt;
    rows.set(a.endUser.id, row);
  }

  const header = ["User", "Anonymous", "Company ID", "Company", "Answered at", ...content.questions.map((q, i) => plainText(q.title) || `Question ${i + 1}`)];
  const body = [...rows.values()].map((r) => [
    r.user.anonymous ? r.user.externalId.replace(/^anon:/, "") : r.user.externalId,
    r.user.anonymous ? "yes" : "no",
    r.user.companyId ?? "",
    r.user.companyName ?? "",
    r.at.toISOString(),
    ...content.questions.map((q) => r.values.get(q.id) ?? ""),
  ]);
  return [header, ...body];
}

export function toCsv(rows: string[][]) {
  const cell = (v: string) => {
    // Stop spreadsheet formula injection from user-written answers.
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
