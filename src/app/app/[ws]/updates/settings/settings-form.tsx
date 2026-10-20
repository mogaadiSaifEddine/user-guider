"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { newId } from "@/lib/guide-schema";
import { labelColors, LABEL_STYLES, type UpdatesPage } from "@/lib/updates";
import { Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { ImageInput } from "@/components/image-input";
import { LabelChip } from "@/components/update-post";
import { saveUpdatesSettings } from "../actions";

export function UpdatesSettingsForm({
  ws,
  base,
  slug: initialSlug,
  suggestedSlug,
  page: initial,
  accent,
}: {
  ws: string;
  base: string;
  slug: string;
  suggestedSlug: string;
  page: UpdatesPage;
  accent: string;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug || suggestedSlug);
  const [page, setPage] = useState(initial);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const patch = (p: Partial<UpdatesPage>) => {
    setPage({ ...page, ...p });
    setNotice(null);
  };
  const setLabel = (i: number, p: Partial<UpdatesPage["labels"][number]>) => patch({ labels: page.labels.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const moveLabel = (i: number, d: -1 | 1) => {
    const labels = [...page.labels];
    [labels[i], labels[i + d]] = [labels[i + d], labels[i]];
    patch({ labels });
  };

  function save(next = page) {
    start(async () => {
      try {
        const r = await saveUpdatesSettings(ws, { slug, page: next });
        setNotice(r.ok ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.error });
        if (r.ok) router.refresh();
      } catch {
        setNotice({ ok: false, text: "Couldn't reach the server. Reload and try again." });
      }
    });
  }

  const live = initial.enabled && initialSlug;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-gray-900">Public page</div>
              <div className="text-xs text-gray-500">Anyone with the link can read your published updates. Drafts and scheduled posts stay hidden.</div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={page.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
              Page is on
            </label>
          </div>
          <Field label="Address" hint="Lowercase letters, numbers and dashes. Changing it breaks links you already shared.">
            <div className="flex items-center rounded-lg ring-1 ring-gray-200 ring-inset focus-within:ring-2 focus-within:ring-brand-500">
              <span className="truncate pl-3 text-sm text-gray-400">{base}</span>
              <input
                value={slug}
                maxLength={64}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  setNotice(null);
                }}
                className="min-w-0 flex-1 border-0 bg-transparent py-1.5 pr-3 text-sm focus:outline-none"
              />
            </div>
          </Field>
          {live && (
            <a href={base + initialSlug} target="_blank" rel="noopener" className="inline-block text-sm font-medium text-brand-600 hover:underline">
              Open {base + initialSlug} ↗
            </a>
          )}
        </Card>

        <Card className="space-y-4 p-5">
          <div className="text-sm font-bold text-gray-900">Header</div>
          <Field label="Title">
            <Input value={page.title} maxLength={120} onChange={(e) => patch({ title: e.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea rows={2} value={page.description} maxLength={300} onChange={(e) => patch({ description: e.target.value })} />
          </Field>
          <Field label="Logo" hint="Shown at the top left. A transparent PNG about 40 px high works best.">
            <ImageInput ws={ws} value={page.logoUrl} onChange={(logoUrl) => patch({ logoUrl })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
            <Field label="Link to your app or website" hint="A button in the header. Leave empty to hide it.">
              <Input value={page.websiteUrl} maxLength={1000} placeholder="https://app.example.com" onChange={(e) => patch({ websiteUrl: e.target.value })} />
            </Field>
            <Field label="Button text">
              <Input value={page.websiteLabel} maxLength={40} onChange={(e) => patch({ websiteLabel: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-1" checked={page.reactions} onChange={(e) => patch({ reactions: e.target.checked })} />
            <span>
              Let readers react 😍 😐 😞 and leave a comment
              <span className="block text-xs text-gray-500">On the page and in the resource center. You see the results on each update.</span>
            </span>
          </label>
        </Card>

        <Card className="space-y-3 p-5">
          <div>
            <div className="text-sm font-bold text-gray-900">Labels</div>
            <div className="text-xs text-gray-500">Tag updates as New, Improvement, Fix… Readers filter the page by label.</div>
          </div>
          {page.labels.map((l, i) => (
            <div key={l.id} className="flex items-center gap-2">
              <div className="flex flex-col">
                <button type="button" className="px-1 text-xs leading-none text-gray-400 hover:text-gray-700 disabled:opacity-30" disabled={i === 0} onClick={() => moveLabel(i, -1)} aria-label="Move up">
                  ▲
                </button>
                <button
                  type="button"
                  className="px-1 text-xs leading-none text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  disabled={i === page.labels.length - 1}
                  onClick={() => moveLabel(i, 1)}
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>
              <Input value={l.name} maxLength={40} onChange={(e) => setLabel(i, { name: e.target.value })} className="flex-1" />
              <Select value={l.color} onChange={(e) => setLabel(i, { color: e.target.value as (typeof labelColors)[number] })} className="w-28">
                {labelColors.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </Select>
              <span className="hidden w-28 sm:block">
                <LabelChip name={l.name || "Label"} color={l.color} />
              </span>
              <Button type="button" variant="ghost" className="text-red-600" onClick={() => patch({ labels: page.labels.filter((_, j) => j !== i) })}>
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={page.labels.length >= 20}
            onClick={() => patch({ labels: [...page.labels, { id: newId().slice(0, 12), name: "", color: labelColors[page.labels.length % labelColors.length] }] })}
          >
            + Add label
          </Button>
          <p className="text-xs text-gray-500">Removing a label takes it off every update.</p>
        </Card>

        {notice && (
          <div className={cx("rounded-md px-4 py-2.5 text-sm", notice.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")} role="status">
            {notice.text}
          </div>
        )}
        <div className="flex justify-end">
          <Button disabled={pending} onClick={() => save()}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Header preview</div>
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {page.logoUrl ? <img src={page.logoUrl} alt="" className="h-6 max-w-[120px] object-contain" /> : <span className="h-6 w-6 rounded-md" style={{ background: accent }} />}
            {page.websiteUrl && (
              <span className="ml-auto rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ background: accent }}>
                {page.websiteLabel}
              </span>
            )}
          </div>
          <div className="px-4 py-6 text-center" style={{ background: `linear-gradient(180deg, ${accent}14, transparent)` }}>
            <div className="text-xl font-extrabold tracking-tight text-gray-900">{page.title || "What's new"}</div>
            {page.description && <div className="mt-1 text-sm text-gray-500">{page.description}</div>}
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {page.labels.map((l) => (
                <span key={l.id} className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: LABEL_STYLES[l.color].fg, background: LABEL_STYLES[l.color].bg }}>
                  {l.name || "Label"}
                </span>
              ))}
            </div>
          </div>
        </Card>
        <Card className="p-4 text-sm text-gray-600">
          <div className="mb-1 font-semibold text-gray-900">In your app</div>
          Add a <b>What&apos;s new</b> section to your resource center to show the latest updates with an unread badge. It links to this page when the page is on.
        </Card>
      </div>
    </div>
  );
}
