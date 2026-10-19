"use client";

import type { ReactNode } from "react";
import {
  newId,
  type ChecklistContent,
  type ChecklistItem,
  type Hotspot,
  type HotspotContent,
} from "@/lib/guide-schema";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { plainText } from "@/lib/format";
import { RichField } from "@/components/rich-text-input";

export type OtherGuide = { id: string; name: string; type: string };

const placements = ["auto", "top", "bottom", "left", "right"] as const;

export function move<T>(list: T[], i: number, dir: -1 | 1) {
  const next = [...list];
  [next[i], next[i + dir]] = [next[i + dir], next[i]];
  return next;
}

export function ListItem({
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
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
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
          title={plainText(h.title) || "Untitled hotspot"}
          onMove={(d) => set(move(value.hotspots, i, d))}
          onDelete={() => set(value.hotspots.filter((_, j) => j !== i))}
        >
          <RichField label="Title" value={h.title} maxLength={200} onChange={(title) => patch(i, { title })} />
          <RichField label="Text" multiline rows={2} value={h.body} maxLength={2000} onChange={(body) => patch(i, { body })} />
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
  const tours = others.filter((g) => g.type === "TOUR" || g.type === "ANNOUNCEMENT" || g.type === "SURVEY");

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <RichField
          label="Checklist title"
          hint="Also the label on the launcher button."
          value={value.title}
          maxLength={200}
          onChange={(title) => patch({ title })}
        />
        <RichField label="Description" multiline rows={2} value={value.description} maxLength={1000} onChange={(description) => patch({ description })} />
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
          title={plainText(it.title) || "Untitled item"}
          onMove={(d) => setItems(move(value.items, i, d))}
          onDelete={() => setItems(value.items.filter((_, j) => j !== i))}
        >
          <RichField label="Title" value={it.title} maxLength={200} onChange={(title) => patchItem(i, { title })} />
          <RichField label="Description" multiline rows={1} value={it.description} maxLength={1000} onChange={(description) => patchItem(i, { description })} />
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
              Your app calls <code className="rounded bg-gray-100 px-1">UserOnboarder.track(&quot;{it.completeOn.name}&quot;)</code>
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
