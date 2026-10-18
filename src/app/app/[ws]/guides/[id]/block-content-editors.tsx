"use client";

import { useState } from "react";
import {
  blocksLabel,
  newId,
  placements,
  stepSizes,
  type AnnouncementContent,
  type Block,
  type StepFooter,
  type Theme,
  type TourContent,
  type TourStep,
} from "@/lib/guide-schema";
import type { StepTemplate } from "@/lib/step-templates";
import { StepPreview } from "@/components/step-preview";
import { Badge, Button, Card, Field, Input, Select, cx } from "@/components/ui";
import { BlocksEditor } from "./blocks-editor";
import { TemplatePicker } from "./template-picker";
import type { OtherGuide } from "./content-editors";

const sizeLabels = { sm: "Small", md: "Medium", lg: "Large" } as const;

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-gray-100 pt-3">
      <button type="button" className="mb-2 flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{title}</span>
        <span className="text-xs text-gray-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  );
}

function PreviewPane({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="xl:sticky xl:top-20">
      <div className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">Preview</div>
      <div className="flex min-h-48 items-start justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 p-5">
        {children}
      </div>
      {note && <p className="mt-2 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

// ---------- Tour ----------

export function TourEditor({
  ws,
  value,
  onChange,
  others,
  theme,
}: {
  ws: string;
  value: TourContent;
  onChange: (v: TourContent) => void;
  others: OtherGuide[];
  theme: Theme;
}) {
  const [openId, setOpenId] = useState<string | null>(value.steps[0]?.id ?? null);
  const [picking, setPicking] = useState(false);
  const set = (steps: TourStep[]) => onChange({ ...value, steps });
  const patch = (i: number, p: Partial<TourStep>) => set(value.steps.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value.steps];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set(next);
  };

  function addFromTemplate(t: StepTemplate) {
    const b = t.build(window.location.origin);
    const step: TourStep = {
      id: newId(),
      blocks: b.blocks,
      footer: b.footer,
      size: b.size,
      selector: "",
      placement: "auto",
      advanceOn: b.advanceOn ?? "next",
      backdrop: b.backdrop ?? true,
    };
    set([...value.steps, step]);
    setOpenId(step.id);
    setPicking(false);
  }

  return (
    <div className="space-y-3">
      {value.steps.map((s, i) => {
        const open = openId === s.id;
        const kind = s.selector ? "tooltip" : "modal";
        return (
          <Card key={s.id} className={cx(open && "ring-2 ring-indigo-200")}>
            <div className="flex items-center gap-2 px-4 py-3">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => setOpenId(open ? null : s.id)}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                  {i + 1}
                </span>
                <span className="min-w-0 truncate text-sm font-semibold">{blocksLabel(s.blocks) || "Untitled step"}</span>
                <Badge color={kind === "modal" ? "indigo" : "gray"}>{kind === "modal" ? "Modal" : "Tooltip"}</Badge>
              </button>
              <Button type="button" variant="ghost" className="px-2" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                ↑
              </Button>
              <Button type="button" variant="ghost" className="px-2" disabled={i === value.steps.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                ↓
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="px-2 text-red-600"
                aria-label="Delete step"
                onClick={() => confirm("Delete this step?") && set(value.steps.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            </div>
            {open && (
              <div className="grid gap-6 border-t border-gray-100 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 space-y-4">
                  <BlocksEditor ws={ws} blocks={s.blocks} onChange={(blocks) => patch(i, { blocks })} others={others} context="tour" />

                  <Section title="Placement">
                    <Field
                      label="Element (CSS selector)"
                      hint={s.selector ? "Pick it on your site with the builder, or edit by hand." : "Empty: shown as a centered modal. Pick an element in the builder to make it a tooltip."}
                    >
                      <Input
                        className="font-mono text-xs"
                        value={s.selector}
                        placeholder="#create-tour-button"
                        onChange={(e) => patch(i, { selector: e.target.value })}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Field label="Size">
                        <Select value={s.size} onChange={(e) => patch(i, { size: e.target.value as TourStep["size"] })}>
                          {stepSizes.map((z) => (
                            <option key={z} value={z}>
                              {sizeLabels[z]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Position">
                        <Select value={s.placement} disabled={!s.selector} onChange={(e) => patch(i, { placement: e.target.value as TourStep["placement"] })}>
                          {placements.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Advance on">
                        <Select value={s.advanceOn} disabled={!s.selector} onChange={(e) => patch(i, { advanceOn: e.target.value as TourStep["advanceOn"] })}>
                          <option value="next">Next button</option>
                          <option value="click">Click on element</option>
                        </Select>
                      </Field>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={s.backdrop} disabled={!s.selector} onChange={(e) => patch(i, { backdrop: e.target.checked })} />
                      Dim the rest of the page
                    </label>
                  </Section>

                  <FooterSection footer={s.footer} onChange={(footer) => patch(i, { footer })} />
                </div>
                <PreviewPane note={kind === "tooltip" ? "Shown next to the element on your site." : undefined}>
                  <StepPreview
                    blocks={s.blocks}
                    theme={theme}
                    kind={kind}
                    size={s.size}
                    footer={s.footer}
                    index={i}
                    total={value.steps.length}
                    advanceOnClick={!!s.selector && s.advanceOn === "click"}
                    interactive
                  />
                </PreviewPane>
              </div>
            )}
          </Card>
        );
      })}
      <Button type="button" variant="secondary" className="w-full" disabled={value.steps.length >= 50} onClick={() => setPicking(true)}>
        + Add step
      </Button>
      <TemplatePicker open={picking} onClose={() => setPicking(false)} onPick={addFromTemplate} theme={theme} />
    </div>
  );
}

function FooterSection({ footer: f, onChange }: { footer: StepFooter; onChange: (f: StepFooter) => void }) {
  const p = (x: Partial<StepFooter>) => onChange({ ...f, ...x });
  return (
    <Section title="Navigation buttons" defaultOpen={false}>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.show} onChange={(e) => p({ show: e.target.checked })} />
        Show Back / Next / Done
      </label>
      {f.show && (
        <>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.showProgress} onChange={(e) => p({ showProgress: e.target.checked })} />
              Step counter (2 of 5)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.showBack} onChange={(e) => p({ showBack: e.target.checked })} />
              Back button
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Next label">
              <Input value={f.nextLabel} maxLength={40} onChange={(e) => p({ nextLabel: e.target.value })} />
            </Field>
            <Field label="Back label">
              <Input value={f.backLabel} maxLength={40} onChange={(e) => p({ backLabel: e.target.value })} />
            </Field>
            <Field label="Done label" hint="On the last step.">
              <Input value={f.doneLabel} maxLength={40} onChange={(e) => p({ doneLabel: e.target.value })} />
            </Field>
          </div>
        </>
      )}
      {!f.show && <p className="text-xs text-gray-500">Add a Buttons block so people can move on.</p>}
    </Section>
  );
}

// ---------- Announcement ----------

export function AnnouncementEditor({
  ws,
  value,
  onChange,
  others,
  theme,
}: {
  ws: string;
  value: AnnouncementContent;
  onChange: (v: AnnouncementContent) => void;
  others: OtherGuide[];
  theme: Theme;
}) {
  const [picking, setPicking] = useState(false);
  const patch = (p: Partial<AnnouncementContent>) => onChange({ ...value, ...p });
  const banner = value.format === "banner";

  function applyTemplate(t: StepTemplate) {
    const b = t.build(window.location.origin);
    const blocks: Block[] = b.blocks.some((x) => x.type === "buttons")
      ? b.blocks
      : [...b.blocks, { type: "buttons", id: newId(), align: "right", buttons: [{ id: newId(), label: "Got it", style: "primary", action: { type: "complete" } }] }];
    onChange({ ...value, format: "modal", size: b.size, blocks });
    setPicking(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-w-0 space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Format">
            <Select value={value.format} onChange={(e) => patch({ format: e.target.value as AnnouncementContent["format"] })}>
              <option value="modal">Modal</option>
              <option value="banner">Banner (top of page)</option>
            </Select>
          </Field>
          {!banner && (
            <Field label="Size">
              <Select value={value.size} onChange={(e) => patch({ size: e.target.value as AnnouncementContent["size"] })}>
                {stepSizes.map((z) => (
                  <option key={z} value={z}>
                    {sizeLabels[z]}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {!banner && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => (value.blocks.length === 0 || confirm("Replace the current content with a template?")) && setPicking(true)}
          >
            Start from a template
          </Button>
        )}
        {banner && <p className="text-xs text-gray-500">A banner shows headings and text on one line, plus the buttons of the first Buttons block.</p>}
        <BlocksEditor ws={ws} blocks={value.blocks} onChange={(blocks) => patch({ blocks })} others={others} context="announcement" />
      </Card>
      <PreviewPane>
        <div className={cx(banner && "w-full")}>
          <StepPreview blocks={value.blocks} theme={theme} kind={banner ? "banner" : "modal"} size={value.size} interactive />
        </div>
      </PreviewPane>
      <TemplatePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={applyTemplate}
        theme={theme}
        kinds={["modal"]}
        title="Choose a template"
      />
    </div>
  );
}
