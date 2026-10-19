import Link from "next/link";
import type { QuestionResult } from "@/lib/survey-results";
import { FunnelBars } from "@/components/charts";
import { Card } from "@/components/ui";
import { plainText } from "@/lib/format";

// NPS groups use the diverging pair (orange ↔ blue) with a gray midpoint.
const NPS_COLORS = { detractors: "#eb6834", passives: "#a3a3a3", promoters: "#6847f5" };
const typeNames = { nps: "NPS", rating: "Rating", choice: "Choice", text: "Open text" } as const;

export function SurveyResults({ ws, results }: { ws: string; results: QuestionResult[] }) {
  return (
    <div className="space-y-6">
      {results.map((r, i) => (
        <Card key={r.question.id} className="p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              <span className="mr-2 text-xs text-gray-400 tabular-nums">Q{i + 1}</span>
              {plainText(r.question.title) || "Untitled question"}
            </h2>
            <span className="text-xs text-gray-500">
              {r.kind === "choice" ? (r.question.type === "multiple" ? "Multiple choice" : "Single choice") : typeNames[r.kind]} ·{" "}
              {r.responses} {r.responses === 1 ? "response" : "responses"}
            </span>
          </div>
          {r.responses === 0 ? (
            <p className="text-sm text-gray-500">No answers in this period.</p>
          ) : r.kind === "nps" ? (
            <NpsResult r={r} />
          ) : r.kind === "rating" ? (
            <RatingResult r={r} />
          ) : r.kind === "choice" ? (
            <>
              <FunnelBars rows={r.options.map((o) => ({ label: o.label, value: o.count }))} base={r.responses} />
              {r.question.type === "multiple" && <p className="mt-3 text-xs text-gray-500">Shares are of respondents; people could pick several.</p>}
            </>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-100 overflow-auto">
              {r.latest.map((a, k) => (
                <li key={k} className="py-2.5 text-sm">
                  <p className="whitespace-pre-wrap text-gray-900">{a.text}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    <Link href={`/app/${ws}/users/${a.user.id}`} className="hover:text-brand-600">
                      {a.user.label}
                    </Link>
                    {a.user.company ? ` · ${a.user.company}` : ""} · {a.at.toLocaleString()}
                  </p>
                </li>
              ))}
              {r.responses > r.latest.length && (
                <li className="pt-2.5 text-xs text-gray-500">Latest {r.latest.length} shown. Export CSV for all answers.</li>
              )}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}

function NpsResult({ r }: { r: Extract<QuestionResult, { kind: "nps" }> }) {
  const n = r.promoters + r.passives + r.detractors;
  const groups = [
    { key: "detractors", label: "Detractors (0–6)", value: r.detractors },
    { key: "passives", label: "Passives (7–8)", value: r.passives },
    { key: "promoters", label: "Promoters (9–10)", value: r.promoters },
  ] as const;
  const max = Math.max(1, ...r.counts);
  return (
    <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
      <div>
        <div className="text-xs font-medium text-gray-500">NPS score</div>
        <div className="text-4xl font-semibold text-gray-900 tabular-nums">{r.score > 0 ? `+${r.score}` : r.score}</div>
        <div className="text-xs text-gray-500">% promoters − % detractors, from −100 to +100</div>
      </div>
      <div>
        <div className="mb-2 flex h-3 gap-0.5 overflow-hidden rounded" role="img" aria-label={groups.map((g) => `${g.label}: ${g.value}`).join(", ")}>
          {groups.map((g) =>
            g.value ? <div key={g.key} style={{ width: `${(g.value / n) * 100}%`, background: NPS_COLORS[g.key] }} title={`${g.label}: ${g.value}`} /> : null,
          )}
        </div>
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          {groups.map((g) => (
            <span key={g.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: NPS_COLORS[g.key] }} />
              {g.label}: <strong className="text-gray-900 tabular-nums">{g.value}</strong> ({Math.round((g.value / n) * 100)}%)
            </span>
          ))}
        </div>
        <ScoreColumns counts={r.counts} start={0} max={max} color={(score) => (score <= 6 ? NPS_COLORS.detractors : score <= 8 ? NPS_COLORS.passives : NPS_COLORS.promoters)} />
      </div>
    </div>
  );
}

function RatingResult({ r }: { r: Extract<QuestionResult, { kind: "rating" }> }) {
  return (
    <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
      <div>
        <div className="text-xs font-medium text-gray-500">Average</div>
        <div className="text-4xl font-semibold text-gray-900 tabular-nums">
          {r.average.toFixed(1)}
          <span className="text-lg text-gray-400"> / {r.question.scale}</span>
        </div>
        {(r.question.lowLabel || r.question.highLabel) && (
          <div className="text-xs text-gray-500">
            1 = {r.question.lowLabel || "lowest"}, {r.question.scale} = {r.question.highLabel || "highest"}
          </div>
        )}
      </div>
      <ScoreColumns counts={r.counts} start={1} max={Math.max(1, ...r.counts)} color={() => "#6847f5"} />
    </div>
  );
}

// One column per score with its count above it.
function ScoreColumns({ counts, start, max, color }: { counts: number[]; start: number; max: number; color: (score: number) => string }) {
  return (
    <div className="flex h-32 items-end gap-1">
      {counts.map((c, i) => (
        <div key={i} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${start + i}: ${c}`}>
          <span className="mb-1 text-[11px] text-gray-600 tabular-nums">{c || ""}</span>
          <div
            className="w-full max-w-10 rounded-t transition-opacity group-hover:opacity-80"
            style={{ height: `${(c / max) * 80}%`, minHeight: c ? 2 : 0, background: color(start + i) }}
          />
          <span className="mt-1 border-t border-gray-200 pt-1 text-[11px] text-gray-500 tabular-nums">{start + i}</span>
        </div>
      ))}
    </div>
  );
}
