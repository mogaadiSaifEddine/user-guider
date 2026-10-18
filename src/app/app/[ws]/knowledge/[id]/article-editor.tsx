"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Theme } from "@/lib/guide-schema";
import { languageName } from "@/lib/i18n";
import { isOutdated, kbHash, type KbContent, type KbTranslation, type KbTranslations } from "@/lib/kb";
import { Badge, Button, Card, Field, Select, cx } from "@/components/ui";
import { RichField } from "@/components/rich-text-input";
import { StepPreview } from "@/components/step-preview";
import { BlocksEditor } from "../../guides/[id]/blocks-editor";
import type { OtherGuide } from "../../guides/[id]/content-editors";
import { aiTranslateArticle, deleteArticle, saveArticle, setArticleStatus, type ActionResult } from "../actions";

type Article = {
  id: string;
  status: "DRAFT" | "PUBLISHED";
  source: "MANUAL" | "ZENDESK" | "INTERCOM";
  externalUrl: string | null;
  collectionId: string | null;
  content: KbContent;
  translations: KbTranslations;
  updatedAt: string;
};

const MAX_BLOCKS = 400;

export function ArticleEditor({
  ws,
  article,
  collections,
  others,
  languages,
  aiEnabled,
  theme,
}: {
  ws: string;
  article: Article;
  collections: { id: string; name: string }[];
  others: OtherGuide[];
  languages: string[];
  aiEnabled: boolean;
  theme: Theme;
}) {
  const router = useRouter();
  const [content, setContent] = useState(article.content);
  const [translations, setTranslations] = useState(article.translations);
  const [collectionId, setCollectionId] = useState(article.collectionId);
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
  const editContent = (p: Partial<KbContent>) => {
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
          if (!report(await saveArticle(ws, article.id, { content, translations, collectionId }))) return;
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

  const live = article.status === "PUBLISHED";
  const t = lang === languages[0] ? null : translations[lang];
  const shown: KbContent = lang === languages[0] ? content : (t ?? content);

  return (
    <div>
      <div className="mb-1 text-sm">
        <Link href={`/app/${ws}/knowledge`} className="text-gray-500 hover:text-gray-800">
          ← Knowledge base
        </Link>
      </div>
      <div className="sticky top-0 z-10 -mx-4 mb-5 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-[#f7f7f9]/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Badge color={live ? "green" : "gray"}>{live ? "published" : "draft"}</Badge>
        {article.source !== "MANUAL" && (
          <span className="text-xs text-gray-500">
            Imported from {article.source === "ZENDESK" ? "Zendesk" : "Intercom"}
            {article.externalUrl && (
              <>
                {" · "}
                <a href={article.externalUrl} target="_blank" rel="noopener" className="text-indigo-600 hover:underline">
                  original
                </a>
              </>
            )}
            . Importing again overwrites edits.
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => confirm("Delete this article in every language?") && start(() => deleteArticle(ws, article.id))}
          >
            Delete
          </Button>
          <Button variant="secondary" disabled={pending || !dirty} onClick={() => save()}>
            {dirty ? "Save" : "Saved"}
          </Button>
          {live ? (
            <Button variant="secondary" disabled={pending} onClick={() => save(() => setArticleStatus(ws, article.id, "DRAFT"))}>
              Unpublish
            </Button>
          ) : (
            <Button disabled={pending} onClick={() => save(() => setArticleStatus(ws, article.id, "PUBLISHED"))}>
              {dirty ? "Save and publish" : "Publish"}
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div className={cx("mb-4 rounded-md px-4 py-2.5 text-sm", notice.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")} role="status">
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          {languages.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {languages.map((l, i) => {
                const tr = translations[l];
                const state = i === 0 ? "source" : !tr ? "missing" : isOutdated(content, tr) ? "outdated" : "done";
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={cx(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ring-1",
                      l === lang ? "bg-indigo-50 font-semibold text-indigo-800 ring-indigo-300" : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50",
                    )}
                  >
                    {languageName(l, true)}
                    <span
                      className={cx(
                        "h-2 w-2 rounded-full",
                        state === "source" ? "bg-indigo-400" : state === "missing" ? "bg-gray-300" : state === "outdated" ? "bg-amber-400" : "bg-emerald-500",
                      )}
                      title={state}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {lang === languages[0] ? (
            <Card className="space-y-4 p-5">
              <Field label="Collection">
                <Select
                  value={collectionId ?? ""}
                  onChange={(e) => {
                    setCollectionId(e.target.value || null);
                    touch();
                  }}
                >
                  <option value="">No collection</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <ArticleFields ws={ws} value={content} onChange={editContent} others={others} />
            </Card>
          ) : !t ? (
            <Card className="space-y-3 p-5 text-sm">
              <div className="font-semibold">Not translated into {languageName(lang)} yet</div>
              <p className="text-gray-600">Until it is, {languageName(lang)} users see the English version.</p>
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
              <ArticleFields
                key={lang}
                ws={ws}
                value={t}
                onChange={(p) => setTranslation(lang, { ...t, ...p })}
                others={others}
              />
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => confirm(`Remove the ${languageName(lang)} translation?`) && setTranslation(lang, null)}
                >
                  Remove translation
                </Button>
              </div>
            </Card>
          )}
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <div className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">Preview · {languageName(lang)}</div>
          <div className="flex justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 p-5">
            <StepPreview
              blocks={[{ type: "heading", id: "_title", text: shown.title, align: "left" }, ...shown.blocks]}
              theme={theme}
              kind="modal"
              size="sm"
              interactive
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">How it reads inside the resource center panel.</p>
        </div>
      </div>
    </div>
  );
}

function ArticleFields({
  ws,
  value,
  onChange,
  others,
}: {
  ws: string;
  value: KbContent;
  onChange: (p: Partial<KbContent>) => void;
  others: OtherGuide[];
}) {
  return (
    <>
      <RichField label="Title" value={value.title} maxLength={255} onChange={(title) => onChange({ title })} />
      <RichField
        label="Summary"
        hint="One line under the title in lists. Also searched."
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
