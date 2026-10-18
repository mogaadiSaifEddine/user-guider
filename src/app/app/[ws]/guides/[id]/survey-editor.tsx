"use client";

import { useState } from "react";
import {
  newId,
  newQuestion,
  questionTypes,
  type QuestionType,
  type SurveyContent,
  type SurveyQuestion,
  type Theme,
} from "@/lib/guide-schema";
import { Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { ListItem, move, TEXT_HINT } from "./content-editors";

export const questionLabels: Record<QuestionType, string> = {
  nps: "NPS (0–10)",
  rating: "Rating scale",
  single: "Single choice",
  multiple: "Multiple choice",
  text: "Open text",
};

export function SurveyEditor({
  value,
  onChange,
  theme,
}: {
  value: SurveyContent;
  onChange: (v: SurveyContent) => void;
  theme: Theme;
}) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const patch = (p: Partial<SurveyContent>) => onChange({ ...value, ...p });
  const setQuestions = (questions: SurveyQuestion[]) => patch({ questions });
  const patchQ = (i: number, p: Partial<SurveyQuestion>) => setQuestions(value.questions.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const shown = Math.min(previewIndex, value.questions.length - 1);

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-3">
        {value.questions.length === 0 && <p className="text-sm text-gray-500">No questions yet. Add one below.</p>}
        {value.questions.map((q, i) => (
          <div key={q.id} onFocusCapture={() => setPreviewIndex(i)} onClick={() => setPreviewIndex(i)}>
            <ListItem
              index={i}
              total={value.questions.length}
              title={`${questionLabels[q.type]}${q.title ? ` · ${q.title}` : ""}`}
              onMove={(d) => setQuestions(move(value.questions, i, d))}
              onDelete={() => setQuestions(value.questions.filter((_, j) => j !== i))}
            >
              <QuestionFields q={q} onPatch={(p) => patchQ(i, p)} />
            </ListItem>
          </div>
        ))}
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold text-gray-700">Add a question</div>
          <div className="flex flex-wrap gap-2">
            {questionTypes.map((t) => (
              <Button
                key={t}
                type="button"
                variant="secondary"
                disabled={value.questions.length >= 20}
                onClick={() => {
                  setQuestions([...value.questions, newQuestion(t)]);
                  setPreviewIndex(value.questions.length);
                }}
              >
                + {questionLabels[t]}
              </Button>
            ))}
          </div>
        </Card>

        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Position">
            <Select value={value.position} onChange={(e) => patch({ position: e.target.value as SurveyContent["position"] })}>
              <option value="bottom-right">Bottom right corner</option>
              <option value="bottom-left">Bottom left corner</option>
              <option value="center">Centered modal</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={value.showProgress} onChange={(e) => patch({ showProgress: e.target.checked })} />
            Show &quot;1 of 3&quot; progress
          </label>
          <Field label="Next button">
            <Input value={value.nextLabel} maxLength={40} onChange={(e) => patch({ nextLabel: e.target.value })} />
          </Field>
          <Field label="Submit button" hint="On the last question.">
            <Input value={value.submitLabel} maxLength={40} onChange={(e) => patch({ submitLabel: e.target.value })} />
          </Field>
        </Card>

        <Card className="space-y-3 p-5">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={value.thankYou.show}
              onChange={(e) => patch({ thankYou: { ...value.thankYou, show: e.target.checked } })}
            />
            Thank-you message after the last answer
          </label>
          {value.thankYou.show && (
            <>
              <Field label="Heading">
                <Input
                  value={value.thankYou.heading}
                  maxLength={200}
                  onChange={(e) => patch({ thankYou: { ...value.thankYou, heading: e.target.value } })}
                />
              </Field>
              <Field label="Text" hint={TEXT_HINT}>
                <Textarea
                  rows={2}
                  value={value.thankYou.text}
                  maxLength={1000}
                  onChange={(e) => patch({ thankYou: { ...value.thankYou, text: e.target.value } })}
                />
              </Field>
            </>
          )}
        </Card>
      </div>

      <div className="order-first max-w-sm 2xl:sticky 2xl:top-20 2xl:order-last 2xl:max-w-none 2xl:self-start">
        <div className="mb-2 text-xs font-semibold text-gray-500">
          Preview{value.questions.length > 1 ? ` · question ${shown + 1}` : ""}
        </div>
        {shown >= 0 ? (
          <QuestionPreview q={value.questions[shown]} index={shown} content={value} theme={theme} />
        ) : (
          <p className="text-sm text-gray-500">Add a question to see it here.</p>
        )}
      </div>
    </div>
  );
}

function QuestionFields({ q, onPatch }: { q: SurveyQuestion; onPatch: (p: Partial<SurveyQuestion>) => void }) {
  return (
    <>
      <Field label="Question type">
        <Select
          value={q.type}
          onChange={(e) => {
            const type = e.target.value as QuestionType;
            // Keep the wording, take the new type's defaults for everything else.
            const fresh = newQuestion(type);
            onPatch({
              type,
              options: q.options.length ? q.options : fresh.options,
              lowLabel: q.lowLabel || fresh.lowLabel,
              highLabel: q.highLabel || fresh.highLabel,
            });
          }}
        >
          {questionTypes.map((t) => (
            <option key={t} value={t}>
              {questionLabels[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Question">
        <Input value={q.title} maxLength={300} onChange={(e) => onPatch({ title: e.target.value })} />
      </Field>
      <Field label="Description (optional)" hint={TEXT_HINT}>
        <Textarea rows={2} value={q.description} maxLength={1000} onChange={(e) => onPatch({ description: e.target.value })} />
      </Field>

      {(q.type === "single" || q.type === "multiple") && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-700">Answers</div>
          {q.options.map((o, k) => (
            <div key={o.id} className="flex gap-2">
              <Input
                value={o.label}
                maxLength={200}
                placeholder={`Answer ${k + 1}`}
                onChange={(e) => onPatch({ options: q.options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })}
              />
              <Button type="button" variant="ghost" className="px-2" disabled={k === 0} onClick={() => onPatch({ options: move(q.options, k, -1) })} aria-label="Move up">
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="px-2 text-red-600"
                onClick={() => onPatch({ options: q.options.filter((x) => x.id !== o.id) })}
                aria-label="Remove answer"
              >
                ✕
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={q.options.length >= 12}
            onClick={() => onPatch({ options: [...q.options, { id: newId(), label: "" }] })}
          >
            + Answer
          </Button>
        </div>
      )}

      {(q.type === "nps" || q.type === "rating") && (
        <div className={cx("grid gap-3", q.type === "rating" ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {q.type === "rating" && (
            <Field label="Scale">
              <Select value={q.scale} onChange={(e) => onPatch({ scale: Number(e.target.value) })}>
                {[3, 4, 5, 6, 7, 10].map((n) => (
                  <option key={n} value={n}>
                    1 – {n}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Low end label">
            <Input value={q.lowLabel} maxLength={60} onChange={(e) => onPatch({ lowLabel: e.target.value })} />
          </Field>
          <Field label="High end label">
            <Input value={q.highLabel} maxLength={60} onChange={(e) => onPatch({ highLabel: e.target.value })} />
          </Field>
        </div>
      )}

      {q.type === "text" && (
        <Field label="Placeholder">
          <Input value={q.placeholder} maxLength={200} onChange={(e) => onPatch({ placeholder: e.target.value })} />
        </Field>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={q.required} onChange={(e) => onPatch({ required: e.target.checked })} />
        Required (no Skip button)
      </label>
    </>
  );
}

// Static picture of how the SDK draws the question, using the workspace theme.
function QuestionPreview({ q, index, content, theme }: { q: SurveyQuestion; index: number; content: SurveyContent; theme: Theme }) {
  const radius = theme.radius;
  const small = radius * 0.6;
  const border = "1px solid rgba(0,0,0,.15)";
  const total = content.questions.length;
  const last = index === total - 1;
  const needsButton = q.type === "multiple" || q.type === "text";
  const cells = q.type === "nps" ? Array.from({ length: 11 }, (_, i) => i) : Array.from({ length: q.scale }, (_, i) => i + 1);

  return (
    <div
      className="relative p-[18px] text-sm shadow-xl ring-1 ring-gray-200"
      style={{
        background: theme.backgroundColor,
        color: theme.textColor,
        borderRadius: radius,
        fontFamily: theme.fontFamily === "inherit" ? undefined : theme.fontFamily,
      }}
    >
      <span className="absolute top-2.5 right-3 opacity-50">×</span>
      <div className="mr-6 mb-1.5 text-base leading-snug font-semibold">{q.title || "Your question"}</div>
      {q.description && <div className="mb-3 text-[13px] opacity-75">{q.description}</div>}
      <div className="mt-3">
        {(q.type === "nps" || q.type === "rating") && (
          <>
            <div className="mb-1.5 flex gap-1">
              {cells.map((n) => (
                <span
                  key={n}
                  className="flex h-8 min-w-0 flex-1 items-center justify-center text-xs font-semibold"
                  style={{ border, borderRadius: small }}
                >
                  {n}
                </span>
              ))}
            </div>
            {(q.lowLabel || q.highLabel) && (
              <div className="mb-3 flex justify-between text-xs opacity-65">
                <span>{q.lowLabel}</span>
                <span>{q.highLabel}</span>
              </div>
            )}
          </>
        )}
        {(q.type === "single" || q.type === "multiple") && (
          <div className="mb-3 flex flex-col gap-1.5">
            {q.options.map((o) => (
              <span key={o.id} className="flex items-center gap-2.5 px-3 py-2" style={{ border, borderRadius: small }}>
                <span
                  className="h-4 w-4 shrink-0"
                  style={{ border: "2px solid rgba(0,0,0,.3)", borderRadius: q.type === "single" ? "50%" : 4 }}
                />
                {o.label || <span className="opacity-40">Empty answer</span>}
              </span>
            ))}
          </div>
        )}
        {q.type === "text" && (
          <div className="mb-3 h-[72px] px-2.5 py-2 opacity-60" style={{ border: "1px solid rgba(0,0,0,.2)", borderRadius: small }}>
            {q.placeholder}
          </div>
        )}
      </div>
      {(needsButton || !q.required || (content.showProgress && total > 1)) && (
        <div className="flex items-center gap-2">
          <span className="mr-auto text-xs opacity-60">{content.showProgress && total > 1 ? `${index + 1} of ${total}` : ""}</span>
          {!q.required && <span className="px-3 py-1.5 font-semibold opacity-75">Skip</span>}
          {needsButton && (
            <span className="px-3.5 py-1.5 font-semibold text-white" style={{ background: theme.primaryColor, borderRadius: radius * 0.7 }}>
              {last ? content.submitLabel : content.nextLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
