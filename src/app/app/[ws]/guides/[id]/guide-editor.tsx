"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type {
  AnnouncementContent,
  ChecklistContent,
  GuideTypeName,
  HotspotContent,
  ResourceCenterContent,
  SurveyContent,
  Targeting,
  Theme,
  TourContent,
  UrlRule,
  UserRule,
} from "@/lib/guide-schema";
import { Badge, Button, ButtonLink, Card, Field, Input, Select, Textarea, cx, statusColors, typeLabels } from "@/components/ui";
import {
  builderLink,
  deleteGuide,
  duplicateGuide,
  publishGuide,
  saveGuide,
  setGuideStatus,
  type ActionResult,
} from "../../actions";
import { ChecklistEditor, HotspotEditor, type OtherGuide } from "./content-editors";
import { AnnouncementEditor, TourEditor } from "./block-content-editors";
import { SurveyEditor } from "./survey-editor";
import { ResourceCenterEditor } from "./resource-center-editor";

type EditorGuide = {
  id: string;
  name: string;
  type: GuideTypeName;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  priority: number;
  content: unknown;
  targeting: Targeting;
  unpublishedChanges: boolean;
  updatedAt: string;
};

export function GuideEditor({
  ws,
  guide,
  others,
  aiEnabled,
  theme,
}: {
  ws: string;
  guide: EditorGuide;
  others: OtherGuide[];
  aiEnabled: boolean;
  theme: Theme;
}) {
  const router = useRouter();
  const [name, setName] = useState(guide.name);
  const [priority, setPriority] = useState(guide.priority);
  const [content, setContent] = useState(guide.content);
  const [targeting, setTargeting] = useState(guide.targeting);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<"content" | "targeting" | "builder">("content");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Pick up edits saved from the builder (another tab) when nothing local is pending.
  useEffect(() => {
    if (dirty) return;
    setName(guide.name);
    setPriority(guide.priority);
    setContent(guide.content);
    setTargeting(guide.targeting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.updatedAt]);

  useEffect(() => {
    const onFocus = () => !dirty && router.refresh();
    const onUnload = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [dirty, router]);

  const edit =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setDirty(true);
      setNotice(null);
    };

  function report(r: ActionResult) {
    setNotice(r.ok ? (r.message ? { kind: "ok", text: r.message } : null) : { kind: "error", text: r.error });
    return r.ok;
  }

  function save(then?: () => Promise<ActionResult>) {
    startTransition(async () => {
      try {
        if (dirty) {
          const r = await saveGuide(ws, guide.id, { name, priority, content, targeting });
          if (!report(r)) return;
          setDirty(false);
          if (!then) setNotice({ kind: "ok", text: guide.status === "PUBLISHED" ? "Saved. Publish to update the live version." : "Saved." });
        }
        if (then) report(await then());
        router.refresh();
      } catch {
        // Usually a new deployment: this page's server action ids no longer exist.
        setNotice({
          kind: "error",
          text: "Couldn't reach the server, or the app was updated since this page loaded. Copy any unsaved text, then reload the page.",
        });
      }
    });
  }

  const live = guide.status === "PUBLISHED";
  const needsPublish = live && (dirty || guide.unpublishedChanges);
  const usesBuilder = guide.type === "TOUR" || guide.type === "HOTSPOT";

  return (
    <div>
      <div className="mb-1 text-sm">
        <Link href={`/app/${ws}/guides`} className="text-gray-500 hover:text-gray-800">
          ← Guides
        </Link>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-xl font-semibold outline-none hover:bg-white focus:bg-white focus:ring-2 focus:ring-indigo-500"
          value={name}
          maxLength={191}
          onChange={(e) => edit(setName)(e.target.value)}
          aria-label="Guide name"
        />
        <Badge color="indigo">{typeLabels[guide.type]}</Badge>
        <Badge color={statusColors[guide.status]}>{live ? "live" : guide.status.toLowerCase()}</Badge>
        {needsPublish && <Badge color="yellow">unpublished changes</Badge>}
      </div>

      <div className="sticky top-0 z-10 -mx-4 mb-5 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-[#f7f7f9]/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex gap-1">
          {(usesBuilder ? (["content", "targeting", "builder"] as const) : (["content", "targeting"] as const)).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cx(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                tab === t ? "bg-white shadow-sm ring-1 ring-gray-200" : "text-gray-600 hover:text-gray-900",
              )}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ButtonLink variant="ghost" href={`/app/${ws}/guides/${guide.id}/analytics`}>
            Analytics
          </ButtonLink>
          <Button variant="secondary" disabled={pending || !dirty} onClick={() => save()}>
            {dirty ? "Save draft" : "Saved"}
          </Button>
          {live ? (
            <>
              <Button variant="secondary" disabled={pending} onClick={() => save(() => setGuideStatus(ws, guide.id, "DRAFT"))}>
                Unpublish
              </Button>
              <Button disabled={pending || !needsPublish} onClick={() => save(() => publishGuide(ws, guide.id))}>
                Publish changes
              </Button>
            </>
          ) : (
            <Button disabled={pending} onClick={() => save(() => publishGuide(ws, guide.id))}>
              Publish
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={cx(
            "mb-4 rounded-md px-4 py-2.5 text-sm",
            notice.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700",
          )}
          role="status"
        >
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {tab === "content" ? (
            <>
              {guide.type === "TOUR" && <TourEditor ws={ws} value={content as TourContent} onChange={edit(setContent)} others={others} theme={theme} />}
              {guide.type === "HOTSPOT" && <HotspotEditor value={content as HotspotContent} onChange={edit(setContent)} />}
              {guide.type === "ANNOUNCEMENT" && (
                <AnnouncementEditor ws={ws} value={content as AnnouncementContent} onChange={edit(setContent)} others={others} theme={theme} />
              )}
              {guide.type === "CHECKLIST" && (
                <ChecklistEditor value={content as ChecklistContent} onChange={edit(setContent)} others={others} />
              )}
              {guide.type === "SURVEY" && <SurveyEditor value={content as SurveyContent} onChange={edit(setContent)} theme={theme} />}
              {guide.type === "RESOURCE_CENTER" && (
                <ResourceCenterEditor ws={ws} value={content as ResourceCenterContent} onChange={edit(setContent)} others={others} theme={theme} />
              )}
            </>
          ) : tab === "builder" ? (
            <div className="max-w-xl">
              <BuilderLauncher ws={ws} guideId={guide.id} dirty={dirty} aiEnabled={aiEnabled} noun={guide.type === "TOUR" ? "steps" : "hotspots"} />
            </div>
          ) : (
            <TargetingEditor
              type={guide.type}
              value={targeting}
              onChange={edit(setTargeting)}
              priority={priority}
              onPriority={edit(setPriority)}
            />
          )}
        </div>

        <aside className="space-y-4">
          {guide.type === "RESOURCE_CENTER" ? (
            <Card className="space-y-2 p-4 text-sm">
              <div className="font-semibold">Open from your app</div>
              <p className="text-gray-500">Open or close the panel from your own help button or menu:</p>
              <code className="block rounded bg-gray-50 p-2 text-xs break-all">LocatifyGuides.openResourceCenter()</code>
              <p className="text-xs text-gray-500">
                Only one resource center shows on a page: the highest priority one whose targeting matches.
              </p>
            </Card>
          ) : (
            <Card className="space-y-2 p-4 text-sm">
              <div className="font-semibold">Manual start</div>
              <p className="text-gray-500">Start this guide from your own code, e.g. a help button:</p>
              <code className="block rounded bg-gray-50 p-2 text-xs break-all">LocatifyGuides.start(&quot;{guide.id}&quot;)</code>
            </Card>
          )}
          <Card className="flex flex-wrap gap-2 p-4">
            <Button variant="secondary" disabled={pending} onClick={() => startTransition(() => duplicateGuide(ws, guide.id))}>
              Duplicate
            </Button>
            {guide.status !== "ARCHIVED" ? (
              <Button variant="secondary" disabled={pending} onClick={() => save(() => setGuideStatus(ws, guide.id, "ARCHIVED"))}>
                Archive
              </Button>
            ) : (
              <Button variant="secondary" disabled={pending} onClick={() => save(() => setGuideStatus(ws, guide.id, "DRAFT"))}>
                Restore
              </Button>
            )}
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                if (confirm(`Delete "${guide.name}" and its analytics? This can't be undone.`)) {
                  startTransition(() => deleteGuide(ws, guide.id));
                }
              }}
            >
              Delete
            </Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}

const tabLabels = { content: "Content", targeting: "Targeting", builder: "Visual builder" } as const;

// ---------- Builder ----------

function BuilderLauncher({
  ws,
  guideId,
  dirty,
  aiEnabled,
  noun,
}: {
  ws: string;
  guideId: string;
  dirty: boolean;
  aiEnabled: boolean;
  noun: string;
}) {
  const storageKey = `lg.builderUrl.${ws}`;
  const [url, setUrl] = useState("");
  const [useAi, setUseAi] = useState(false);
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      setUrl(localStorage.getItem(storageKey) ?? "");
    } catch {
      // ignore
    }
  }, [storageKey]);

  return (
    <Card className="space-y-3 p-4">
      <div>
        <div className="text-sm font-semibold">Visual builder</div>
        <p className="mt-1 text-xs text-gray-500">
          Opens your site with the builder panel. Click elements to attach steps, then save. The snippet must be installed on that page.{" "}
          <a href="/docs/builder" target="_blank" className="font-medium text-indigo-600 hover:underline">
            How it works
          </a>
        </p>
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (dirty && !confirm("You have unsaved changes here. The builder edits the saved draft. Continue?")) return;
          // Open the tab synchronously so popup blockers allow it.
          const tab = window.open("about:blank", "_blank");
          startTransition(async () => {
            const r = await builderLink(ws, guideId, url, useAi ? goal : null);
            if (!r.ok || !r.url) {
              tab?.close();
              setError(r.ok ? "Could not create link" : r.error);
              return;
            }
            try {
              localStorage.setItem(storageKey, url);
            } catch {
              // ignore
            }
            if (tab) tab.location.href = r.url;
            else window.location.href = r.url;
          });
        }}
      >
        <Input type="url" required placeholder="https://cms.locatify.com/dashboard" value={url} onChange={(e) => setUrl(e.target.value)} />
        {aiEnabled && (
          <div className="space-y-2 rounded-md bg-violet-50 p-2.5 ring-1 ring-violet-100">
            <label className="flex items-center gap-2 text-sm font-medium text-violet-900">
              <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
              ✨ Let AI draft the {noun} on that page
            </label>
            {useAi && (
              <>
                <Textarea
                  rows={2}
                  maxLength={1000}
                  placeholder="Goal (optional), e.g. Show new users how to create a project"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
                <p className="text-xs text-violet-800/80">Replaces the current {noun}. You review everything before saving.</p>
              </>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button className="w-full" disabled={pending}>
          {useAi ? "Open builder and draft with AI" : "Open builder"}
        </Button>
      </form>
    </Card>
  );
}

// ---------- Targeting ----------

const urlOps: { v: UrlRule["op"]; l: string }[] = [
  { v: "contains", l: "URL contains" },
  { v: "equals", l: "Path is" },
  { v: "starts_with", l: "Path starts with" },
  { v: "regex", l: "URL matches regex" },
];

const userOps: { v: UserRule["op"]; l: string }[] = [
  { v: "equals", l: "is" },
  { v: "not_equals", l: "is not" },
  { v: "contains", l: "contains" },
  { v: "gt", l: "greater than" },
  { v: "lt", l: "less than" },
  { v: "exists", l: "is set" },
  { v: "not_exists", l: "is not set" },
];

function TargetingEditor({
  type,
  value,
  onChange,
  priority,
  onPriority,
}: {
  type: GuideTypeName;
  value: Targeting;
  onChange: (v: Targeting) => void;
  priority: number;
  onPriority: (v: number) => void;
}) {
  const patch = (p: Partial<Targeting>) => onChange({ ...value, ...p });
  const manualAllowed = type === "TOUR" || type === "ANNOUNCEMENT" || type === "SURVEY";
  const rc = type === "RESOURCE_CENTER";

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <div>
          <div className="text-sm font-semibold">Pages</div>
          <p className="text-xs text-gray-500">
            Shown on pages matching any rule. No rules: every page.{" "}
            <a href="/docs/targeting" target="_blank" className="font-medium text-indigo-600 hover:underline">
              Targeting docs
            </a>
          </p>
        </div>
        {value.urlRules.map((r, i) => (
          <div key={i} className="flex flex-wrap gap-2 sm:flex-nowrap">
            <Select
              className="sm:w-48"
              value={r.op}
              onChange={(e) =>
                patch({ urlRules: value.urlRules.map((x, j) => (j === i ? { ...x, op: e.target.value as UrlRule["op"] } : x)) })
              }
            >
              {urlOps.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </Select>
            <Input
              className="font-mono text-xs"
              placeholder={r.op === "regex" ? "/projects/\\d+" : "/dashboard"}
              value={r.value}
              maxLength={500}
              onChange={(e) => patch({ urlRules: value.urlRules.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
            />
            <Button type="button" variant="ghost" onClick={() => patch({ urlRules: value.urlRules.filter((_, j) => j !== i) })} aria-label="Remove rule">
              ✕
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => patch({ urlRules: [...value.urlRules, { op: "contains", value: "" }] })}>
          + Page rule
        </Button>
      </Card>

      <Card className="space-y-3 p-5">
        <div>
          <div className="text-sm font-semibold">Users</div>
          <p className="text-xs text-gray-500">
            Every rule must match. Attributes come from <code>identify(userId, {"{ plan: \"pro\", … }"})</code>. Dates compare as ISO strings.
          </p>
        </div>
        {value.userRules.map((r, i) => (
          <div key={i} className="flex flex-wrap gap-2 sm:flex-nowrap">
            <Input
              className="font-mono text-xs sm:w-40"
              placeholder="plan"
              value={r.attribute}
              maxLength={100}
              onChange={(e) => patch({ userRules: value.userRules.map((x, j) => (j === i ? { ...x, attribute: e.target.value } : x)) })}
            />
            <Select
              className="sm:w-36"
              value={r.op}
              onChange={(e) =>
                patch({ userRules: value.userRules.map((x, j) => (j === i ? { ...x, op: e.target.value as UserRule["op"] } : x)) })
              }
            >
              {userOps.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </Select>
            {r.op !== "exists" && r.op !== "not_exists" && (
              <Input
                placeholder="pro"
                value={r.value}
                maxLength={500}
                onChange={(e) => patch({ userRules: value.userRules.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
              />
            )}
            <Button type="button" variant="ghost" onClick={() => patch({ userRules: value.userRules.filter((_, j) => j !== i) })} aria-label="Remove rule">
              ✕
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => patch({ userRules: [...value.userRules, { attribute: "", op: "equals", value: "" }] })}
        >
          + User rule
        </Button>
        <label className="flex items-center gap-2 pt-1 text-sm">
          <input type="checkbox" checked={value.includeAnonymous} onChange={(e) => patch({ includeAnonymous: e.target.checked })} />
          Also show to anonymous visitors (not identified)
        </label>
      </Card>

      <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        {rc ? (
          <p className="text-sm text-gray-500 sm:col-span-2">
            The resource center&apos;s launcher appears on every page and for every user its targeting matches. It doesn&apos;t open by itself.
          </p>
        ) : (
          <>
            {manualAllowed ? (
              <Field label="Trigger">
                <Select value={value.trigger} onChange={(e) => patch({ trigger: e.target.value as Targeting["trigger"] })}>
                  <option value="auto">Automatically when targeting matches</option>
                  <option value="manual">Only manually (start() or a checklist)</option>
                </Select>
              </Field>
            ) : (
              <Field label="Trigger" hint={`A ${type === "CHECKLIST" ? "checklist" : "hotspot"} appears as soon as its targeting matches.`}>
                <Input value="Automatically when targeting matches" disabled />
              </Field>
            )}
            <Field label="Show again">
              <Select value={value.frequency} onChange={(e) => patch({ frequency: e.target.value as Targeting["frequency"] })}>
                <option value="once">Never, once seen through or dismissed</option>
                <option value="until_completed">On later visits until completed</option>
                <option value="always">On every page load</option>
              </Select>
            </Field>
            <Field label="Delay (seconds)" hint={manualAllowed ? undefined : "Only used by tours, announcements and surveys."}>
              <Input
                type="number"
                min={0}
                max={600}
                value={value.delaySeconds}
                onChange={(e) => patch({ delaySeconds: Math.max(0, Math.min(600, Number(e.target.value) || 0)) })}
              />
            </Field>
          </>
        )}
        <Field label="Priority" hint={rc ? "Higher wins when several resource centers match one page." : "Higher runs first when several guides match one page."}>
          <Input
            type="number"
            min={-100}
            max={100}
            value={priority}
            onChange={(e) => onPriority(Math.max(-100, Math.min(100, Math.trunc(Number(e.target.value)) || 0)))}
          />
        </Field>
      </Card>
    </div>
  );
}
