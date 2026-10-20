"use client";

import { BulkBar, BulkButton } from "@/components/bulk-select";
import { useConfirm } from "@/components/feedback";
import { Select } from "@/components/ui";
import { bulkArticles } from "./actions";

type Row = { id: string; status: "DRAFT" | "PUBLISHED"; imported: boolean };

// Bulk actions over the selected knowledge base articles.
export function ArticleBulkBar({ ws, rows, collections }: { ws: string; rows: Row[]; collections: { id: string; name: string }[] }) {
  const confirm = useConfirm();
  const byId = new Map(rows.map((r) => [r.id, r]));

  return (
    <BulkBar noun={["article", "articles"]}>
      {({ selected, run }) => {
        const n = selected.length;
        const live = selected.filter((id) => byId.get(id)?.status === "PUBLISHED").length;
        const imported = selected.some((id) => byId.get(id)?.imported);

        async function remove() {
          const ok = await confirm({
            title: `Delete ${n} article${n === 1 ? "" : "s"}?`,
            body: (
              <>
                They disappear from your resource centers, with their translations. This can&apos;t be undone.
                {live > 0 && " To hide articles but keep them, unpublish them instead."}
                {imported && " Imported articles come back if you import again."}
              </>
            ),
            confirmLabel: `Delete ${n} article${n === 1 ? "" : "s"}`,
            danger: true,
          });
          if (ok) run(() => bulkArticles(ws, selected, "delete"));
        }

        return (
          <>
            <BulkButton count={n - live} total={n} onClick={() => run(() => bulkArticles(ws, selected, "publish"))}>
              Publish
            </BulkButton>
            <BulkButton count={live} total={n} onClick={() => run(() => bulkArticles(ws, selected, "unpublish"))}>
              Unpublish
            </BulkButton>
            <Select
              aria-label="Move to collection"
              className="w-auto py-1 text-xs font-semibold"
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) run(() => bulkArticles(ws, selected, "move", v === "none" ? null : v));
              }}
            >
              <option value="">Move to…</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="none">No collection</option>
            </Select>
            <BulkButton count={n} total={n} danger onClick={remove}>
              Delete
            </BulkButton>
          </>
        );
      }}
    </BulkBar>
  );
}
