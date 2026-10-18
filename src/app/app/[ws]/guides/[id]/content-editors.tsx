"use client";

import type { ReactNode } from "react";
import {
  newId,
  type AnnouncementContent,
  type ChecklistContent,
  type ChecklistItem,
  type Hotspot,
  type HotspotContent,
  type TourContent,
  type TourStep,
} from "@/lib/guide-schema";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";

export type OtherGuide = { id: string; name: string; type: string };

const TEXT_HINT = "Supports **bold**, *italic*, [links](https://…) and line breaks.";
const placements = ["auto", "top", "bottom", "left", "right"] as const;

function move<T>(list: T[], i: number, dir: -1 | 1) {
  const next = [...list];
  [next[i], next[i + dir]] = [next[i + dir], next[i]];
  return next;
}

function ListItem({
  index,
  total,
  title,
  onMove,
  onDelete,
  children,
}: {
  index: number;
  total: number;
  title: string;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
        <Button type="button" variant="ghost" className="px-2" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
          ↑
        </Button>
        <Button type="button" variant="ghost" className="px-2" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down">
          ↓
        </Button>
        <Button type="button" variant="ghost" className="px-2 text-red-600" onClick={onDelete} aria-label="Delete">
          ✕
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function SelectorField({ value, onChange, emptyHint }: { value: string; onChange: (v: string) => void; emptyHint: string }) {
  return (
    <Field label="Element (CSS selector)" hint={value ? "Pick it on your site with the builder, or edit by hand." : emptyHint}>
      <Input className="font-mono text-xs" value={value} placeholder="#create-tour-button" onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

// ---------- Tour ----------

export function TourEditor({ value, onChange }: { value: TourContent; onChange: (v: TourContent) => void }) {
  const set = (steps: TourStep[]) => onChange({ ...value, steps });
  const patch = (i: number, p: Partial<TourStep>) => set(value.steps.map((s, j) => (j === i ? { ...s, ...p } : s)));

  return (
    <div className="space-y-3">
      {value.steps.map((s, i) => (
        <ListItem
          key={s.id}
          index={i}
          total={value.steps.length}
          title={s.title || "Untitled step"}
          onMove={(d) => set(move(value.steps, i, d))}
          onDelete={() => set(value.steps.filter((_, j) => j !== i))}
        >
          <Field label="Title">
            <Input value={s.title} maxLength={200} onChange={(e) => patch(i, { title: e.target.value })} />
          </Field>
          <Field label="Text" hint={TEXT_HINT}>
            <Textarea rows={3} value={s.body} maxLength={4000} onChange={(e) => patch(i, { body: e.target.value })} />
          </Field>
          <SelectorField value={s.selector} onChange={(v) => patch(i, { selector: v })} emptyHint="Empty: shown as a centered modal." />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Position">
              <Select value={s.placement} onChange={(e) => patch(i, { placement: e.target.value as TourStep["placement"] })}>
                {placements.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field label="Advance on">
              <Select value={s.advanceOn} onChange={(e) => patch(i, { advanceOn: e.target.value as TourStep["advanceOn"] })}>
                <option value="next">Next button</option>
                <option value="click">Click on element</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" checked={s.backdrop} onChange={(e) => patch(i, { backdrop: e.target.checked })} />
              Dim the page
            </label>
          </div>
        </ListItem>
      ))}
      <Button
        type="button"
        variant="secondary"
        className="w-full border-dashed"
        disabled={value.steps.length >= 50}
        onClick={() =>
          set([...value.steps, { id: newId(), title: "", body: "", selector: "", placement: "auto", advanceOn: "next", backdrop: true }])
        }
      >
        + Add step
      </Button>
    </div>
  );
}

// ---------- Hotspots ----------

export function HotspotEditor({ value, onChange }: { value: HotspotContent; onChange: (v: HotspotContent) => void }) {
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
          title={h.title || "Untitled hotspot"}
          onMove={(d) => set(move(value.hotspots, i, d))}
          onDelete={() => set(value.hotspots.filter((_, j) => j !== i))}
        >
          <Field label="Title">
            <Input value={h.title} maxLength={200} onChange={(e) => patch(i, { title: e.target.value })} />
          </Field>
          <Field label="Text" hint={TEXT_HINT}>
            <Textarea rows={2} value={h.body} maxLength={2000} onChange={(e) => patch(i, { body: e.target.value })} />
          </Field>
          <SelectorField value={h.selector} onChange={(v) => patch(i, { selector: v })} emptyHint="Required: the beacon sits on this element." />
          <Field label="Tooltip position">
            <Select value={h.placement} onChange={(e) => patch(i, { placement: e.target.value as Hotspot["placement"] })}>
              {placements.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
        </ListItem>
      ))}
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => set([...value.hotspots, { id: newId(), title: "", body: "", selector: "", placement: "auto" }])}
      >
        + Add hotspot
      </Button>
    </div>
  );
}

// ---------- Announcement ----------

export function AnnouncementEditor({
  value,
  onChange,
}: {
  value: AnnouncementContent;
  onChange: (v: AnnouncementContent) => void;
}) {
  const patch = (p: Partial<AnnouncementContent>) => onChange({ ...value, ...p });
  return (
    <Card className="space-y-4 p-5">
      <Field label="Format">
        <Select value={value.format} onChange={(e) => patch({ format: e.target.value as AnnouncementContent["format"] })}>
          <option value="modal">Modal (center of the screen)</option>
          <option value="banner">Banner (top of the page)</option>
        </Select>
      </Field>
      <Field label="Title">
        <Input value={value.title} maxLength={200} onChange={(e) => patch({ title: e.target.value })} />
      </Field>
      <Field label="Text" hint={TEXT_HINT}>
        <Textarea rows={4} value={value.body} maxLength={4000} onChange={(e) => patch({ body: e.target.value })} />
      </Field>
      {value.format === "modal" && (
        <Field label="Image URL" hint="Optional header image (https://…).">
          <Input value={value.imageUrl} maxLength={1000} onChange={(e) => patch({ imageUrl: e.target.value })} />
        </Field>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Button text" hint="Empty: no button, only the close ×.">
          <Input value={value.buttonText} maxLength={100} onChange={(e) => patch({ buttonText: e.target.value })} />
        </Field>
        <Field label="Button link" hint="Optional. Opens in a new tab.">
          <Input value={value.buttonUrl} maxLength={1000} placeholder="https://" onChange={(e) => patch({ buttonUrl: e.target.value })} />
        </Field>
      </div>
    </Card>
  );
}

// ---------- Checklist ----------

export function ChecklistEditor({
  value,
  onChange,
  others,
}: {
  value: ChecklistContent;
  onChange: (v: ChecklistContent) => void;
  others: OtherGuide[];
}) {
  const patch = (p: Partial<ChecklistContent>) => onChange({ ...value, ...p });
  const setItems = (items: ChecklistItem[]) => patch({ items });
  const patchItem = (i: number, p: Partial<ChecklistItem>) => setItems(value.items.map((it, j) => (j === i ? { ...it, ...p } : it)));
  const tours = others.filter((g) => g.type === "TOUR" || g.type === "ANNOUNCEMENT");

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <Field label="Checklist title" hint="Also the label on the launcher button.">
          <Input value={value.title} maxLength={200} onChange={(e) => patch({ title: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={value.description} maxLength={1000} onChange={(e) => patch({ description: e.target.value })} />
        </Field>
        <Field label="Launcher position">
          <Select value={value.position} onChange={(e) => patch({ position: e.target.value as ChecklistContent["position"] })}>
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
          </Select>
        </Field>
      </Card>

      {value.items.map((it, i) => (
        <ListItem
          key={it.id}
          index={i}
          total={value.items.length}
          title={it.title || "Untitled item"}
          onMove={(d) => setItems(move(value.items, i, d))}
          onDelete={() => setItems(value.items.filter((_, j) => j !== i))}
        >
          <Field label="Title">
            <Input value={it.title} maxLength={200} onChange={(e) => patchItem(i, { title: e.target.value })} />
          </Field>
          <Field label="Description">
            <Input value={it.description} maxLength={1000} onChange={(e) => patchItem(i, { description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Field label="When clicked">
                <Select
                  value={it.action.type}
                  onChange={(e) => {
                    const t = e.target.value;
                    patchItem(i, {
                      action:
                        t === "tour" ? { type: "tour", guideId: tours[0]?.id ?? "" } : t === "url" ? { type: "url", url: "" } : { type: "none" },
                    });
                  }}
                >
                  <option value="none">Nothing</option>
                  <option value="tour">Start a guide</option>
                  <option value="url">Go to a page</option>
                </Select>
              </Field>
              {it.action.type === "tour" && (
                <Select value={it.action.guideId} onChange={(e) => patchItem(i, { action: { type: "tour", guideId: e.target.value } })}>
                  {!tours.length && <option value="">Create a tour first</option>}
                  {tours.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              )}
              {it.action.type === "url" && (
                <Input
                  placeholder="/projects/new"
                  value={it.action.url}
                  maxLength={1000}
                  onChange={(e) => patchItem(i, { action: { type: "url", url: e.target.value } })}
                />
              )}
            </div>
            <div className="space-y-2">
              <Field label="Done when">
                <Select
                  value={it.completeOn.type}
                  onChange={(e) => {
                    const t = e.target.value;
                    patchItem(i, {
                      completeOn:
                        t === "event"
                          ? { type: "event", name: "" }
                          : t === "guide"
                            ? { type: "guide", guideId: others[0]?.id ?? "" }
                            : { type: "click" },
                    });
                  }}
                >
                  <option value="click">The item is clicked</option>
                  <option value="event">An event is tracked</option>
                  <option value="guide">A guide is completed</option>
                </Select>
              </Field>
              {it.completeOn.type === "event" && (
                <Input
                  className="font-mono text-xs"
                  placeholder="project_created"
                  value={it.completeOn.name}
                  maxLength={191}
                  onChange={(e) => patchItem(i, { completeOn: { type: "event", name: e.target.value } })}
                />
              )}
              {it.completeOn.type === "guide" && (
                <Select value={it.completeOn.guideId} onChange={(e) => patchItem(i, { completeOn: { type: "guide", guideId: e.target.value } })}>
                  {others.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>
          {it.completeOn.type === "event" && it.completeOn.name && (
            <p className="text-xs text-gray-500">
              Your app calls <code className="rounded bg-gray-100 px-1">LocatifyGuides.track(&quot;{it.completeOn.name}&quot;)</code>
            </p>
          )}
        </ListItem>
      ))}
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={value.items.length >= 30}
        onClick={() =>
          setItems([...value.items, { id: newId(), title: "", description: "", action: { type: "none" }, completeOn: { type: "click" } }])
        }
      >
        + Add item
      </Button>
    </div>
  );
}
