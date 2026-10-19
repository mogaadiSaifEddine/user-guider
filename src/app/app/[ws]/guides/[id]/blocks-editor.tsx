"use client";

import { useRef, useState } from "react";
import {
  blockTypes,
  newBlock,
  newId,
  type Block,
  type BlockType,
  type ButtonAction,
  type StepButton,
} from "@/lib/guide-schema";
import { plainText, videoEmbed } from "@/lib/format";
import { Button, Field, Input, Select, cx } from "@/components/ui";
import { RichField } from "@/components/rich-text-input";
import type { OtherGuide } from "./content-editors";

const blockNames: Record<BlockType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  video: "Video",
  buttons: "Buttons",
  divider: "Divider",
  spacer: "Spacer",
};

type Ctx = "tour" | "announcement";

export function BlocksEditor({
  ws,
  blocks,
  onChange,
  others,
  context,
  maxBlocks = 20,
}: {
  ws: string;
  blocks: Block[];
  onChange: (b: Block[]) => void;
  others: OtherGuide[];
  context: Ctx;
  maxBlocks?: number;
}) {
  const [openId, setOpenId] = useState<string | null>(blocks[0]?.id ?? null);
  const set = (i: number, b: Block) => onChange(blocks.map((x, j) => (j === i ? b : x)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...blocks];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const open = openId === b.id;
        return (
          <div key={b.id} className={cx("rounded-lg ring-1", open ? "bg-white ring-brand-300" : "bg-gray-50 ring-gray-200")}>
            <div className="flex items-center gap-1 px-3 py-2">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpenId(open ? null : b.id)}>
                <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200">
                  {blockNames[b.type]}
                </span>
                <span className="truncate text-sm text-gray-600">{summary(b)}</span>
              </button>
              <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </IconButton>
              <IconButton label="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}>
                ↓
              </IconButton>
              <IconButton label="Delete block" onClick={() => onChange(blocks.filter((_, j) => j !== i))}>
                ✕
              </IconButton>
            </div>
            {open && (
              <div className="space-y-3 border-t border-gray-100 px-3 pt-3 pb-3">
                <BlockFields ws={ws} block={b} onChange={(nb) => set(i, nb)} others={others} context={context} />
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {blockTypes.map((t) => (
          <button
            key={t}
            type="button"
            disabled={blocks.length >= maxBlocks}
            onClick={() => {
              const b = newBlock(t);
              onChange([...blocks, b]);
              setOpenId(b.id);
            }}
            className="rounded-md border border-dashed border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-40"
          >
            + {blockNames[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

function IconButton({ label, children, ...p }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="rounded px-1.5 py-0.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30"
      {...p}
    >
      {children}
    </button>
  );
}

function summary(b: Block) {
  switch (b.type) {
    case "heading":
    case "text":
      return plainText(b.text.split("\n")[0]) || "Empty";
    case "image":
      return b.url ? (b.overlay ? `Hero: ${plainText(b.overlay)}` : b.url.split("/").pop()) : "No image yet";
    case "video":
      return b.url || "No video yet";
    case "buttons":
      return b.buttons.map((x) => x.label).join(" · ") || "No buttons";
    case "divider":
      return "";
    case "spacer":
      return `${b.size}px`;
  }
}

function AlignSelect({ value, onChange }: { value: "left" | "center" | "right"; onChange: (v: "left" | "center" | "right") => void }) {
  return (
    <Field label="Alignment">
      <Select value={value} onChange={(e) => onChange(e.target.value as "left" | "center" | "right")}>
        <option value="left">Left</option>
        <option value="center">Center</option>
        <option value="right">Right</option>
      </Select>
    </Field>
  );
}

function BlockFields({
  ws,
  block: b,
  onChange,
  others,
  context,
}: {
  ws: string;
  block: Block;
  onChange: (b: Block) => void;
  others: OtherGuide[];
  context: Ctx;
}) {
  switch (b.type) {
    case "heading":
      return (
        <>
          <RichField label="Heading" value={b.text} maxLength={200} onChange={(text) => onChange({ ...b, text })} autoFocus />
          <AlignSelect value={b.align} onChange={(align) => onChange({ ...b, align })} />
        </>
      );
    case "text":
      return (
        <>
          <RichField label="Text" multiline rows={3} value={b.text} maxLength={4000} onChange={(text) => onChange({ ...b, text })} autoFocus />
          <AlignSelect value={b.align} onChange={(align) => onChange({ ...b, align })} />
        </>
      );
    case "image":
      return <ImageFields ws={ws} block={b} onChange={onChange} />;
    case "video": {
      const ok = !b.url || videoEmbed(b.url);
      return (
        <Field label="Video link" hint={ok ? "YouTube or Vimeo page link, or a direct .mp4 / .webm file." : "Not recognized: use a YouTube or Vimeo link, or a .mp4 / .webm file."}>
          <Input value={b.url} maxLength={1000} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => onChange({ ...b, url: e.target.value })} />
        </Field>
      );
    }
    case "buttons":
      return (
        <>
          {b.buttons.map((btn, j) => (
            <ButtonFields
              key={btn.id}
              button={btn}
              others={others}
              context={context}
              onChange={(nb) => onChange({ ...b, buttons: b.buttons.map((x, k) => (k === j ? nb : x)) })}
              onDelete={() => onChange({ ...b, buttons: b.buttons.filter((_, k) => k !== j) })}
            />
          ))}
          <div className="flex flex-wrap items-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={b.buttons.length >= 4}
              onClick={() =>
                onChange({
                  ...b,
                  buttons: [...b.buttons, { id: newId(), label: "Button", style: "secondary", action: { type: context === "tour" ? "next" : "complete" } }],
                })
              }
            >
              + Button
            </Button>
            <div className="w-36">
              <AlignSelect value={b.align} onChange={(align) => onChange({ ...b, align })} />
            </div>
          </div>
        </>
      );
    case "divider":
      return <p className="text-xs text-gray-500">A thin line between blocks.</p>;
    case "spacer":
      return (
        <Field label={`Height: ${b.size}px`}>
          <input type="range" min={4} max={64} value={b.size} onChange={(e) => onChange({ ...b, size: Number(e.target.value) })} className="w-full" />
        </Field>
      );
  }
}

function ImageFields({ ws, block: b, onChange }: { ws: string; block: Extract<Block, { type: "image" }>; onChange: (b: Block) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("workspaceId", ws);
      const res = await fetch("/api/assets", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onChange({ ...b, url: data.url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Input value={b.url} maxLength={1000} placeholder="https://… or upload" onChange={(e) => onChange({ ...b, url: e.target.value })} />
        <Button type="button" variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">PNG, JPEG, GIF or WebP, up to 2 MB.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Height: ${b.height}px`}>
          <input type="range" min={60} max={480} step={10} value={b.height} onChange={(e) => onChange({ ...b, height: Number(e.target.value) })} className="w-full" />
        </Field>
        <Field label="Fit">
          <Select value={b.fit} onChange={(e) => onChange({ ...b, fit: e.target.value as "cover" | "contain" })}>
            <option value="cover">Fill (crop)</option>
            <option value="contain">Fit (whole image)</option>
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={b.edge} onChange={(e) => onChange({ ...b, edge: e.target.checked })} />
        Full width, edge to edge (hero style)
      </label>
      <RichField
        label="Text over the image"
        hint="Optional headline drawn on the image."
        value={b.overlay}
        maxLength={120}
        onChange={(overlay) => onChange({ ...b, overlay })}
      />
      <Field label="Description for screen readers">
        <Input value={b.alt} maxLength={200} onChange={(e) => onChange({ ...b, alt: e.target.value })} />
      </Field>
    </>
  );
}

const actionLabels: Record<ButtonAction["type"], string> = {
  next: "Go to next step",
  back: "Go to previous step",
  complete: "Finish the guide",
  close: "Close (counts as dismissed)",
  url: "Open a link",
  guide: "Start another guide",
};

function ButtonFields({
  button: btn,
  onChange,
  onDelete,
  others,
  context,
}: {
  button: StepButton;
  onChange: (b: StepButton) => void;
  onDelete: () => void;
  others: OtherGuide[];
  context: Ctx;
}) {
  const startable = others.filter((g) => g.type === "TOUR" || g.type === "ANNOUNCEMENT" || g.type === "SURVEY");
  const actions = (Object.keys(actionLabels) as ButtonAction["type"][]).filter(
    (a) => context === "tour" || (a !== "next" && a !== "back") || btn.action.type === a,
  );
  const setAction = (type: ButtonAction["type"]): ButtonAction =>
    type === "url" ? { type, url: "", newTab: true } : type === "guide" ? { type, guideId: startable[0]?.id ?? "" } : { type };

  return (
    <div className="space-y-2 rounded-md bg-gray-50 p-2.5 ring-1 ring-gray-200">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <Input value={btn.label} maxLength={60} placeholder="Label" onChange={(e) => onChange({ ...btn, label: e.target.value })} aria-label="Button label" />
        <Select value={btn.style} onChange={(e) => onChange({ ...btn, style: e.target.value as StepButton["style"] })} aria-label="Button style" className="w-28">
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="link">Link</option>
        </Select>
        <IconButton label="Remove button" onClick={onDelete}>
          ✕
        </IconButton>
      </div>
      <Select value={btn.action.type} onChange={(e) => onChange({ ...btn, action: setAction(e.target.value as ButtonAction["type"]) })} aria-label="Button action">
        {actions.map((a) => (
          <option key={a} value={a}>
            {actionLabels[a]}
          </option>
        ))}
      </Select>
      {btn.action.type === "url" && (
        <div className="flex items-center gap-3">
          <Input
            value={btn.action.url}
            maxLength={1000}
            placeholder="https://… or /path"
            onChange={(e) => onChange({ ...btn, action: { type: "url", url: e.target.value, newTab: btn.action.type === "url" && btn.action.newTab } })}
          />
          <label className="flex shrink-0 items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={btn.action.newTab}
              onChange={(e) => onChange({ ...btn, action: { type: "url", url: btn.action.type === "url" ? btn.action.url : "", newTab: e.target.checked } })}
            />
            New tab
          </label>
        </div>
      )}
      {btn.action.type === "guide" && (
        <Select value={btn.action.guideId} onChange={(e) => onChange({ ...btn, action: { type: "guide", guideId: e.target.value } })} aria-label="Guide to start">
          {!startable.length && <option value="">Create another tour or announcement first</option>}
          {startable.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
