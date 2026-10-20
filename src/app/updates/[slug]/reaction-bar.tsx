"use client";

import { useEffect, useState } from "react";
import { REACTION_EMOJI, reactionKinds, type ReactionKind } from "@/lib/updates";
import { UI_STRINGS_EN, type UiStrings } from "@/lib/ui-strings";

// Reactions under a post on the public page. The reader's choice is kept in
// localStorage so it shows again on their next visit; the server keeps one per browser cookie.

export function ReactionBar({ slug, id, strings = UI_STRINGS_EN }: { slug: string; id: string; strings?: UiStrings }) {
  const storeKey = `uo-reaction:${slug}:${id}`;
  const [mine, setMine] = useState<ReactionKind | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storeKey);
      if (v && (reactionKinds as readonly string[]).includes(v)) setMine(v as ReactionKind);
    } catch {}
  }, [storeKey]);

  async function send(reaction: ReactionKind | null, text?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/updates/${encodeURIComponent(slug)}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reaction, ...(text !== undefined ? { comment: text } : {}) }),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function pick(k: ReactionKind) {
    const next = mine === k ? null : k;
    setMine(next);
    setSent(false);
    try {
      if (next) localStorage.setItem(storeKey, next);
      else localStorage.removeItem(storeKey);
    } catch {}
    await send(next);
  }

  return (
    <div className="mt-6 border-t border-gray-100 pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-gray-600">{mine ? strings.reactThanks : strings.reactPrompt}</span>
        <div className="flex gap-1.5">
          {reactionKinds.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={mine === k}
              aria-label={k}
              disabled={busy}
              onClick={() => pick(k)}
              className={
                "flex h-10 w-10 items-center justify-center rounded-full text-xl transition hover:scale-110 " +
                (mine === k ? "bg-[color-mix(in_srgb,var(--accent)_14%,white)] ring-2 ring-[var(--accent)]" : mine ? "opacity-40 grayscale hover:opacity-100 hover:grayscale-0" : "bg-gray-50 ring-1 ring-gray-200")
              }
            >
              {REACTION_EMOJI[k]}
            </button>
          ))}
        </div>
      </div>
      {mine && !sent && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!comment.trim()) return;
            if (await send(mine, comment)) setSent(true);
          }}
        >
          <textarea
            rows={1}
            maxLength={2000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={strings.reactComment}
            className="min-h-10 flex-1 resize-y rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm ring-1 ring-gray-200 ring-inset focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !comment.trim()}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            {strings.send}
          </button>
        </form>
      )}
    </div>
  );
}
