"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type TransitionStartFunction } from "react";
import { useConfirm } from "@/components/feedback";
import { languageName } from "@/lib/i18n";
import type { KbCollectionTranslations } from "@/lib/kb";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Textarea,
  cx,
} from "@/components/ui";
import {
  BulkBar,
  BulkButton,
  BulkSelect,
  RowCheckbox,
} from "@/components/bulk-select";
import {
  createArticle,
  deleteCollection,
  deleteCollections,
  reorderCollections,
  saveCollection,
  type ActionResult,
} from "./actions";

export function NewArticleButton({
  ws,
  collectionId,
}: {
  ws: string;
  collectionId: string | null;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() => start(() => createArticle(ws, collectionId))}
    >
      New article
    </Button>
  );
}

type Collection = {
  id: string;
  name: string;
  description: string;
  translations: KbCollectionTranslations;
  source: string | null;
  articles: number;
};

// Asks, then deletes. With articles in the collection, a checkbox in the dialog
// decides whether they go too or just lose their collection. The dialog must open
// outside a transition: React holds a transition's updates until it finishes, so
// a confirm awaited inside one never shows. Only the server call runs in `start`.
function useDeleteCollection(ws: string) {
  const confirm = useConfirm();
  const router = useRouter();
  const params = useSearchParams();
  return async (
    c: Collection,
    start: TransitionStartFunction,
    onResult: (r: ActionResult) => void,
  ) => {
    let withArticles = false;
    const n = `${c.articles} article${c.articles === 1 ? "" : "s"}`;
    const ok = await confirm({
      title: `Delete "${c.name}"?`,
      body: c.articles ? (
        <div className="space-y-3">
          <p>
            It has {n}. Unless you delete them too, they stay, without a
            collection.
          </p>
          <label className="flex items-center gap-2 text-gray-800">
            <input
              type="checkbox"
              onChange={(e) => (withArticles = e.target.checked)}
            />
            Also delete its {n}
          </label>
          {c.source && (
            <p className="text-xs text-gray-500">
              Importing from {c.source} again brings it back.
            </p>
          )}
        </div>
      ) : (
        "It has no articles."
      ),
      confirmLabel: "Delete collection",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const r = await deleteCollection(ws, c.id, withArticles);
      // Don't stay on the filter of a collection that's gone.
      if (r.ok && params.get("c") === c.id)
        router.replace(`/app/${ws}/knowledge`);
      else router.refresh();
      onResult(r);
    });
  };
}

export function CollectionsPanel({
  ws,
  collections,
  languages,
}: {
  ws: string;
  collections: Collection[];
  languages: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const remove = useDeleteCollection(ws);

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
        <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
          Collections
        </div>
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs"
          onClick={() => setEditing("new")}
        >
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
      {collections.length > 0 && (
        <BulkSelect ids={collections.map((c) => c.id)}>
          <div className="-mx-3">
            <CollectionBulkBar ws={ws} collections={collections} />
          </div>
          {collections.map((c, i) => (
            <div key={c.id} className="rounded-md ring-1 ring-gray-100">
              <div className="flex items-center gap-1 px-2 py-1.5 text-sm">
                <RowCheckbox id={c.id} label={c.name} />
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => setEditing(editing === c.id ? null : c.id)}
                >
                  {c.name}
                </button>
                {c.source && <Badge>{c.source}</Badge>}
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={pending || i === 0}
                  className="px-1 text-gray-400 hover:text-gray-800 disabled:opacity-30"
                  onClick={() => move(i, -1)}
                >
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
                <button
                  type="button"
                  aria-label={`Delete ${c.name}`}
                  title="Delete collection"
                  disabled={pending}
                  className="px-1 text-gray-400 hover:text-red-600 disabled:opacity-30"
                  onClick={() =>
                    remove(c, start, (r) => {
                      setResult(r);
                      if (r.ok && editing === c.id) setEditing(null);
                    })
                  }
                >
                  ✕
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
        </BulkSelect>
      )}
      {!collections.length && editing !== "new" && (
        <p className="px-1 text-xs text-gray-500">
          Group articles into collections, like Billing or Getting started.
        </p>
      )}
      {result && (
        <p
          className={cx(
            "text-xs",
            result.ok ? "text-emerald-700" : "text-red-600",
          )}
        >
          {result.ok ? result.message : result.error}
        </p>
      )}
    </Card>
  );
}

// Bulk delete over the selected collections, like the guides list. One checkbox in
// the dialog decides about all their articles at once.
function CollectionBulkBar({
  ws,
  collections,
}: {
  ws: string;
  collections: Collection[];
}) {
  const confirm = useConfirm();
  const router = useRouter();
  const params = useSearchParams();
  const byId = new Map(collections.map((c) => [c.id, c]));

  return (
    <BulkBar
      noun={["collection", "collections"]}
      hint="select some to delete them together"
    >
      {({ selected, run }) => {
        const n = selected.length;
        const picked = selected
          .map((id) => byId.get(id))
          .filter((c): c is Collection => !!c);
        const articles = picked.reduce((sum, c) => sum + c.articles, 0);
        const sources = [
          ...new Set(picked.map((c) => c.source).filter(Boolean)),
        ];
        const label = `${n} collection${n === 1 ? "" : "s"}`;
        const a = `${articles} article${articles === 1 ? "" : "s"}`;

        async function remove() {
          let withArticles = false;
          const ok = await confirm({
            title: `Delete ${label}?`,
            body: articles ? (
              <div className="space-y-3">
                <p>
                  They have {a}. Unless you delete them too, they stay, without
                  a collection.
                </p>
                <label className="flex items-center gap-2 text-gray-800">
                  <input
                    type="checkbox"
                    onChange={(e) => (withArticles = e.target.checked)}
                  />
                  Also delete their {a}
                </label>
                {sources.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Importing from {sources.join(" or ")} again brings imported
                    ones back.
                  </p>
                )}
              </div>
            ) : (
              "They have no articles."
            ),
            confirmLabel: `Delete ${label}`,
            danger: true,
          });
          if (!ok) return;
          run(async () => {
            const r = await deleteCollections(ws, selected, withArticles);
            // Don't stay on the filter of a collection that's gone.
            const c = params.get("c");
            if (r.ok && c && selected.includes(c))
              router.replace(`/app/${ws}/knowledge`);
            return r;
          });
        }

        return (
          <BulkButton count={n} total={n} danger onClick={remove}>
            Delete
          </BulkButton>
        );
      }}
    </BulkBar>
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
  const router = useRouter();
  const remove = useDeleteCollection(ws);
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [translations, setTranslations] = useState<KbCollectionTranslations>(
    collection?.translations ?? {},
  );
  const [pending, start] = useTransition();
  const others = languages.slice(1);

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveCollection(ws, collection?.id ?? null, {
            name,
            description,
            translations,
          });
          onDone(r);
          if (r.ok) router.refresh();
        });
      }}
    >
      <Field label="Name">
        <Input
          value={name}
          maxLength={191}
          onChange={(e) => setName(e.target.value)}
          autoFocus={!collection}
        />
      </Field>
      <Field label="Description">
        <Textarea
          rows={2}
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      {others.map((l) => (
        <div key={l} className="space-y-1 rounded bg-gray-50 p-2">
          <div className="text-[11px] font-semibold text-gray-600">
            {languageName(l)}
          </div>
          <Input
            placeholder={name || "Name"}
            value={translations[l]?.name ?? ""}
            maxLength={191}
            onChange={(e) =>
              setTranslations({
                ...translations,
                [l]: {
                  description: translations[l]?.description ?? "",
                  name: e.target.value,
                },
              })
            }
          />
          <Input
            placeholder={description || "Description"}
            value={translations[l]?.description ?? ""}
            maxLength={2000}
            onChange={(e) =>
              setTranslations({
                ...translations,
                [l]: {
                  name: translations[l]?.name ?? "",
                  description: e.target.value,
                },
              })
            }
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
            onClick={() => remove(collection, start, onDone)}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
