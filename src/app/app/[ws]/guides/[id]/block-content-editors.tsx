"use client";

import { useState } from "react";
import { useConfirm } from "@/components/feedback";
import {
  advanceSchema,
  bannerTones,
  blocksLabel,
  hotspotOffsets,
  hotspotSchema,
  inlinePositions,
  inputFormats,
  newBlock,
  newId,
  placements,
  stepSizes,
  type Advance,
  type AdvanceType,
  type AnnouncementContent,
  type BannerSettings,
  type Block,
  type Hotspot,
  type HotspotContent,
  type InlineContent,
  type StepFooter,
  type Theme,
  type TourContent,
  type TourStep,
  type UrlRule,
} from "@/lib/guide-schema";
import type { StepTemplate } from "@/lib/step-templates";
import { StepPreview } from "@/components/step-preview";
import { Badge, Button, Card, Field, Input, Select, cx } from "@/components/ui";
import { BlocksEditor } from "./blocks-editor";
import { TemplatePicker } from "./template-picker";
import { ListItem, move as moveItem, type OtherGuide } from "./content-editors";

const sizeLabels = { sm: "Small", md: "Medium", lg: "Large" } as const;

const advanceLabels: Record<AdvanceType, string> = {
  next: "Next button",
  click: "Click on the element",
  input: "Typing in the field",
  element: "Another element appears",
  url: "Going to a page",
  event: "An event from your app",
  media_end: "The video or audio ends",
};

// Steps that wait for the user hide the Next button.
const waitsForUser = (s: TourStep) =>
  s.advanceOn.type === "element" || (Boolean(s.selector) && (s.advanceOn.type === "click" || s.advanceOn.type === "input"));

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
  languages,
}: {
  ws: string;
  value: TourContent;
  onChange: (v: TourContent) => void;
  others: OtherGuide[];
  theme: Theme;
  languages: string[];
}) {
  const confirm = useConfirm();
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
      advanceOn: { type: b.advanceOn ?? "next" },
      skipIf: { when: "never", selector: "" },
      optional: false,
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
          <Card key={s.id} className={cx(open && "ring-2 ring-brand-200")}>
            <div className="flex items-center gap-2 px-4 py-3">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => setOpenId(open ? null : s.id)}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                  {i + 1}
                </span>
                <span className="min-w-0 truncate text-sm font-semibold">{blocksLabel(s.blocks) || "Untitled step"}</span>
                <Badge color={kind === "modal" ? "brand" : "gray"}>{kind === "modal" ? "Modal" : "Tooltip"}</Badge>
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
                onClick={async () =>
                  (await confirm({ title: `Delete step ${i + 1}?`, confirmLabel: "Delete step", danger: true })) &&
                  set(value.steps.filter((_, j) => j !== i))
                }
              >
                ✕
              </Button>
            </div>
            {open && (
              <div className="grid gap-6 border-t border-gray-100 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 space-y-4">
                  <BlocksEditor
                    ws={ws}
                    blocks={s.blocks}
                    onChange={(blocks) => patch(i, { blocks })}
                    others={others}
                    context="tour"
                    languages={languages}
                  />

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
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={s.backdrop} disabled={!s.selector} onChange={(e) => patch(i, { backdrop: e.target.checked })} />
                      Dim the rest of the page
                    </label>
                  </Section>

                  <Section title="Moving on">
                    <AdvanceFields step={s} onChange={(p) => patch(i, p)} />
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
                    hideNext={waitsForUser(s)}
                    skipLink={waitsForUser(s) && s.optional}
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

const urlOpLabels: Record<UrlRule["op"], string> = {
  contains: "URL contains",
  equals: "Path is",
  starts_with: "Path starts with",
  regex: "URL matches regex",
};

function AdvanceFields({ step: s, onChange }: { step: TourStep; onChange: (p: Partial<TourStep>) => void }) {
  const a = s.advanceOn;
  const set = (next: Advance) => onChange({ advanceOn: next });
  const needsElement = (t: AdvanceType) => t === "click" || t === "input";
  return (
    <>
      <Field label="Advance on" hint={needsElement(a.type) && !s.selector ? "Pick an element first; without one the step shows a Next button." : undefined}>
        <Select value={a.type} onChange={(e) => set(advanceSchema.parse({ type: e.target.value }))}>
          {(Object.keys(advanceLabels) as AdvanceType[]).map((t) => (
            <option key={t} value={t}>
              {advanceLabels[t]}
            </option>
          ))}
        </Select>
      </Field>
      {a.type === "input" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="At least (characters)">
            <Input
              type="number"
              min={1}
              max={500}
              value={a.minLength}
              onChange={(e) => set({ ...a, minLength: Math.max(1, Math.min(500, Math.trunc(Number(e.target.value)) || 1)) })}
            />
          </Field>
          <Field label="Must be">
            <Select value={a.format} onChange={(e) => set({ ...a, format: e.target.value as (typeof inputFormats)[number] })}>
              <option value="any">Anything</option>
              <option value="email">An email address</option>
              <option value="url">A web address</option>
              <option value="regex">Matching a regex</option>
            </Select>
          </Field>
          {a.format === "regex" && (
            <Field label="Regex">
              <Input className="font-mono text-xs" value={a.pattern} maxLength={300} placeholder="^[A-Z]" onChange={(e) => set({ ...a, pattern: e.target.value })} />
            </Field>
          )}
          <p className="text-xs text-gray-500 sm:col-span-3">Moves on a moment after the user stops typing a valid value, or on Enter.</p>
        </div>
      )}
      {a.type === "element" && (
        <Field label="Element to wait for (CSS selector)" hint="E.g. the dialog the user just opened. Pick it with the builder, or type it.">
          <Input className="font-mono text-xs" value={a.selector} placeholder=".create-project-dialog" onChange={(e) => set({ ...a, selector: e.target.value })} />
        </Field>
      )}
      {a.type === "url" && (
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <Select className="sm:w-48" value={a.rule.op} onChange={(e) => set({ ...a, rule: { ...a.rule, op: e.target.value as UrlRule["op"] } })}>
            {(Object.keys(urlOpLabels) as UrlRule["op"][]).map((op) => (
              <option key={op} value={op}>
                {urlOpLabels[op]}
              </option>
            ))}
          </Select>
          <Input
            className="font-mono text-xs"
            value={a.rule.value}
            maxLength={500}
            placeholder="/projects/new"
            onChange={(e) => set({ ...a, rule: { ...a.rule, value: e.target.value } })}
          />
        </div>
      )}
      {a.type === "event" && (
        <Field label="Event name">
          <Input className="font-mono text-xs" value={a.name} maxLength={191} placeholder="project_created" onChange={(e) => set({ ...a, name: e.target.value })} />
          {a.name && (
            <p className="mt-1 text-xs text-gray-500">
              Your app calls <code className="rounded bg-gray-100 px-1">UserOnboarder.track(&quot;{a.name}&quot;)</code>
            </p>
          )}
        </Field>
      )}
      {a.type === "media_end" && (
        <p className="text-xs text-gray-500">Needs an audio block or a video file (.mp4 / .webm) in this step that doesn&apos;t loop. YouTube, Vimeo and Loom can&apos;t report the end.</p>
      )}
      {a.type === "url" && (
        <p className="text-xs text-gray-500">
          The tour carries on on the next page, even after a full page load, for 30 minutes.
        </p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={s.optional} disabled={!s.selector} onChange={(e) => onChange({ optional: e.target.checked })} />
        Optional: skip this step when its element isn&apos;t found, instead of ending the tour
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr]">
        <Field label="Skip this step">
          <Select value={s.skipIf.when} onChange={(e) => onChange({ skipIf: { ...s.skipIf, when: e.target.value as TourStep["skipIf"]["when"] } })}>
            <option value="never">Never</option>
            <option value="present">When an element is on the page</option>
            <option value="absent">When an element isn&apos;t on the page</option>
          </Select>
        </Field>
        {s.skipIf.when !== "never" && (
          <Field label="That element (CSS selector)" hint='E.g. skip "Open settings" when the settings panel is already open.'>
            <Input
              className="font-mono text-xs"
              value={s.skipIf.selector}
              placeholder=".settings-panel"
              onChange={(e) => onChange({ skipIf: { ...s.skipIf, selector: e.target.value } })}
            />
          </Field>
        )}
      </div>
    </>
  );
}

// ---------- Announcement ----------

export function AnnouncementEditor({
  ws,
  value,
  onChange,
  others,
  theme,
  languages,
}: {
  ws: string;
  value: AnnouncementContent;
  onChange: (v: AnnouncementContent) => void;
  others: OtherGuide[];
  theme: Theme;
  languages: string[];
}) {
  const confirm = useConfirm();
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
              <option value="banner">Banner</option>
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
            onClick={async () =>
              (value.blocks.length === 0 ||
                (await confirm({ title: "Replace the current content?", body: "The template replaces everything in this announcement.", confirmLabel: "Pick a template" }))) &&
              setPicking(true)
            }
          >
            Start from a template
          </Button>
        )}
        {banner && (
          <>
            <BannerFields value={value.banner} onChange={(b) => patch({ banner: b })} />
            <p className="text-xs text-gray-500">
              A banner shows headings and text on one line, plus the buttons of the first Buttons block. It has its own slot: tours and surveys
              still run while it&apos;s on screen.
            </p>
          </>
        )}
        <BlocksEditor
          ws={ws}
          blocks={value.blocks}
          onChange={(blocks) => patch({ blocks })}
          others={others}
          context="announcement"
          languages={languages}
        />
      </Card>
      <PreviewPane>
        <div className={cx(banner && "w-full")}>
          <StepPreview
            blocks={value.blocks}
            theme={theme}
            kind={banner ? "banner" : "modal"}
            size={value.size}
            banner={banner ? value.banner : undefined}
            interactive
          />
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

const toneLabels: Record<BannerSettings["tone"], string> = { brand: "Brand color", info: "Info (blue)", success: "Success (green)", warning: "Warning (amber)" };

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        {value ? (
          <Button type="button" variant="ghost" className="px-2 text-xs" onClick={() => onChange("")}>
            Use the tone&apos;s
          </Button>
        ) : (
          <span className="text-xs text-gray-500">From the tone</span>
        )}
      </div>
    </Field>
  );
}

function BannerFields({ value: b, onChange }: { value: BannerSettings; onChange: (b: BannerSettings) => void }) {
  const p = (x: Partial<BannerSettings>) => onChange({ ...b, ...x });
  return (
    <div className="space-y-3 rounded-lg bg-gray-50 p-3 ring-1 ring-gray-200">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Position">
          <Select value={b.position} onChange={(e) => p({ position: e.target.value as BannerSettings["position"] })}>
            <option value="top">Top of the page</option>
            <option value="bottom">Bottom of the page</option>
          </Select>
        </Field>
        <Field label="Layout" hint={b.mode === "push" ? "Fixed headers on your page may still overlap it." : undefined}>
          <Select value={b.mode} onChange={(e) => p({ mode: e.target.value as BannerSettings["mode"] })}>
            <option value="overlay">Over the page</option>
            <option value="push">Push the page down</option>
          </Select>
        </Field>
        <Field label="Tone">
          <Select value={b.tone} onChange={(e) => p({ tone: e.target.value as BannerSettings["tone"] })}>
            {bannerTones.map((t) => (
              <option key={t} value={t}>
                {toneLabels[t]}
              </option>
            ))}
          </Select>
        </Field>
        <ColorField label="Background" value={b.background} onChange={(background) => p({ background })} />
        <ColorField label="Text" value={b.textColor} onChange={(textColor) => p({ textColor })} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Link the text to" hint="Optional. Clicking it counts as completed.">
          <Input className="w-72 max-w-full" value={b.link.url} maxLength={1000} placeholder="https://… or /path" onChange={(e) => p({ link: { ...b.link, url: e.target.value } })} />
        </Field>
        {b.link.url && (
          <label className="mb-2 flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={b.link.newTab} onChange={(e) => p({ link: { ...b.link, newTab: e.target.checked } })} />
            New tab
          </label>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={b.dismissible} onChange={(e) => p({ dismissible: e.target.checked })} />
        People can close it
      </label>
      {!b.dismissible && (
        <p className="text-xs text-gray-500">
          Without a close button the banner stays until a button finishes it, or until its schedule ends. &quot;Show again&quot; on the Targeting tab
          decides whether it returns.
        </p>
      )}
    </div>
  );
}

// ---------- Hotspots ----------

const offsetLabels: Record<Hotspot["offset"], string> = {
  "top-right": "Top right corner",
  "top-left": "Top left corner",
  "bottom-right": "Bottom right corner",
  "bottom-left": "Bottom left corner",
  right: "Right of it",
  left: "Left of it",
};

export function HotspotEditor({
  ws,
  value,
  onChange,
  others,
  theme,
  languages,
}: {
  ws: string;
  value: HotspotContent;
  onChange: (v: HotspotContent) => void;
  others: OtherGuide[];
  theme: Theme;
  languages: string[];
}) {
  const set = (hotspots: Hotspot[]) => onChange({ ...value, hotspots });
  const patch = (i: number, p: Partial<Hotspot>) => set(value.hotspots.map((h, j) => (j === i ? { ...h, ...p } : h)));

  return (
    <div className="space-y-3">
      {value.hotspots.length === 0 && (
        <p className="text-sm text-gray-500">No hotspots yet. The easiest way to add them is the builder on your site.</p>
      )}
      {value.hotspots.map((h, i) => (
        <ListItem
          key={h.id}
          index={i}
          total={value.hotspots.length}
          title={blocksLabel(h.blocks) || "Untitled hotspot"}
          onMove={(d) => set(moveItem(value.hotspots, i, d))}
          onDelete={() => set(value.hotspots.filter((_, j) => j !== i))}
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-3">
              <BlocksEditor
                ws={ws}
                blocks={h.blocks}
                onChange={(blocks) => patch(i, { blocks })}
                others={others}
                context="announcement"
                languages={languages}
              />
              <Field label="Element (CSS selector)" hint={h.selector ? "Pick it on your site with the builder, or edit by hand." : "Required: the hotspot sits on this element."}>
                <Input className="font-mono text-xs" value={h.selector} placeholder="#create-tour-button" onChange={(e) => patch(i, { selector: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Looks like">
                  <Select value={h.style} onChange={(e) => patch(i, { style: e.target.value as Hotspot["style"] })}>
                    <option value="beacon">Pulsing beacon</option>
                    <option value="icon">Icon</option>
                  </Select>
                </Field>
                {h.style === "icon" && (
                  <Field label="Icon">
                    <Select value={h.icon} onChange={(e) => patch(i, { icon: e.target.value as Hotspot["icon"] })}>
                      <option value="help">? (help)</option>
                      <option value="info">i (info)</option>
                    </Select>
                  </Field>
                )}
                <Field label="Sits on">
                  <Select value={h.offset} onChange={(e) => patch(i, { offset: e.target.value as Hotspot["offset"] })}>
                    {hotspotOffsets.map((o) => (
                      <option key={o} value={o}>
                        {offsetLabels[o]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Opens on">
                  <Select value={h.openOn} onChange={(e) => patch(i, { openOn: e.target.value as Hotspot["openOn"] })}>
                    <option value="click">Click</option>
                    <option value="hover">Hover (and click on touch screens)</option>
                  </Select>
                </Field>
                <Field label="Tooltip position">
                  <Select value={h.placement} onChange={(e) => patch(i, { placement: e.target.value as Hotspot["placement"] })}>
                    {placements.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tooltip size">
                  <Select value={h.size} onChange={(e) => patch(i, { size: e.target.value as Hotspot["size"] })}>
                    {stepSizes.map((z) => (
                      <option key={z} value={z}>
                        {sizeLabels[z]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={h.persistent} onChange={(e) => patch(i, { persistent: e.target.checked })} />
                Keep it after it&apos;s opened (help people come back to)
              </label>
              <p className="text-xs text-gray-500">
                {h.persistent
                  ? "It stays on the page; opening it is counted once per user."
                  : h.blocks.some((b) => b.type === "buttons")
                    ? "Its buttons close it for good."
                    : 'A "Got it" button closes it for good.'}
              </p>
            </div>
            <PreviewPane>
              <StepPreview blocks={h.blocks} theme={theme} kind="tooltip" size={h.size} interactive />
            </PreviewPane>
          </div>
        </ListItem>
      ))}
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={value.hotspots.length >= 30}
        onClick={() => set([...value.hotspots, hotspotSchema.parse({ id: newId(), blocks: [newBlock("heading"), newBlock("text")] })])}
      >
        + Add hotspot
      </Button>
    </div>
  );
}

// ---------- Inline card ----------

const positionLabels: Record<InlineContent["position"], string> = {
  before: "Above the element",
  after: "Below the element",
  prepend: "Inside it, at the top",
  append: "Inside it, at the bottom",
  replace: "Instead of the element",
};

// Grey lines around the card stand for the host page, the dark bar for the element.
function InlinePlacementPreview({ position, children }: { position: InlineContent["position"]; children: React.ReactNode }) {
  const line = <div className="h-2.5 rounded bg-slate-300/70" />;
  const element = (
    <div className="rounded-md border-2 border-dashed border-slate-400/70 px-3 py-2 text-[11px] font-medium text-slate-500">The element</div>
  );
  return (
    <div className="w-full space-y-2">
      {line}
      {position === "before" && children}
      {position === "prepend" || position === "append" ? (
        <div className="space-y-2 rounded-md border-2 border-dashed border-slate-400/70 p-2">
          {position === "prepend" && children}
          <div className="text-[11px] font-medium text-slate-500">The element&apos;s own content</div>
          {position === "append" && children}
        </div>
      ) : (
        position !== "replace" && element
      )}
      {(position === "after" || position === "replace") && children}
      {line}
    </div>
  );
}

export function InlineEditor({
  ws,
  value,
  onChange,
  others,
  theme,
  languages,
}: {
  ws: string;
  value: InlineContent;
  onChange: (v: InlineContent) => void;
  others: OtherGuide[];
  theme: Theme;
  languages: string[];
}) {
  const patch = (p: Partial<InlineContent>) => onChange({ ...value, ...p });
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card className="min-w-0 space-y-4 p-5">
        <Field
          label="Element (CSS selector)"
          hint={value.selector ? "Pick it on your site with the visual builder, or edit by hand." : "Required: the card is placed next to this element."}
        >
          <Input className="font-mono text-xs" value={value.selector} placeholder=".empty-state" onChange={(e) => patch({ selector: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Place the card">
            <Select value={value.position} onChange={(e) => patch({ position: e.target.value as InlineContent["position"] })}>
              {inlinePositions.map((p) => (
                <option key={p} value={p}>
                  {positionLabels[p]}
                </option>
              ))}
            </Select>
          </Field>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.dismissible} onChange={(e) => patch({ dismissible: e.target.checked })} />
            People can close it
          </label>
        </div>
        <p className="text-xs text-gray-500">
          The card scrolls with the page. If your app re-renders that part of the page, the card is put back. A Buttons block can finish it
          (&quot;Finish the guide&quot;) or start a tour.
        </p>
        <BlocksEditor
          ws={ws}
          blocks={value.blocks}
          onChange={(blocks) => patch({ blocks })}
          others={others}
          context="announcement"
          languages={languages}
        />
      </Card>
      <PreviewPane note="Takes the width of the place it's put in.">
        <InlinePlacementPreview position={value.position}>
          <StepPreview blocks={value.blocks} theme={theme} kind="inline" size="md" interactive />
        </InlinePlacementPreview>
      </PreviewPane>
    </div>
  );
}
