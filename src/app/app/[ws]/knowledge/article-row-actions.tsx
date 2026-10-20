"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cx } from "@/components/ui";
import { useConfirm, useToast } from "@/components/feedback";
import { IconButton } from "../guides/guide-row-actions";
import { duplicateArticle, removeArticle, setArticleStatus, type ActionResult } from "./actions";

type Row = { id: string; title: string; status: "DRAFT" | "PUBLISHED"; source: string | null };

// Icon-only quick actions on a knowledge base list row, like the guides list.
export function ArticleRowActions({ ws, article }: { ws: string; article: Row }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const live = article.status === "PUBLISHED";

  function run(action: () => Promise<ActionResult>) {
    start(async () => {
      try {
        const r = await action();
        if (r.ok) toast(r.message ?? "Done.");
        else toast(r.error, "error");
      } catch {
        toast("Couldn't reach the server, or the app was updated since this page loaded. Reload the page.", "error");
      }
      router.refresh();
    });
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete "${article.title}"?`,
      body: (
        <>
          It disappears from your resource centers, with its translations. This can&apos;t be undone.
          {live && " To hide it but keep it, unpublish it instead."}
          {article.source && ` Importing from ${article.source} again brings it back.`}
        </>
      ),
      confirmLabel: "Delete article",
      danger: true,
    });
    if (ok) run(() => removeArticle(ws, article.id));
  }

  return (
    <div className={cx("flex items-center gap-0.5", pending && "pointer-events-none opacity-50")}>
      {live ? (
        <IconButton label="Unpublish" onClick={() => run(() => setArticleStatus(ws, article.id, "DRAFT"))}>
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </IconButton>
      ) : (
        <IconButton label="Publish" onClick={() => run(() => setArticleStatus(ws, article.id, "PUBLISHED"))}>
          <path d="M7 4l13 8-13 8z" />
        </IconButton>
      )}
      <IconButton label="Duplicate" onClick={() => run(() => duplicateArticle(ws, article.id))}>
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
      </IconButton>
      <IconButton label="Delete" danger onClick={remove}>
        <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" />
      </IconButton>
    </div>
  );
}
