"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirm } from "@/components/feedback";
import { languageName } from "@/lib/i18n";
import type { KbCollectionTranslations } from "@/lib/kb";
import { Badge, Button, Card, Field, Input, Textarea, cx } from "@/components/ui";
import { createArticle, deleteCollection, reorderCollections, saveCollection, type ActionResult } from "./actions";

export function NewArticleButton({ ws, collectionId }: { ws: string; collectionId: string | null }) {
  const [pending, start] = useTransition();
  return (
    <Button disabled={pending} onClick={() => start(() => createArticle(ws, collectionId))}>
      New article
    </Button>
  );
}

type Collection = { id: string; name: string; description: string; translations: KbCollectionTranslations; source: string | null };

export function CollectionsPanel({ ws, collections, languages }: { ws: string; collections: Collection[]; languages: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function move(i: number, d: -1 | 1) {
    const ids = collections.map((c) => c.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    start(async () => {
      await reorderCollections(ws, ids);
      router.refresh();
    });
  }

  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Collections</div>
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing("new")}>
          + New
        </Button>
      </div>
      {editing === "new" && (
        <CollectionForm
          ws={ws}
          languages={languages}
          onDone={(r) => {
            setResult(r);
            if (r.ok) setEditing(null);
          }}
        />
      )}
      {collections.map((c, i) => (
        <div key={c.id} className="rounded-md ring-1 ring-gray-100">
          <div className="flex items-center gap-1 px-2 py-1.5 text-sm">
            <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => setEditing(editing === c.id ? null : c.id)}>
              {c.name}
            </button>
            {c.source && <Badge>{c.source}</Badge>}
            <button type="button" aria-label="Move up" disabled={pending || i === 0} className="px-1 text-gray-400 hover:text-gray-800 disabled:opacity-30" onClick={() => move(i, -1)}>
              ↑
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={pending || i === collections.length - 1}
              className="px-1 text-gray-400 hover:text-gray-800 disabled:opacity-30"
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
          </div>
          {editing === c.id && (
            <div className="border-t border-gray-100 p-2">
              <CollectionForm
                ws={ws}
                languages={languages}
                collection={c}
                onDone={(r) => {
                  setResult(r);
                  if (r.ok) setEditing(null);
                }}
              />
            </div>
          )}
        </div>
      ))}
      {!collections.length && editing !== "new" && <p className="px-1 text-xs text-gray-500">Group articles into collections, like Billing or Getting started.</p>}
      {result && (
        <p className={cx("text-xs", result.ok ? "text-emerald-700" : "text-red-600")}>{result.ok ? result.message : result.error}</p>
      )}
    </Card>
  );
}

function CollectionForm({
  ws,
  languages,
  collection,
  onDone,
}: {
  ws: string;
  languages: string[];
  collection?: Collection;
  onDone: (r: ActionResult) => void;
}) {
  const confirm = useConfirm();
  const router = useRouter();
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [translations, setTranslations] = useState<KbCollectionTranslations>(collection?.translations ?? {});
  const [pending, start] = useTransition();
  const others = languages.slice(1);

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveCollection(ws, collection?.id ?? null, { name, description, translations });
          onDone(r);
          if (r.ok) router.refresh();
        });
      }}
    >
      <Field label="Name">
        <Input value={name} maxLength={191} onChange={(e) => setName(e.target.value)} autoFocus={!collection} />
      </Field>
      <Field label="Description">
        <Textarea rows={2} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {others.map((l) => (
        <div key={l} className="space-y-1 rounded bg-gray-50 p-2">
          <div className="text-[11px] font-semibold text-gray-600">{languageName(l)}</div>
          <Input
            placeholder={name || "Name"}
            value={translations[l]?.name ?? ""}
            maxLength={191}
            onChange={(e) => setTranslations({ ...translations, [l]: { description: translations[l]?.description ?? "", name: e.target.value } })}
          />
          <Input
            placeholder={description || "Description"}
            value={translations[l]?.description ?? ""}
            maxLength={2000}
            onChange={(e) => setTranslations({ ...translations, [l]: { name: translations[l]?.name ?? "", description: e.target.value } })}
          />
        </div>
      ))}
      <div className="flex gap-2">
        <Button disabled={pending}>{collection ? "Save" : "Create"}</Button>
        {collection && (
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={async () => {
              const ok = await confirm({
                title: `Delete "${collection.name}"?`,
                body: "Its articles stay, without a collection.",
                confirmLabel: "Delete collection",
                danger: true,
              });
              if (!ok) return;
              start(async () => {
                const r = await deleteCollection(ws, collection.id);
                onDone(r);
                router.refresh();
              });
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
