"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cx } from "@/components/ui";
import { useConfirm, useToast } from "@/components/feedback";
import { IconButton } from "../guides/guide-row-actions";
import {
  duplicateUpdate,
  publishUpdate,
  removeUpdate,
  setUpdatePinned,
  unpublishUpdate,
  type ActionResult,
} from "./actions";

type Row = {
  id: string;
  title: string;
  state: "draft" | "scheduled" | "published";
  pinned: boolean;
  reactions: number;
};

// Icon-only quick actions on a product updates list row, like the guides list.
export function UpdateRowActions({
  ws,
  update,
  postUrl,
}: {
  ws: string;
  update: Row;
  postUrl: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  function run(action: () => Promise<ActionResult>) {
    start(async () => {
      try {
        const r = await action();
        if (r.ok) toast(r.message ?? "Done.");
        else toast(r.error, "error");
      } catch {
        toast(
          "Couldn't reach the server, or the app was updated since this page loaded. Reload the page.",
          "error",
        );
      }
      router.refresh();
    });
  }

  async function copyLink() {
    if (!postUrl) return;
    try {
      await navigator.clipboard.writeText(postUrl);
      toast("Link copied.");
    } catch {
      toast("Couldn't copy. The link is " + postUrl, "error");
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete "${update.title}"?`,
      body: (
        <>
          It disappears from your updates page and resource centers
          {update.reactions > 0 && (
            <>
              , with its {update.reactions} reaction
              {update.reactions === 1 ? "" : "s"}
            </>
          )}
          . This can&apos;t be undone.
          {update.state !== "draft" &&
            " To hide it but keep it, unpublish it instead."}
        </>
      ),
      confirmLabel: "Delete update",
      danger: true,
    });
    if (ok) run(() => removeUpdate(ws, update.id));
  }

  return (
    <div
      className={cx(
        "flex items-center gap-0.5",
        pending && "pointer-events-none opacity-50",
      )}
    >
      {update.state === "published" && postUrl && (
        <>
          <IconButton
            label="View on your updates page"
            onClick={() => window.open(postUrl, "_blank", "noopener")}
          >
            <path d="M14 4h6v6M20 4l-9 9" />
            <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
          </IconButton>
          <IconButton label="Copy link" onClick={copyLink}>
            <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
            <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
          </IconButton>
        </>
      )}
      {update.state === "draft" ? (
        <IconButton
          label="Publish now"
          onClick={() => run(() => publishUpdate(ws, update.id, null))}
        >
          <path d="M7 4l13 8-13 8z" />
        </IconButton>
      ) : (
        <IconButton
          label={
            update.state === "scheduled"
              ? "Cancel schedule (back to draft)"
              : "Unpublish"
          }
          onClick={() => run(() => unpublishUpdate(ws, update.id))}
        >
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </IconButton>
      )}
      <IconButton
        label={update.pinned ? "Unpin" : "Pin to the top"}
        onClick={() =>
          run(() => setUpdatePinned(ws, update.id, !update.pinned))
        }
      >
        {update.pinned ? (
          <>
            <path d="M16 3H8v2l1 1v5l-3 3v2h5v6l1 1 1-1v-6h5v-2l-3-3V6l1-1z" />
            <path d="M3 3l18 18" />
          </>
        ) : (
          <path d="M16 3H8v2l1 1v5l-3 3v2h5v6l1 1 1-1v-6h5v-2l-3-3V6l1-1z" />
        )}
      </IconButton>
      <IconButton
        label="Duplicate"
        onClick={() => run(() => duplicateUpdate(ws, update.id))}
      >
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
      </IconButton>
      <IconButton label="Delete" danger onClick={remove}>
        <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" />
      </IconButton>
    </div>
  );
}
