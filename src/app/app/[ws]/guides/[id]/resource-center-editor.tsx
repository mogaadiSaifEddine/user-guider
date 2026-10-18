"use client";

import { useState, type CSSProperties } from "react";
import {
  launcherIcons,
  newId,
  rcPositions,
  newRcModule,
  rcModuleTypes,
  type LauncherIcon,
  type RcArticle,
  type RcModule,
  type RcModuleType,
  type RcPosition,
  type ResourceCenterContent,
  type Theme,
} from "@/lib/guide-schema";
import { LAUNCHER_ICONS, plainText, richText, svgIcon } from "@/lib/format";
import { StepPreview } from "@/components/step-preview";
import { Button, Card, Field, Input, Select, cx } from "@/components/ui";
import { RichField, RichTextInput } from "@/components/rich-text-input";
import { BlocksEditor } from "./blocks-editor";
import { ListItem, move, type OtherGuide } from "./content-editors";

const moduleNames: Record<RcModuleType, string> = {
  guides: "Guides",
  checklist: "Checklist",
  knowledge: "Knowledge base",
  articles: "Articles",
  links: "Links",
  contact: "Contact",
};

const moduleHints: Record<RcModuleType, string> = {
  guides: "Tours, announcements and surveys people can start themselves.",
  checklist: "An onboarding checklist, shown inside the panel instead of its own launcher.",
  knowledge: "Articles from your knowledge base, in each user's language. Searchable.",
  articles: "Short help articles that open inside the panel.",
  links: "Docs, videos, your status page…",
  contact: "A button to email you, open a page, or open your chat widget.",
};

const iconNames: Record<LauncherIcon, string> = { help: "Question mark", book: "Book", chat: "Chat bubble", sparkle: "Sparkle", rocket: "Rocket" };

const positionNames: Record<RcPosition, string> = {
  "bottom-right": "Bottom right",
  "bottom-left": "Bottom left",
  "center-right": "Center right (side tab)",
  "center-left": "Center left (side tab)",
  "top-right": "Top right",
  "top-left": "Top left",
};

export type KbCollectionOption = { id: string; name: string };

const startable = (g: OtherGuide) => g.type === "TOUR" || g.type === "ANNOUNCEMENT" || g.type === "SURVEY";

export function ResourceCenterEditor({
  ws,
  value,
  onChange,
  others,
  theme,
  kbCollections,
}: {
  ws: string;
  value: ResourceCenterContent;
  onChange: (v: ResourceCenterContent) => void;
  others: OtherGuide[];
  theme: Theme;
  kbCollections: KbCollectionOption[];
}) {
  const [article, setArticle] = useState<RcArticle | null>(null);
  const patch = (p: Partial<ResourceCenterContent>) => onChange({ ...value, ...p });
  const launcher = (p: Partial<ResourceCenterContent["launcher"]>) => patch({ launcher: { ...value.launcher, ...p } });
  const setModules = (modules: RcModule[]) => patch({ modules });
  const setModule = (i: number, m: RcModule) => setModules(value.modules.map((x, j) => (j === i ? m : x)));
  const checklists = others.filter((g) => g.type === "CHECKLIST");

  function add(type: RcModuleType) {
    const guideId = type === "checklist" ? (checklists[0]?.id ?? "") : type === "guides" ? (others.find(startable)?.id ?? "") : "";
    setModules([...value.modules, newRcModule(type, guideId)]);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-4">
        <Card className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RichField label="Title" value={value.title} maxLength={120} onChange={(title) => patch({ title })} />
            <RichField label="Subtitle" value={value.subtitle} maxLength={300} onChange={(subtitle) => patch({ subtitle })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.search} onChange={(e) => patch({ search: e.target.checked })} />
            Search box (searches guides, articles and links)
          </label>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="text-sm font-semibold">Launcher</div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.launcher.show} onChange={(e) => launcher({ show: e.target.checked })} />
            Show a launcher button in the corner
          </label>
          {value.launcher.show ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Label" hint="Empty: a round icon button.">
                <Input value={value.launcher.label} maxLength={40} onChange={(e) => launcher({ label: e.target.value })} />
              </Field>
              <Field label="Icon">
                <Select value={value.launcher.icon} onChange={(e) => launcher({ icon: e.target.value as LauncherIcon })}>
                  {launcherIcons.map((i) => (
                    <option key={i} value={i}>
                      {iconNames[i]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Position">
                <Select
                  value={value.launcher.position}
                  onChange={(e) => launcher({ position: e.target.value as RcPosition })}
                >
                  {rcPositions.map((p) => (
                    <option key={p} value={p}>
                      {positionNames[p]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Open it from your own help button with <code className="rounded bg-gray-100 px-1">LocatifyGuides.openResourceCenter()</code>.
            </p>
          )}
        </Card>

        <div className="pt-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">Sections</div>
        {value.modules.length === 0 && <p className="text-sm text-gray-500">No sections yet. Add one below.</p>}
        {value.modules.map((m, i) => (
          <ListItem
            key={m.id}
            index={i}
            total={value.modules.length}
            title={`${moduleNames[m.type]}${m.type !== "checklist" && m.title ? ` · ${plainText(m.title)}` : ""}`}
            onMove={(d) => setModules(move(value.modules, i, d))}
            onDelete={() => setModules(value.modules.filter((_, j) => j !== i))}
          >
            <ModuleFields
              ws={ws}
              module={m}
              onChange={(nm) => setModule(i, nm)}
              others={others}
              onPreviewArticle={setArticle}
              kbCollections={kbCollections}
            />
          </ListItem>
        ))}
        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold">Add a section</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rcModuleTypes.map((t) => (
              <button
                key={t}
                type="button"
                disabled={value.modules.length >= 20}
                onClick={() => add(t)}
                className="rounded-lg p-3 text-left ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                <div className="text-sm font-semibold">+ {moduleNames[t]}</div>
                <div className="mt-0.5 text-xs text-gray-500">{moduleHints[t]}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="xl:sticky xl:top-20 xl:self-start">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Preview</span>
          {article && (
            <button type="button" className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => setArticle(null)}>
              ← Back to the panel
            </button>
          )}
        </div>
        <div className="flex justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 p-5">
          {article ? (
            <StepPreview blocks={article.blocks} theme={theme} kind="modal" size="sm" interactive />
          ) : (
            <RcPreview value={value} theme={theme} others={others} onArticle={setArticle} kbCollections={kbCollections} />
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Guides and checklists only appear for users they target. Click an article to preview it.
        </p>
      </div>
    </div>
  );
}

// ---------- One section ----------

function ModuleFields({
  ws,
  module: m,
  onChange,
  others,
  onPreviewArticle,
  kbCollections,
}: {
  ws: string;
  module: RcModule;
  onChange: (m: RcModule) => void;
  others: OtherGuide[];
  onPreviewArticle: (a: RcArticle) => void;
  kbCollections: KbCollectionOption[];
}) {
  const titleField =
    m.type !== "checklist" ? (
      <RichField label="Section title" value={m.title} maxLength={120} onChange={(title) => onChange({ ...m, title })} />
    ) : null;

  switch (m.type) {
    case "guides": {
      const options = others.filter(startable);
      const setItems = (items: typeof m.items) => onChange({ ...m, items });
      return (
        <>
          {titleField}
          {m.items.map((it, i) => (
            <div key={it.id} className="space-y-2 rounded-lg bg-gray-50 p-3 ring-1 ring-gray-200">
              <div className="flex gap-2">
                <Select value={it.guideId} onChange={(e) => setItems(m.items.map((x, j) => (j === i ? { ...x, guideId: e.target.value } : x)))}>
                  {!options.some((g) => g.id === it.guideId) && <option value={it.guideId}>{it.guideId ? "Missing guide" : "Pick a guide"}</option>}
                  {options.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
                <RowButtons i={i} list={m.items} onChange={setItems} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <RichTextInput
                  aria-label="Label"
                  placeholder="Label (default: guide name)"
                  value={it.label}
                  maxLength={120}
                  onChange={(label) => setItems(m.items.map((x, j) => (j === i ? { ...x, label } : x)))}
                />
                <RichTextInput
                  aria-label="Description"
                  placeholder="Description (optional)"
                  value={it.description}
                  maxLength={300}
                  onChange={(description) => setItems(m.items.map((x, j) => (j === i ? { ...x, description } : x)))}
                />
              </div>
            </div>
          ))}
          {!options.length && <p className="text-xs text-gray-500">Create a tour, announcement or survey first. Tours set to start only manually work well here.</p>}
          <Button
            type="button"
            variant="secondary"
            disabled={!options.length || m.items.length >= 30}
            onClick={() => setItems([...m.items, { id: newId(), guideId: options[0]?.id ?? "", label: "", description: "" }])}
          >
            + Add guide
          </Button>
        </>
      );
    }
    case "checklist": {
      const options = others.filter((g) => g.type === "CHECKLIST");
      return (
        <Field label="Checklist" hint="Its own corner launcher is hidden on pages where this resource center shows.">
          <Select value={m.guideId} onChange={(e) => onChange({ ...m, guideId: e.target.value })}>
            {!options.some((g) => g.id === m.guideId) && <option value={m.guideId}>{options.length ? "Pick a checklist" : "Create a checklist first"}</option>}
            {options.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
      );
    }
    case "knowledge": {
      const toggle = (id: string, on: boolean) =>
        onChange({ ...m, collectionIds: on ? [...m.collectionIds, id] : m.collectionIds.filter((x) => x !== id) });
      return (
        <>
          {titleField}
          <div>
            <div className="mb-1 text-xs font-semibold text-gray-700">Collections</div>
            {kbCollections.length ? (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!m.collectionIds.length} onChange={() => onChange({ ...m, collectionIds: [] })} />
                  All collections
                </label>
                {kbCollections.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={m.collectionIds.includes(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">No collections yet: every published article shows.</p>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Shows published articles from your{" "}
            <a href={`/app/${ws}/knowledge`} target="_blank" className="font-medium text-indigo-600 hover:underline">
              knowledge base
            </a>{" "}
            in each user&apos;s language. With several collections, people browse by collection. The search box searches the full text.
          </p>
        </>
      );
    }
    case "articles":
      return (
        <>
          {titleField}
          <ArticlesField ws={ws} articles={m.articles} onChange={(articles) => onChange({ ...m, articles })} others={others} onPreview={onPreviewArticle} />
        </>
      );
    case "links": {
      const setLinks = (links: typeof m.links) => onChange({ ...m, links });
      const patchLink = (i: number, p: Partial<(typeof m.links)[number]>) => setLinks(m.links.map((x, j) => (j === i ? { ...x, ...p } : x)));
      return (
        <>
          {titleField}
          {m.links.map((l, i) => (
            <div key={l.id} className="space-y-2 rounded-lg bg-gray-50 p-3 ring-1 ring-gray-200">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <RichTextInput aria-label="Label" placeholder="Label" value={l.label} maxLength={120} onChange={(label) => patchLink(i, { label })} />
                </div>
                <RowButtons i={i} list={m.links} onChange={setLinks} />
              </div>
              <Input placeholder="https://help.example.com" value={l.url} maxLength={1000} onChange={(e) => patchLink(i, { url: e.target.value })} />
              <RichTextInput
                aria-label="Description"
                placeholder="Description (optional)"
                value={l.description}
                maxLength={300}
                onChange={(description) => patchLink(i, { description })}
              />
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={l.newTab} onChange={(e) => patchLink(i, { newTab: e.target.checked })} />
                Open in a new tab
              </label>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={m.links.length >= 30}
            onClick={() => setLinks([...m.links, { id: newId(), label: "", description: "", url: "", newTab: true }])}
          >
            + Add link
          </Button>
        </>
      );
    }
    case "contact":
      return (
        <>
          {titleField}
          <RichField label="Text" multiline rows={2} value={m.text} maxLength={500} onChange={(text) => onChange({ ...m, text })} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Button label">
              <Input value={m.buttonLabel} maxLength={60} onChange={(e) => onChange({ ...m, buttonLabel: e.target.value })} />
            </Field>
            <Field label="Button opens">
              <Select value={m.action} onChange={(e) => onChange({ ...m, action: e.target.value as typeof m.action })}>
                <option value="email">An email</option>
                <option value="url">A page</option>
                <option value="event">Your chat widget (event)</option>
              </Select>
            </Field>
            {m.action !== "event" && (
              <Field label={m.action === "email" ? "Email address" : "Address"}>
                <Input
                  type={m.action === "email" ? "email" : "text"}
                  placeholder={m.action === "email" ? "support@example.com" : "https://example.com/support"}
                  value={m.value}
                  maxLength={1000}
                  onChange={(e) => onChange({ ...m, value: e.target.value })}
                />
              </Field>
            )}
          </div>
          {m.action === "event" && (
            <p className="text-xs text-gray-500">
              The panel closes and your app receives an event. For example:{" "}
              <code className="rounded bg-gray-100 px-1">
                window.addEventListener(&quot;locatify-guides:contact&quot;, () =&gt; Intercom(&quot;show&quot;))
              </code>
            </p>
          )}
        </>
      );
  }
}

function RowButtons<T>({ i, list, onChange }: { i: number; list: T[]; onChange: (l: T[]) => void }) {
  return (
    <>
      <Button type="button" variant="ghost" className="px-2" disabled={i === 0} onClick={() => onChange(move(list, i, -1))} aria-label="Move up">
        ↑
      </Button>
      <Button type="button" variant="ghost" className="px-2" disabled={i === list.length - 1} onClick={() => onChange(move(list, i, 1))} aria-label="Move down">
        ↓
      </Button>
      <Button type="button" variant="ghost" className="px-2 text-red-600" onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label="Remove">
        ✕
      </Button>
    </>
  );
}

function ArticlesField({
  ws,
  articles,
  onChange,
  others,
  onPreview,
}: {
  ws: string;
  articles: RcArticle[];
  onChange: (a: RcArticle[]) => void;
  others: OtherGuide[];
  onPreview: (a: RcArticle) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const patch = (i: number, p: Partial<RcArticle>) => {
    const next = articles.map((x, j) => (j === i ? { ...x, ...p } : x));
    onChange(next);
    if (openId === next[i].id) onPreview(next[i]);
  };

  return (
    <div className="space-y-2">
      {articles.map((a, i) => {
        const open = openId === a.id;
        return (
          <div key={a.id} className={cx("rounded-lg ring-1", open ? "bg-white ring-indigo-300" : "bg-gray-50 ring-gray-200")}>
            <div className="flex items-center gap-1 px-3 py-2">
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                onClick={() => {
                  setOpenId(open ? null : a.id);
                  if (!open) onPreview(a);
                }}
              >
                {plainText(a.title) || "Untitled article"}
              </button>
              <RowButtons i={i} list={articles} onChange={onChange} />
            </div>
            {open && (
              <div className="space-y-3 border-t border-gray-100 p-3">
                <RichField label="Title" value={a.title} maxLength={200} onChange={(title) => patch(i, { title })} />
                <RichField
                  label="Summary"
                  hint="One line under the title in the list. Also searched."
                  value={a.summary}
                  maxLength={300}
                  onChange={(summary) => patch(i, { summary })}
                />
                <BlocksEditor ws={ws} blocks={a.blocks} onChange={(blocks) => patch(i, { blocks })} others={others} context="announcement" />
              </div>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="secondary"
        disabled={articles.length >= 50}
        onClick={() => {
          const a: RcArticle = { id: newId(), title: "", summary: "", blocks: [{ type: "text", id: newId(), text: "", align: "left" }] };
          onChange([...articles, a]);
          setOpenId(a.id);
          onPreview(a);
        }}
      >
        + Add article
      </Button>
    </div>
  );
}

// ---------- Preview (matches sdk/resource-center.ts) ----------

const FONT_STACK = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

function RcPreview({
  value,
  theme,
  others,
  onArticle,
  kbCollections,
}: {
  value: ResourceCenterContent;
  theme: Theme;
  others: OtherGuide[];
  onArticle: (a: RcArticle) => void;
  kbCollections: KbCollectionOption[];
}) {
  const font = theme.fontFamily === "inherit" ? FONT_STACK : theme.fontFamily;
  const iconBox: CSSProperties = { background: `color-mix(in srgb, ${theme.primaryColor} 12%, transparent)`, color: theme.primaryColor };
  const [vertical, side] = value.launcher.position.split("-") as ["bottom" | "center" | "top", "left" | "right"];

  const row = (key: string, label: string, description: string, icon: string, onClick?: () => void) => (
    <li key={key} className={cx("flex items-start gap-3 rounded-lg px-2 py-2", onClick && "cursor-pointer hover:bg-black/[.04]")} onClick={onClick}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs" style={iconBox}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-col pt-0.5">
        <span className="font-semibold" dangerouslySetInnerHTML={{ __html: richText(label || "Untitled") }} />
        {description && <span className="text-[13px] opacity-70" dangerouslySetInnerHTML={{ __html: richText(description) }} />}
      </span>
    </li>
  );

  const section = (m: RcModule, title: string, children: React.ReactNode) => (
    <section key={m.id} className="border-t border-black/[.06] px-2.5 pt-2 pb-1 first:border-t-0">
      {title && <h4 className="mx-2 mt-1 mb-1.5 text-[11px] font-bold tracking-wider uppercase opacity-55">{title}</h4>}
      {children}
    </section>
  );

  const panel = (
      <div
        className="flex w-full max-w-[380px] flex-col overflow-hidden"
        style={{ background: theme.backgroundColor, color: theme.textColor, borderRadius: theme.radius, boxShadow: "0 16px 48px rgba(0,0,0,.2)" }}
      >
        <div className="relative px-[18px] pt-[18px] pb-4 text-white" style={{ background: theme.primaryColor }}>
          <span className="absolute top-2.5 right-3 text-lg opacity-80">×</span>
          {value.title && <div className="mr-6 mb-1 text-[17px] font-semibold" dangerouslySetInnerHTML={{ __html: richText(value.title) }} />}
          {value.subtitle && <div className="text-[13px] opacity-85" dangerouslySetInnerHTML={{ __html: richText(value.subtitle) }} />}
          {value.search && (
            <div className="mt-3 px-3 py-2 text-sm opacity-90" style={{ background: theme.backgroundColor, color: "#9ca3af", borderRadius: theme.radius * 0.7 }}>
              Search
            </div>
          )}
        </div>
        <div className="max-h-[440px] overflow-auto py-1.5">
          {value.modules.map((m) => {
            switch (m.type) {
              case "guides":
                return m.items.length
                  ? section(
                      m,
                      m.title,
                      <ul>
                        {m.items.map((it) => row(it.id, it.label || others.find((g) => g.id === it.guideId)?.name || "", it.description, "▶"))}
                      </ul>,
                    )
                  : null;
              case "articles":
                return m.articles.length
                  ? section(m, m.title, <ul>{m.articles.map((a) => row(a.id, a.title, a.summary, "≡", () => onArticle(a)))}</ul>)
                  : null;
              case "knowledge": {
                const cols = m.collectionIds.length ? kbCollections.filter((c) => m.collectionIds.includes(c.id)) : kbCollections;
                return section(
                  m,
                  m.title,
                  cols.length > 1 ? (
                    <ul>{cols.map((c) => row(c.id, c.name.replace(/[\\*_~+[\]]/g, "\\$&"), "", "▤"))}</ul>
                  ) : (
                    <p className="mx-2 mb-2 text-[13px] opacity-70">Articles from {cols[0]?.name ?? "your knowledge base"} load here.</p>
                  ),
                );
              }
              case "links":
                return m.links.length ? section(m, m.title, <ul>{m.links.map((l) => row(l.id, l.label, l.description, "↗"))}</ul>) : null;
              case "checklist":
                return section(
                  m,
                  others.find((g) => g.id === m.guideId)?.name ?? "Checklist",
                  <div className="mx-2 mb-2 flex items-center gap-2.5 text-xs opacity-80">
                    <div className="h-1.5 flex-1 overflow-hidden rounded bg-black/[.08]">
                      <div className="h-full w-1/3" style={{ background: theme.primaryColor }} />
                    </div>
                    1/3
                  </div>,
                );
              case "contact":
                return section(
                  m,
                  m.title,
                  <div className="px-2 pb-2">
                    {m.text && <p className="mb-2.5 text-[13px] opacity-75" dangerouslySetInnerHTML={{ __html: richText(m.text) }} />}
                    <span
                      className="inline-block px-3.5 py-1.5 font-semibold text-white"
                      style={{ background: theme.primaryColor, borderRadius: theme.radius * 0.7 }}
                    >
                      {m.buttonLabel}
                    </span>
                  </div>,
                );
            }
          })}
          {!value.modules.length && <p className="px-5 py-6 text-center text-sm opacity-60">Add sections to fill the panel.</p>}
        </div>
      </div>
  );

  const tab = vertical === "center";
  const launcherEl = value.launcher.show && (
    <span
      className={cx(
        "flex shrink-0 items-center gap-2 font-semibold text-white shadow-lg",
        tab
          ? cx("px-2.5 py-3.5 [writing-mode:vertical-rl]", side === "right" ? "rounded-l-[var(--r)]" : "rotate-180 rounded-r-[var(--r)]")
          : value.launcher.label
            ? "rounded-full py-2.5 pr-4 pl-3"
            : "h-[52px] w-[52px] justify-center rounded-full",
      )}
      style={{ background: theme.primaryColor, ["--r" as string]: `${theme.radius}px` }}
    >
      <span className={cx("flex", tab && side === "left" && "rotate-180")} dangerouslySetInnerHTML={{ __html: svgIcon(LAUNCHER_ICONS[value.launcher.icon]) }} />
      {value.launcher.label}
    </span>
  );

  return (
    <div
      className={cx("flex w-full gap-3", tab ? "items-center" : "flex-col", side === "right" ? "items-end" : "items-start")}
      style={{ fontFamily: font, fontSize: 14, lineHeight: 1.5 }}
    >
      {tab ? (
        <div className={cx("flex w-full items-center gap-3", side === "right" ? "justify-end" : "flex-row-reverse justify-end")}>
          {panel}
          {launcherEl}
        </div>
      ) : vertical === "top" ? (
        <>
          {launcherEl}
          {panel}
        </>
      ) : (
        <>
          {panel}
          {launcherEl}
        </>
      )}
    </div>
  );
}
