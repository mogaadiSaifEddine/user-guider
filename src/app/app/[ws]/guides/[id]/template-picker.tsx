"use client";

import { useEffect, useMemo, useState } from "react";
import type { Theme } from "@/lib/guide-schema";
import { stepTemplates, type StepTemplate, type TemplateKind } from "@/lib/step-templates";
import { StepPreview } from "@/components/step-preview";
import { CARD_WIDTH } from "@/lib/format";
import { Input, cx } from "@/components/ui";

const tabLabels: Record<TemplateKind, string> = { modal: "Modal", tooltip: "Tooltip" };

// "Create a new step" dialog: tabs per step kind, search, and a live thumbnail per template.
export function TemplatePicker({
  open,
  onClose,
  onPick,
  theme,
  kinds = ["modal", "tooltip"],
  title = "Create a new step",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (t: StepTemplate) => void;
  theme: Theme;
  kinds?: TemplateKind[];
  title?: string;
}) {
  const [tab, setTab] = useState<TemplateKind>(kinds[0]);
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stepTemplates.filter(
      (t) => kinds.includes(t.kind) && (q ? `${t.name} ${t.description}`.toLowerCase().includes(q) : t.kind === tab),
    );
  }, [query, tab, kinds]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-label={title}>
        <div className="space-y-4 border-b border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button className="rounded-md px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <Input placeholder="Search for a template" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          {kinds.length > 1 && !query && (
            <div className="flex gap-2">
              {kinds.map((k) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={cx(
                    "rounded-full px-4 py-1.5 text-sm font-semibold",
                    tab === k ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                  )}
                >
                  {tabLabels[k]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto bg-gray-50 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.length === 0 && <p className="col-span-full py-10 text-center text-sm text-gray-500">No templates match.</p>}
          {list.map((t) => {
            const built = t.build(origin);
            return (
              <button
                key={t.id}
                onClick={() => onPick(t)}
                className="group flex flex-col overflow-hidden rounded-xl bg-white text-left ring-1 ring-gray-200 transition hover:shadow-md hover:ring-2 hover:ring-indigo-400"
              >
                <div className="pointer-events-none relative flex h-52 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                  {/* Scale so every size fits the ~250px-wide thumbnail. */}
                  <div className="shrink-0" style={{ transform: `scale(${Math.min(0.55, 240 / CARD_WIDTH[t.kind][built.size])})` }}>
                    <StepPreview
                      blocks={built.blocks}
                      theme={theme}
                      kind={t.kind}
                      size={built.size}
                      footer={built.footer}
                      index={1}
                      total={3}
                      advanceOnClick={built.advanceOn === "click"}
                    />
                  </div>
                </div>
                <div className="p-3.5">
                  <div className="text-sm font-semibold group-hover:text-indigo-700">{t.name}</div>
                  <div className="mt-0.5 text-xs text-gray-500">{t.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
