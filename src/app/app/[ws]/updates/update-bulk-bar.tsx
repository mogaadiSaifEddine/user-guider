"use client";

import { BulkBar, BulkButton } from "@/components/bulk-select";
import { useConfirm } from "@/components/feedback";
import { bulkUpdates } from "./actions";

type Row = { id: string; state: "draft" | "scheduled" | "published"; pinned: boolean; reactions: number };

// Bulk actions over the selected product updates.
export function UpdateBulkBar({ ws, rows }: { ws: string; rows: Row[] }) {
  const confirm = useConfirm();
  const byId = new Map(rows.map((r) => [r.id, r]));

  return (
    <BulkBar noun={["update", "updates"]}>
      {({ selected, run }) => {
        const n = selected.length;
        const picked = selected.map((id) => byId.get(id)).filter((r) => r !== undefined);
        const drafts = picked.filter((r) => r.state === "draft").length;
        const pinned = picked.filter((r) => r.pinned).length;
        const reactions = picked.reduce((sum, r) => sum + r.reactions, 0);

        async function remove() {
          const ok = await confirm({
            title: `Delete ${n} update${n === 1 ? "" : "s"}?`,
            body: (
              <>
                They disappear from your updates page and resource centers
                {reactions > 0 && <>, with {reactions} reaction{reactions === 1 ? "" : "s"}</>}. This can&apos;t be undone.
                {drafts < n && " To hide posts but keep them, unpublish them instead."}
              </>
            ),
            confirmLabel: `Delete ${n} update${n === 1 ? "" : "s"}`,
            danger: true,
          });
          if (ok) run(() => bulkUpdates(ws, selected, "delete"));
        }

        return (
          <>
            <BulkButton count={drafts} total={n} onClick={() => run(() => bulkUpdates(ws, selected, "publish"))}>
              Publish now
            </BulkButton>
            <BulkButton count={n - drafts} total={n} onClick={() => run(() => bulkUpdates(ws, selected, "unpublish"))}>
              Unpublish
            </BulkButton>
            <BulkButton count={n - pinned} total={n} onClick={() => run(() => bulkUpdates(ws, selected, "pin"))}>
              Pin
            </BulkButton>
            <BulkButton count={pinned} total={n} onClick={() => run(() => bulkUpdates(ws, selected, "unpin"))}>
              Unpin
            </BulkButton>
            <BulkButton count={n} total={n} danger onClick={remove}>
              Delete
            </BulkButton>
          </>
        );
      }}
    </BulkBar>
  );
}
