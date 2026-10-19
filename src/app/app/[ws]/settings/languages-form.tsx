"use client";

import { useState, useTransition } from "react";
import { useConfirm } from "@/components/feedback";
import { LANGUAGES, languageName, normalizeLocale } from "@/lib/i18n";
import { UI_STRING_HINTS, UI_STRING_KEYS, type UiStrings } from "@/lib/ui-strings";
import { Badge, Button, Input, Select } from "@/components/ui";
import { aiTranslateUi, updateLanguages, type ActionResult } from "../actions";

export type LanguageInfo = {
  code: string;
  // Interface text the SDK uses for this language before the workspace's overrides.
  builtin: UiStrings;
  hasBuiltin: boolean;
};

// Body of the Languages section: which languages guides are translated into,
// and the SDK's interface text for each.
export function LanguagesForm({
  ws,
  languages: initial,
  uiStrings: initialStrings,
  builtins,
  aiEnabled,
  Notice,
}: {
  ws: string;
  languages: string[];
  uiStrings: Record<string, Partial<UiStrings>>;
  // Built-in interface text for every catalog language and the current ones.
  builtins: Record<string, LanguageInfo>;
  aiEnabled: boolean;
  Notice: (p: { result: ActionResult | null }) => React.ReactNode;
}) {
  const confirm = useConfirm();
  const [languages, setLanguages] = useState(initial);
  const [strings, setStrings] = useState(initialStrings);
  const [adding, setAdding] = useState("");
  const [custom, setCustom] = useState("");
  const [openUi, setOpenUi] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function add(code: string) {
    const n = normalizeLocale(code);
    if (!n) return setResult({ ok: false, error: `"${code}" isn't a language code like de, pt-BR or zh-CN.` });
    if (n !== "en" && !languages.includes(n)) setLanguages([...languages, n]);
    setAdding("");
    setCustom("");
    setResult(null);
  }

  function save() {
    start(async () => setResult(await updateLanguages(ws, { languages, uiStrings: strings })));
  }

  function aiUi(code: string) {
    start(async () => {
      const r = await aiTranslateUi(ws, code);
      if (!r.ok) return setResult(r);
      setStrings({ ...strings, [code]: { ...strings[code], ...r.strings } });
      setResult({ ok: true, message: r.message });
    });
  }

  const available = LANGUAGES.filter((l) => l.code !== "en" && !languages.includes(l.code));

  return (
    <>
      <p className="text-sm text-gray-600">
        Guides are written in English. Add the languages your users speak, then translate each guide on its <strong>Translations</strong> tab
        and each knowledge base article. Users get their language from <code className="rounded bg-gray-100 px-1">setLocale()</code>, a{" "}
        <code className="rounded bg-gray-100 px-1">locale</code> attribute, the page&apos;s <code className="rounded bg-gray-100 px-1">&lt;html lang&gt;</code>{" "}
        or their browser. Anything not translated shows in English.
      </p>

      <ul className="divide-y divide-gray-100 rounded-lg ring-1 ring-gray-200">
        <li className="flex items-center gap-2 px-3 py-2 text-sm">
          <span className="font-medium">English</span>
          <Badge color="indigo">source and fallback</Badge>
        </li>
        {languages.map((code) => {
          const info = builtins[code];
          const own = Object.values(strings[code] ?? {}).filter(Boolean).length;
          return (
            <li key={code} className="px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{languageName(code)}</span>
                <span className="text-xs text-gray-500">{code}</span>
                {!info?.hasBuiltin && !own && <Badge color="yellow">interface text in English</Badge>}
                <div className="ml-auto flex gap-1">
                  <Button type="button" variant="ghost" onClick={() => setOpenUi(openUi === code ? null : code)}>
                    Interface text{own ? ` (${own} custom)` : ""}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Stop showing guides in ${languageName(code)}?`,
                        body: "Translations are kept and come back if you add it again.",
                        confirmLabel: "Remove language",
                      });
                      if (ok)
                        setLanguages(languages.filter((l) => l !== code));
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              {openUi === code && (
                <div className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-gray-600">
                      Text the widgets show around your content. Empty: {info?.hasBuiltin ? "the built-in translation (shown greyed)" : "English"}.
                    </p>
                    {aiEnabled && (
                      <Button type="button" variant="secondary" className="ml-auto" disabled={pending} onClick={() => aiUi(code)}>
                        ✨ Translate with AI
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {UI_STRING_KEYS.map((k) => (
                      <label key={k} className="block">
                        <span className="block text-[11px] text-gray-500">{UI_STRING_HINTS[k]}</span>
                        <Input
                          value={strings[code]?.[k] ?? ""}
                          placeholder={info?.builtin[k]}
                          maxLength={200}
                          onChange={(e) => setStrings({ ...strings, [code]: { ...strings[code], [k]: e.target.value } })}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-end gap-2">
        <Select className="sm:w-64" value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Language to add">
          <option value="">Add a language…</option>
          {available.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name} · {l.native}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" disabled={!adding} onClick={() => add(adding)}>
          Add
        </Button>
        <span className="px-1 text-xs text-gray-400">or code</span>
        <Input className="w-28 font-mono text-xs" placeholder="fr-CA" value={custom} maxLength={35} onChange={(e) => setCustom(e.target.value)} />
        <Button type="button" variant="secondary" disabled={!custom.trim()} onClick={() => add(custom)}>
          Add
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={pending} onClick={save}>
          Save languages
        </Button>
        <Notice result={result} />
      </div>
    </>
  );
}
