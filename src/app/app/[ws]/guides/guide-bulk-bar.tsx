"use client";

import { BulkBar, BulkButton } from "@/components/bulk-select";
import { useConfirm } from "@/components/feedback";
import { bulkGuides, getGuidesFootprint } from "../actions";

type Row = { id: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" };

// Bulk actions over the selected guides. Each button counts only the guides it applies to.
export function GuideBulkBar({ ws, rows }: { ws: string; rows: Row[] }) {
  const confirm = useConfirm();
  const statusOf = new Map(rows.map((r) => [r.id, r.status]));

  return (
    <BulkBar noun={["guide", "guides"]}>
      {({ selected, run }) => {
        const by = (s: Row["status"]) => selected.filter((id) => statusOf.get(id) === s).length;
        const n = selected.length;

        async function remove() {
          let lost: string[] = [];
          try {
            const { users, answers } = await getGuidesFootprint(ws, selected);
            lost = [
              users ? `analytics for ${users} user${users === 1 ? "" : "s"} who saw them` : "",
              answers ? `${answers} survey answer${answers === 1 ? "" : "s"}` : "",
            ].filter(Boolean);
          } catch {
            // Still ask; just without the numbers.
          }
          const ok = await confirm({
            title: `Delete ${n} guide${n === 1 ? "" : "s"}?`,
            body: (
              <>
                {lost.length > 0 && <>This also deletes {lost.join(" and ")}. </>}
                This can&apos;t be undone. To hide guides but keep their data, archive them instead.
              </>
            ),
            confirmLabel: `Delete ${n} guide${n === 1 ? "" : "s"}`,
            danger: true,
          });
          if (ok) run(() => bulkGuides(ws, selected, "delete"));
        }

        return (
          <>
            <BulkButton count={by("DRAFT")} total={n} onClick={() => run(() => bulkGuides(ws, selected, "publish"))}>
              Publish
            </BulkButton>
            <BulkButton count={by("PUBLISHED")} total={n} onClick={() => run(() => bulkGuides(ws, selected, "unpublish"))}>
              Unpublish
            </BulkButton>
            <BulkButton count={n - by("ARCHIVED")} total={n} onClick={() => run(() => bulkGuides(ws, selected, "archive"))}>
              Archive
            </BulkButton>
            <BulkButton count={by("ARCHIVED")} total={n} onClick={() => run(() => bulkGuides(ws, selected, "restore"))}>
              Restore as draft
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
