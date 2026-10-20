"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useConfirm } from "@/components/feedback";
import { languageName } from "@/lib/i18n";
import { isOutdated, kbHash, type KbTranslation } from "@/lib/kb";
import { plainText } from "@/lib/format";
import {
  REACTION_EMOJI,
  reactionKinds,
  updateState,
  type ReactionCounts,
  type ReactionKind,
  type UpdateContent,
  type UpdateLabel,
  type UpdateTranslations,
} from "@/lib/updates";
import { Badge, Button, Card, Field, Input, cx } from "@/components/ui";
import { RichField } from "@/components/rich-text-input";
import { ImageInput } from "@/components/image-input";
import { LabelChip, UpdateBody, formatUpdateDate } from "@/components/update-post";
import { BlocksEditor } from "../../guides/[id]/blocks-editor";
import type { OtherGuide } from "../../guides/[id]/content-editors";
import { aiTranslateArticle } from "../../knowledge/actions";
import { deleteUpdate, publishUpdate, saveUpdate, unpublishUpdate, type ActionResult } from "../actions";

type Update = {
  id: string;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  coverUrl: string;
  labels: string[];
  pinned: boolean;
  content: UpdateContent;
  translations: UpdateTranslations;
};

type Reactions = {
  counts: ReactionCounts | null;
  comments: { visitor: string; reaction: ReactionKind; comment: string; at: string }[];
};

const MAX_BLOCKS = 400;

// "2026-10-20T14:30" in the author's time zone <-> ISO.
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export function UpdateEditor({
  ws,
  update,
  labels,
  postUrl,
  reactions,
  others,
  languages,
  aiEnabled,
  accent,
}: {
  ws: string;
  update: Update;
  labels: UpdateLabel[];
  postUrl: string | null;
  reactions: Reactions;
  others: OtherGuide[];
  languages: string[];
  aiEnabled: boolean;
  accent: string;
}) {
  const confirm = useConfirm();
  const router = useRouter();
  const [content, setContent] = useState(update.content);
  const [translations, setTranslations] = useState(update.translations);
  const [coverUrl, setCoverUrl] = useState(update.coverUrl);
  const [labelIds, setLabelIds] = useState(update.labels);
  const [pinned, setPinned] = useState(update.pinned);
  const [publishedAt, setPublishedAt] = useState(toLocalInput(update.publishedAt));
  const [scheduleAt, setScheduleAt] = useState<string | null>(null);
  const [lang, setLang] = useState(languages[0]);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  const touch = () => {
    setDirty(true);
    setNotice(null);
  };
  const editContent = (p: Partial<UpdateContent>) => {
    setContent({ ...content, ...p });
    touch();
  };
  const setTranslation = (l: string, t: KbTranslation | null) => {
    const next = { ...translations };
    if (t) next[l] = t;
    else delete next[l];
    setTranslations(next);
    touch();
  };

  function report(r: ActionResult) {
    setNotice(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: r.error });
    return r.ok;
  }

  function save(then?: () => Promise<ActionResult>) {
    start(async () => {
      try {
        if (dirty) {
          const r = await saveUpdate(ws, update.id, {
            content,
            translations,
            coverUrl,
            labels: labelIds,
            pinned,
            publishedAt: update.status === "PUBLISHED" ? fromLocalInput(publishedAt) : null,
          });
          if (!report(r)) return;
          setDirty(false);
        }
        if (then) report(await then());
        router.refresh();
      } catch {
        setNotice({ ok: false, text: "Couldn't reach the server, or the app was updated. Copy unsaved text, then reload." });
      }
    });
  }

  function translateWithAi(l: string) {
    setNotice(null);
    start(async () => {
      try {
        const r = await aiTranslateArticle(ws, l, content);
        if (!r.ok) {
          report(r);
          return;
        }
        setTranslation(l, r.translation!);
        setNotice({ ok: true, text: r.message ?? "Translated." });
      } catch {
        setNotice({ ok: false, text: "Couldn't reach the server. Reload and try again." });
      }
    });
  }

  const state = updateState({ status: update.status, publishedAt: update.publishedAt });
  const t = lang === languages[0] ? null : translations[lang];
  const shown: UpdateContent = lang === languages[0] ? content : (t ?? content);
  const shownLabels = labels.filter((l) => labelIds.includes(l.id));
  const previewDate = update.status === "PUBLISHED" && publishedAt ? fromLocalInput(publishedAt)! : new Date().toISOString();

  return (
    <div>
      <div className="mb-1 text-sm">
        <Link href={`/app/${ws}/updates`} className="text-gray-500 hover:text-gray-800">
          ← Product updates
        </Link>
      </div>
      <div className="sticky top-0 z-10 -mx-4 mb-5 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-[#f6f6fb]/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Badge color={state === "published" ? "green" : state === "scheduled" ? "yellow" : "gray"}>{state}</Badge>
        {state === "scheduled" && <span className="text-xs text-gray-500">Goes live {new Date(update.publishedAt!).toLocaleString()}</span>}
        {state === "published" && postUrl && (
          <a href={postUrl} target="_blank" rel="noopener" className="text-xs font-medium text-brand-600 hover:underline">
            View on your updates page ↗
          </a>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="danger"
            disabled={pending}
            onClick={async () =>
              (await confirm({
                title: "Delete this update?",
                body: "It disappears from your updates page and resource centers, with its reactions. This can't be undone.",
                confirmLabel: "Delete update",
                danger: true,
              })) && start(() => deleteUpdate(ws, update.id))
            }
          >
            Delete
          </Button>
          <Button variant="secondary" disabled={pending || !dirty} onClick={() => save()}>
            {dirty ? "Save" : "Saved"}
          </Button>
          {update.status === "PUBLISHED" ? (
            <Button variant="secondary" disabled={pending} onClick={() => save(() => unpublishUpdate(ws, update.id))}>
              Unpublish
            </Button>
          ) : scheduleAt !== null ? (
            <>
              <Input type="datetime-local" className="w-auto" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
              <Button variant="ghost" onClick={() => setScheduleAt(null)}>
                Cancel
              </Button>
              <Button
                disabled={pending || !scheduleAt || new Date(scheduleAt) <= new Date()}
                onClick={() => save(() => publishUpdate(ws, update.id, fromLocalInput(scheduleAt)))}
              >
                Schedule
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => setScheduleAt(toLocalInput(new Date(Date.now() + 86_400_000).toISOString()).slice(0, 11) + "09:00")}
              >
                Schedule…
              </Button>
              <Button disabled={pending} onClick={() => save(() => publishUpdate(ws, update.id, null))}>
                {dirty ? "Save and publish" : "Publish"}
              </Button>
            </>
          )}
        </div>
      </div>

      {notice && (
        <div className={cx("mb-4 rounded-md px-4 py-2.5 text-sm", notice.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")} role="status">
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="min-w-0 space-y-4">
          {languages.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {languages.map((l, i) => {
                const tr = translations[l];
                const st = i === 0 ? "source" : !tr ? "missing" : isOutdated(content, tr) ? "outdated" : "done";
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={cx(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ring-1",
                      l === lang ? "bg-brand-50 font-semibold text-brand-800 ring-brand-300" : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50",
                    )}
                  >
                    {languageName(l, true)}
                    <span
                      className={cx(
                        "h-2 w-2 rounded-full",
                        st === "source" ? "bg-brand-400" : st === "missing" ? "bg-gray-300" : st === "outdated" ? "bg-amber-400" : "bg-emerald-500",
                      )}
                      title={st}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {lang === languages[0] ? (
            <>
              <Card className="space-y-4 p-5">
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-gray-700">Labels</span>
                    <Link href={`/app/${ws}/updates/settings`} className="text-xs font-medium text-brand-600 hover:underline">
                      Edit labels
                    </Link>
                  </div>
                  {labels.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {labels.map((l) => {
                        const on = labelIds.includes(l.id);
                        return (
                          <button
                            key={l.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => {
                              setLabelIds(on ? labelIds.filter((x) => x !== l.id) : [...labelIds, l.id]);
                              touch();
                            }}
                            className={cx("rounded-full transition", on ? "ring-2 ring-brand-300 ring-offset-1" : "opacity-45 grayscale hover:opacity-80")}
                          >
                            <LabelChip name={l.name} color={l.color} />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No labels yet.</p>
                  )}
                </div>
                <Field label="Cover image" hint="Shown above the post and in the resource center. Wide images (2:1) look best.">
                  <ImageInput ws={ws} value={coverUrl} onChange={(v) => (setCoverUrl(v), touch())} />
                </Field>
                <div className="flex flex-wrap items-end gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={pinned} onChange={(e) => (setPinned(e.target.checked), touch())} />
                    Pin to the top
                  </label>
                  {update.status === "PUBLISHED" && (
                    <Field label="Publish date" hint="Shown on the post. A future date hides it until then.">
                      <Input type="datetime-local" value={publishedAt} onChange={(e) => (setPublishedAt(e.target.value), touch())} />
                    </Field>
                  )}
                </div>
              </Card>
              <Card className="space-y-4 p-5">
                <PostFields ws={ws} value={content} onChange={editContent} others={others} />
              </Card>
            </>
          ) : !t ? (
            <Card className="space-y-3 p-5 text-sm">
              <div className="font-semibold">Not translated into {languageName(lang)} yet</div>
              <p className="text-gray-600">Until it is, {languageName(lang)} readers see the English version.</p>
              <div className="flex flex-wrap gap-2">
                {aiEnabled && (
                  <Button disabled={pending} onClick={() => translateWithAi(lang)}>
                    {pending ? "Translating…" : "✨ Translate with AI"}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setTranslation(lang, { ...structuredClone(content), source: kbHash(content) })}>
                  Start from the English text
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="space-y-4 p-5">
              {isOutdated(content, t) && (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  The English changed since this was translated.
                  <div className="ml-auto flex gap-2">
                    {aiEnabled && (
                      <Button variant="secondary" disabled={pending} onClick={() => translateWithAi(lang)}>
                        ✨ Retranslate
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => setTranslation(lang, { ...t, source: kbHash(content) })}>
                      Still correct
                    </Button>
                  </div>
                </div>
              )}
              <PostFields key={lang} ws={ws} value={t} onChange={(p) => setTranslation(lang, { ...t, ...p })} others={others} />
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  className="text-red-600"
                  onClick={async () =>
                    (await confirm({ title: `Remove the ${languageName(lang)} translation?`, confirmLabel: "Remove", danger: true })) &&
                    setTranslation(lang, null)
                  }
                >
                  Remove translation
                </Button>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <div>
            <div className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">Preview · {languageName(lang)}</div>
            <Card className="max-h-[70vh] overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {coverUrl && <img src={coverUrl} alt="" className="aspect-[2/1] w-full object-cover" />}
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {shownLabels.map((l) => (
                    <LabelChip key={l.id} name={l.name} color={l.color} />
                  ))}
                  <span>{formatUpdateDate(previewDate, lang)}</span>
                </div>
                <h2 className="text-xl font-extrabold tracking-tight text-gray-900">{plainText(shown.title) || "Untitled update"}</h2>
                <UpdateBody blocks={shown.blocks} accent={accent} />
              </div>
            </Card>
          </div>
          <ReactionsCard reactions={reactions} />
        </div>
      </div>
    </div>
  );
}

function ReactionsCard({ reactions }: { reactions: Reactions }) {
  const total = reactions.counts ? reactionKinds.reduce((n, k) => n + reactions.counts![k], 0) : 0;
  return (
    <Card className="p-5">
      <div className="mb-3 text-sm font-bold text-gray-900">Reactions</div>
      {!total ? (
        <p className="text-sm text-gray-500">No reactions yet. Readers react on the page and in the resource center.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {reactionKinds.map((k) => (
              <div key={k} className="rounded-xl bg-gray-50 px-3 py-2 text-center ring-1 ring-gray-200/70">
                <div className="text-xl">{REACTION_EMOJI[k]}</div>
                <div className="text-lg font-extrabold tabular-nums">{reactions.counts![k]}</div>
                <div className="text-[11px] text-gray-500 tabular-nums">{Math.round((reactions.counts![k] / total) * 100)}%</div>
              </div>
            ))}
          </div>
          {reactions.comments.length > 0 && (
            <ul className="mt-4 max-h-72 divide-y divide-gray-100 overflow-auto">
              {reactions.comments.map((c) => (
                <li key={c.visitor} className="py-2.5 text-sm">
                  <div className="mb-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <span>{REACTION_EMOJI[c.reaction]}</span>
                    <span className="truncate">{c.visitor.startsWith("u:") ? c.visitor.slice(2) : "Anonymous reader"}</span>
                    <span className="ml-auto shrink-0">{formatUpdateDate(c.at)}</span>
                  </div>
                  <p className="whitespace-pre-line text-gray-800">{c.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

function PostFields({
  ws,
  value,
  onChange,
  others,
}: {
  ws: string;
  value: UpdateContent;
  onChange: (p: Partial<UpdateContent>) => void;
  others: OtherGuide[];
}) {
  return (
    <>
      <RichField label="Title" value={value.title} maxLength={255} onChange={(title) => onChange({ title })} />
      <RichField
        label="Summary"
        hint="One or two lines under the title in lists and in the resource center."
        value={value.summary}
        maxLength={500}
        onChange={(summary) => onChange({ summary })}
      />
      <div>
        <div className="mb-1 text-xs font-semibold text-gray-700">Content</div>
        <BlocksEditor ws={ws} blocks={value.blocks} onChange={(blocks) => onChange({ blocks })} others={others} context="announcement" maxBlocks={MAX_BLOCKS} />
      </div>
    </>
  );
}
