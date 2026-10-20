"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { Badge, Button, ButtonLink, Card, Field, Input, cx, typeLabels } from "@/components/ui";
import { importUserGuiding, previewUserGuiding, type ImportResult, type UgPreview, type UgSource } from "./actions";

type Preview = Extract<UgPreview, { ok: true }>;

// onlyUpdates: opened from Product updates, so only posts start ticked.
export function UserGuidingImport({ ws, onlyUpdates = false }: { ws: string; onlyUpdates?: boolean }) {
  const [containerId, setContainerId] = useState("");
  const [source, setSource] = useState<UgSource | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectedUpdates, setSelectedUpdates] = useState<Set<number>>(new Set());
  const [opts, setOpts] = useState({
    copyImages: true,
    importTheme: true,
    anyDomain: true,
    publishActive: false,
    publishUpdates: true,
    importUpdatesPage: true,
  });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function load(src: UgSource) {
    setError("");
    setResult(null);
    start(async () => {
      const p = await previewUserGuiding(ws, src);
      if (!p.ok) {
        setError(p.error);
        setPreview(null);
        return;
      }
      setSource(src);
      setPreview(p);
      // Everything except guides that already exist here by name.
      setSelected(new Set(onlyUpdates ? [] : p.items.filter((i) => !i.exists).map((i) => i.ugId)));
      setSelectedUpdates(new Set(p.updates.filter((u) => !u.exists).map((u) => u.ugId)));
    });
  }

  function runImport() {
    if (!source) return;
    setError("");
    start(async () => {
      const r = await importUserGuiding(ws, source, {
        ...opts,
        ugIds: [...selected],
        updateIds: [...selectedUpdates],
        importUpdatesPage: opts.importUpdatesPage && Boolean(preview?.updatesPage),
      });
      if (!r.ok) setError(r.error);
      else setResult(r);
    });
  }

  const counts = useMemo(() => {
    const items = preview?.items ?? [];
    return { tours: items.filter((i) => i.kind === "TOUR").length, checklists: items.filter((i) => i.kind === "CHECKLIST").length };
  }, [preview]);

  if (result?.ok) {
    return (
      <Card className="space-y-5 p-6">
        <div>
          <h2 className="text-lg font-semibold">
            Imported {result.created.length} guides
            {result.updatesCreated.length > 0 && ` and ${result.updatesCreated.length} product updates`}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {opts.publishActive ? "Guides that were active in UserGuiding are live; the rest are drafts." : "They're drafts: review each one, then publish."}{" "}
            {result.imagesCopied > 0 && `${result.imagesCopied} images copied. `}
            {result.imagesFailed > 0 && `${result.imagesFailed} images couldn't be copied and still load from UserGuiding. `}
            {result.themeImported && "Theme colors and font imported. "}
            {result.updatesPageImported && "Updates page title, logo and link imported; turn the page on in Product updates → Page settings."}
          </p>
        </div>
        {result.updatesCreated.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-lg ring-1 ring-gray-200">
            {result.updatesCreated.map((u) => (
              <li key={u.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/app/${ws}/updates/${u.id}`} className="font-medium hover:text-brand-600">
                    {u.title}
                  </Link>
                  <Badge color="brand">Product update</Badge>
                </div>
                {u.warnings.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-amber-700">
                    {u.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        {result.created.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg ring-1 ring-gray-200">
          {result.created.map((g) => (
            <li key={g.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/app/${ws}/guides/${g.id}`} className="font-medium hover:text-brand-600">
                  {g.name}
                </Link>
                <Badge color="brand">{typeLabels[g.kind as keyof typeof typeLabels]}</Badge>
              </div>
              {g.warnings.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-amber-700">
                  {g.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        )}
        <div className="flex gap-2">
          {result.created.length > 0 && <ButtonLink href={`/app/${ws}/guides`}>Go to guides</ButtonLink>}
          {result.updatesCreated.length > 0 && (
            <ButtonLink variant={result.created.length ? "secondary" : "primary"} href={`/app/${ws}/updates`}>
              Go to product updates
            </ButtonLink>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              setPreview(null);
            }}
          >
            Import more
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            load({ containerId });
          }}
        >
          <Field
            label="UserGuiding container id"
            hint={
              <>
                The last value in your UserGuiding snippet, e.g. <code>9KR96062DT9ID</code>, or the address of its{" "}
                <code>user-guiding-…-embedded.js</code> script. You can also paste the whole snippet.
              </>
            }
          >
            <Input value={containerId} onChange={(e) => setContainerId(e.target.value)} placeholder="9KR96062DT9ID" required />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={pending || !containerId.trim()}>{pending && !preview ? "Loading…" : "Load from UserGuiding"}</Button>
            <button type="button" className="text-sm text-gray-500 underline hover:text-gray-800" onClick={() => fileRef.current?.click()}>
              or upload a saved sdk-….json file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) load({ json: await f.text() });
              }}
            />
          </div>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Card>

      {preview && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <div className="font-semibold">
                Found {counts.tours} guides{counts.checklists ? `, ${counts.checklists} checklists` : ""}
                {preview.updates.length ? ` and ${preview.updates.length} product updates` : ""}
                {preview.containerTitle && <span className="font-normal text-gray-500"> in “{preview.containerTitle}”</span>}
              </div>
              {preview.skipped.length > 0 && <div className="mt-0.5 text-xs text-gray-500">Not imported: {preview.skipped.join(", ")}.</div>}
            </div>
            <label className={cx("flex items-center gap-2 text-sm", !preview.items.length && "hidden")}>
              <input
                type="checkbox"
                checked={selected.size === preview.items.length}
                onChange={(e) => setSelected(new Set(e.target.checked ? preview.items.map((i) => i.ugId) : []))}
              />
              Select all
            </label>
          </div>
          <ul className="max-h-[480px] divide-y divide-gray-100 overflow-y-auto">
            {preview.items.map((i) => (
              <li key={`${i.kind}-${i.ugId}`} className={cx("flex gap-3 px-5 py-3", !selected.has(i.ugId) && "opacity-60")}>
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(i.ugId)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(i.ugId);
                    else next.delete(i.ugId);
                    setSelected(next);
                  }}
                  aria-label={`Import ${i.name}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{i.name}</span>
                    <Badge color="brand">{typeLabels[i.kind]}</Badge>
                    <Badge>
                      {i.stepCount} {i.kind === "CHECKLIST" ? "items" : "steps"}
                    </Badge>
                    <Badge color={i.trigger === "auto" ? "green" : "gray"}>{i.trigger === "auto" ? "automatic" : "manual"}</Badge>
                    {!i.active && <Badge color="yellow">inactive in UserGuiding</Badge>}
                    {i.exists && <Badge color="red">already here</Badge>}
                  </div>
                  {i.warnings.length > 0 && (
                    <details className="mt-1 text-xs text-amber-700">
                      <summary className="cursor-pointer">
                        {i.warnings.length} thing{i.warnings.length > 1 ? "s" : ""} to check
                      </summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {i.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {preview.updates.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-2.5">
                <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Product updates</div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedUpdates.size === preview.updates.length}
                    onChange={(e) => setSelectedUpdates(new Set(e.target.checked ? preview.updates.map((u) => u.ugId) : []))}
                  />
                  Select all
                </label>
              </div>
              <ul className="max-h-[400px] divide-y divide-gray-100 overflow-y-auto border-t border-gray-100">
                {preview.updates.map((u) => (
                  <li key={`u-${u.ugId}`} className={cx("flex gap-3 px-5 py-3", !selectedUpdates.has(u.ugId) && "opacity-60")}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedUpdates.has(u.ugId)}
                      onChange={(e) => {
                        const next = new Set(selectedUpdates);
                        if (e.target.checked) next.add(u.ugId);
                        else next.delete(u.ugId);
                        setSelectedUpdates(next);
                      }}
                      aria-label={`Import ${u.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{u.title}</span>
                        <Badge color="brand">Product update</Badge>
                        <Badge>{new Date(u.date).toLocaleDateString("en-GB", { dateStyle: "medium" })}</Badge>
                        {u.labels.map((l) => (
                          <Badge key={l}>{l}</Badge>
                        ))}
                        {u.languages > 1 && <Badge>{u.languages} languages</Badge>}
                        {!u.active && <Badge color="yellow">draft in UserGuiding</Badge>}
                        {u.exists && <Badge color="red">already here</Badge>}
                      </div>
                      {u.warnings.length > 0 && (
                        <details className="mt-1 text-xs text-amber-700">
                          <summary className="cursor-pointer">
                            {u.warnings.length} thing{u.warnings.length > 1 ? "s" : ""} to check
                          </summary>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5">
                            {u.warnings.map((w) => (
                              <li key={w}>{w}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="space-y-2.5 border-t border-gray-100 bg-gray-50 px-5 py-4 text-sm">
            <Option checked={opts.copyImages} onChange={(v) => setOpts({ ...opts, copyImages: v })} label="Copy images to User Onboarder">
              Recommended: images on UserGuiding&apos;s servers may disappear when you cancel UserGuiding.
            </Option>
            <Option checked={opts.anyDomain} onChange={(v) => setOpts({ ...opts, anyDomain: v })} label="Match any domain in page rules">
              Keeps only the path, so <code>https://cms.example.com/#/projects</code> also matches test and local copies.
            </Option>
            {preview.hasTheme && (
              <Option checked={opts.importTheme} onChange={(v) => setOpts({ ...opts, importTheme: v })} label="Import theme">
                Replaces this workspace&apos;s colors, corner radius and font with UserGuiding&apos;s.
              </Option>
            )}
            <Option checked={opts.publishActive} onChange={(v) => setOpts({ ...opts, publishActive: v })} label="Publish guides that are active in UserGuiding">
              Leave off while UserGuiding is still installed, or users will see both.
            </Option>
            {preview.updates.length > 0 && (
              <Option checked={opts.publishUpdates} onChange={(v) => setOpts({ ...opts, publishUpdates: v })} label="Publish product updates that are live in UserGuiding">
                They keep their original dates. Off: they come in as drafts.
              </Option>
            )}
            {preview.updatesPage && (
              <Option checked={opts.importUpdatesPage} onChange={(v) => setOpts({ ...opts, importUpdatesPage: v })} label="Import the updates page header">
                Title{preview.updatesPage.title ? ` (“${preview.updatesPage.title}”)` : ""}, description{preview.updatesPage.hasLogo ? ", logo" : ""} and website link. Labels are always added.
              </Option>
            )}
          </div>
          <div className="flex items-center gap-3 border-t border-gray-100 px-5 py-4">
            <Button onClick={runImport} disabled={pending || selected.size + selectedUpdates.size === 0}>
              {pending
                ? "Importing…"
                : `Import ${[
                    selected.size ? `${selected.size} ${selected.size === 1 ? "guide" : "guides"}` : "",
                    selectedUpdates.size ? `${selectedUpdates.size} ${selectedUpdates.size === 1 ? "update" : "updates"}` : "",
                  ]
                    .filter(Boolean)
                    .join(" and ")}`}
            </Button>
            {pending && <span className="text-sm text-gray-500">Copying images can take a minute.</span>}
          </div>
        </Card>
      )}
    </div>
  );
}

function Option({ checked, onChange, label, children }: { checked: boolean; onChange: (v: boolean) => void; label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-gray-500">{children}</span>
      </span>
    </label>
  );
}
