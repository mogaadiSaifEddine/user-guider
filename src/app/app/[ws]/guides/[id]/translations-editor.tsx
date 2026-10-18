"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  languageName,
  textFields,
  translationStatus,
  type LocaleTranslations,
  type TextField,
  type Translations,
} from "@/lib/i18n";
import { richText } from "@/lib/format";
import { Badge, Button, Card, Input, cx } from "@/components/ui";
import { RichTextInput } from "@/components/rich-text-input";
import { aiTranslate } from "../../actions";

type Filter = "all" | "missing" | "outdated";

// Translations of a guide's texts, one language at a time, next to the English.
// Edits go into the guide's draft and are saved and published with it.
export function TranslationsEditor({
  ws,
  content,
  languages,
  value,
  onChange,
  aiEnabled,
}: {
  ws: string;
  content: unknown;
  languages: string[];
  value: Translations;
  onChange: (v: Translations) => void;
  aiEnabled: boolean;
}) {
  const targets = languages.slice(1);
  const [locale, setLocale] = useState(targets[0] ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fields = useMemo(() => textFields(content), [content]);
  // Which rows the filter shows is decided when it's picked, so a row doesn't
  // vanish while you type into it (or right after AI fills it in).
  const filtered = useMemo(
    () =>
      new Set(
        fields
          .filter((f) => {
            const e = value[locale]?.[f.key];
            if (filter === "missing") return !e?.text.trim();
            if (filter === "outdated") return Boolean(e?.text.trim() && e.source !== f.text);
            return true;
          })
          .map((f) => f.key),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields, filter, locale],
  );

  if (!targets.length) {
    return (
      <Card className="max-w-2xl space-y-2 p-5 text-sm">
        <div className="font-semibold">Show this guide in your users&apos; languages</div>
        <p className="text-gray-600">
          This workspace only uses English. Add languages in{" "}
          <Link href={`/app/${ws}/settings#languages`} className="font-medium text-indigo-600 hover:underline">
            Settings → Languages
          </Link>
          , then translate each guide here, by hand or with AI. Everyone sees guides in their own language; anything not translated shows in English.
        </p>
      </Card>
    );
  }

  const map: LocaleTranslations = value[locale] ?? {};
  const status = (l: string) => translationStatus(fields, value[l]);
  const current = status(locale);

  function setEntries(entries: Record<string, string | null>, l = locale) {
    const next: LocaleTranslations = { ...(value[l] ?? {}) };
    for (const [key, text] of Object.entries(entries)) {
      const f = fields.find((x) => x.key === key);
      if (!f) continue;
      if (text === null || !text.trim()) delete next[key];
      else next[key] = { text, source: f.text };
    }
    onChange({ ...value, [l]: next });
  }

  function translate(which: "missing" | "outdated") {
    const todo = fields.filter((f) => (which === "missing" ? !map[f.key]?.text.trim() : map[f.key]?.text.trim() && map[f.key].source !== f.text));
    if (!todo.length) return;
    setNotice(null);
    const l = locale;
    start(async () => {
      try {
        const r = await aiTranslate(
          ws,
          l,
          todo.map((f) => ({ key: f.key, text: f.text, rich: f.rich })),
        );
        if (!r.ok) return setNotice({ ok: false, text: r.error });
        setEntries(r.translations ?? {}, l);
        setNotice({ ok: true, text: r.message ?? "Translated." });
      } catch {
        setNotice({ ok: false, text: "Couldn't reach the server. Reload the page and try again." });
      }
    });
  }

  const shown = fields.filter((f) => filtered.has(f.key));
  const groups = [...new Set(shown.map((f) => f.group))];

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {targets.map((l) => {
            const s = status(l);
            const done = s.total > 0 && s.missing === 0 && s.outdated === 0;
            return (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLocale(l);
                  setNotice(null);
                }}
                className={cx(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ring-1",
                  l === locale ? "bg-indigo-50 font-semibold text-indigo-800 ring-indigo-300" : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50",
                )}
              >
                {languageName(l, true)}
                <span className={cx("text-xs tabular-nums", done ? "text-emerald-600" : "text-gray-500")}>
                  {done ? "✓" : `${s.translated - s.outdated}/${s.total}`}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 text-sm">
            {(["all", "missing", "outdated"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cx("rounded-md px-2.5 py-1", filter === f ? "bg-gray-100 font-medium text-gray-900" : "text-gray-500 hover:text-gray-900")}
              >
                {f === "all" ? `All ${current.total}` : f === "missing" ? `Missing ${current.missing}` : `Outdated ${current.outdated}`}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {aiEnabled && current.outdated > 0 && (
              <Button variant="secondary" disabled={pending} onClick={() => translate("outdated")}>
                ✨ Retranslate outdated
              </Button>
            )}
            {aiEnabled && (
              <Button variant="secondary" disabled={pending || current.missing === 0} onClick={() => translate("missing")}>
                {pending ? "Translating…" : `✨ Translate missing with AI`}
              </Button>
            )}
          </div>
        </div>
        {notice && <p className={cx("text-sm", notice.ok ? "text-emerald-700" : "text-red-600")}>{notice.text}</p>}
        <p className="text-xs text-gray-500">
          Users whose language is {languageName(locale)} see these texts; anything left empty shows in English. <strong>Outdated</strong> means
          the English changed after it was translated; the old translation is still shown until you update it. Save and publish to put
          translations live.
        </p>
      </Card>

      {!fields.length && <p className="text-sm text-gray-500">This guide has no text yet.</p>}
      {fields.length > 0 && !shown.length && <p className="text-sm text-gray-500">Nothing {filter} in {languageName(locale)}.</p>}

      {groups.map((g) => (
        <Card key={g} className="p-4">
          <div className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">{g}</div>
          <div className="space-y-4">
            {shown
              .filter((f) => f.group === g)
              .map((f) => (
                <Row key={`${locale}:${f.key}`} field={f} entry={map[f.key]} locale={locale} onChange={(text) => setEntries({ [f.key]: text })} />
              ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Row({
  field: f,
  entry,
  locale,
  onChange,
}: {
  field: TextField;
  entry: { text: string; source: string } | undefined;
  locale: string;
  onChange: (text: string | null) => void;
}) {
  const outdated = Boolean(entry?.text.trim() && entry.source !== f.text);
  return (
    <div className="grid gap-2 md:grid-cols-2 md:gap-4">
      <div className="min-w-0">
        <div className="mb-1 text-xs font-semibold text-gray-700">{f.label}</div>
        <div
          className="rounded-md bg-gray-50 px-2.5 py-1.5 text-sm break-words text-gray-800 ring-1 ring-gray-200"
          dangerouslySetInnerHTML={{ __html: f.rich ? richText(f.text) : f.text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!) }}
        />
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-gray-700">
          {languageName(locale)}
          {outdated && <Badge color="yellow">outdated</Badge>}
          {outdated && (
            <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => onChange(entry!.text)}>
              Still correct
            </button>
          )}
        </div>
        {f.rich ? (
          <RichTextInput
            aria-label={`${f.label} in ${languageName(locale)}`}
            value={entry?.text ?? ""}
            multiline={f.text.includes("\n") || f.text.length > 80}
            rows={2}
            maxLength={5000}
            onChange={(t) => onChange(t)}
          />
        ) : (
          <Input aria-label={`${f.label} in ${languageName(locale)}`} value={entry?.text ?? ""} maxLength={200} onChange={(e) => onChange(e.target.value)} />
        )}
      </div>
    </div>
  );
}
