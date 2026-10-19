"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import type { GuideTypeName } from "@/lib/guide-schema";
import { cx } from "@/components/ui";
import { useConfirm, useToast } from "@/components/feedback";
import {
  builderLink,
  deleteGuide,
  duplicateGuide,
  getGuideFootprint,
  publishGuide,
  setGuideStatus,
  type ActionResult,
} from "../actions";

type Row = { id: string; name: string; type: GuideTypeName; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" };

// Icon-only quick actions on a guides list row. Every icon has a tooltip and an aria-label.
export function GuideRowActions({ ws, guide }: { ws: string; guide: Row }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const editor = `/app/${ws}/guides/${guide.id}`;
  const live = guide.status === "PUBLISHED";

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

  // Goes straight to the builder on the page last used in this workspace, like the editor's
  // Visual builder tab. Without a remembered page, opens that tab to ask for one.
  function openBuilder() {
    let pageUrl: string | null = null;
    try {
      pageUrl = localStorage.getItem(`lg.builderUrl.${ws}`);
    } catch {
      // ignore
    }
    if (!pageUrl) return router.push(`${editor}?tab=builder`);
    const tab = window.open("about:blank", "_blank"); // synchronously, so popup blockers allow it
    start(async () => {
      const r = await builderLink(ws, guide.id, pageUrl);
      if (r.ok && r.url) {
        if (tab) tab.location.href = r.url;
        else window.location.href = r.url;
      } else {
        tab?.close();
        toast(r.ok ? "Could not create link" : r.error, "error");
      }
    });
  }

  async function remove() {
    let lost: string[] = [];
    try {
      const { users, answers } = await getGuideFootprint(ws, guide.id);
      lost = [
        users ? `analytics for ${users} user${users === 1 ? "" : "s"} who saw it` : "",
        answers ? `${answers} survey answer${answers === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
    } catch {
      // Still ask; just without the numbers.
    }
    const ok = await confirm({
      title: `Delete "${guide.name}"?`,
      body: (
        <>
          {lost.length > 0 && <>This also deletes {lost.join(" and ")}. </>}
          This can&apos;t be undone.{guide.status !== "ARCHIVED" && " To hide it but keep its data, archive it instead."}
        </>
      ),
      confirmLabel: "Delete guide",
      danger: true,
    });
    if (ok) start(() => deleteGuide(ws, guide.id));
  }

  return (
    <div className={cx("flex items-center gap-0.5", pending && "pointer-events-none opacity-50")}>
      {(guide.type === "TOUR" || guide.type === "HOTSPOT") && guide.status !== "ARCHIVED" && (
        <IconButton label="Open visual builder" onClick={openBuilder}>
          <path d="M3 3l7 17 2.5-7.5L20 10z" />
          <path d="M13 13l6 6" />
        </IconButton>
      )}
      <IconLink label="Analytics" href={`${editor}/analytics`}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </IconLink>
      {live ? (
        <IconButton label="Unpublish" onClick={() => run(() => setGuideStatus(ws, guide.id, "DRAFT"))}>
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </IconButton>
      ) : (
        guide.status === "DRAFT" && (
          <IconButton label="Publish" onClick={() => run(() => publishGuide(ws, guide.id))}>
            <path d="M7 4l13 8-13 8z" />
          </IconButton>
        )
      )}
      <IconButton label="Duplicate" onClick={() => run(() => duplicateGuide(ws, guide.id, false))}>
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
      </IconButton>
      {guide.status === "ARCHIVED" ? (
        <IconButton label="Restore as draft" onClick={() => run(() => setGuideStatus(ws, guide.id, "DRAFT"))}>
          <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </IconButton>
      ) : (
        <IconButton label="Archive" onClick={() => run(() => setGuideStatus(ws, guide.id, "ARCHIVED"))}>
          <rect x="2" y="3" width="20" height="5" rx="1" />
          <path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8M10 12h4" />
        </IconButton>
      )}
      <IconButton label="Delete" danger onClick={remove}>
        <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" />
      </IconButton>
    </div>
  );
}

const iconClass = "rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className={cx(iconClass, danger && "hover:bg-red-50 hover:text-red-600")}>
      <Icon>{children}</Icon>
    </button>
  );
}

function IconLink({ label, href, children }: { label: string; href: string; children: ReactNode }) {
  return (
    <Link href={href} title={label} aria-label={label} className={iconClass}>
      <Icon>{children}</Icon>
    </Link>
  );
}
