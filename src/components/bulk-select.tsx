"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Button, cx } from "./ui";
import { useToast } from "./feedback";

// Checkbox selection for dashboard lists, with a bar of bulk actions on top.
// The list page (a server component) wraps its rows in <BulkSelect ids={…}>,
// puts a <RowCheckbox> in each row and a section-specific bar above them.

type Selection = {
  ids: string[];
  selected: string[];
  toggle: (id: string) => void;
  setAll: (on: boolean) => void;
  clear: () => void;
};

const SelectionContext = createContext<Selection | null>(null);

export function useSelection() {
  const s = useContext(SelectionContext);
  if (!s) throw new Error("BulkSelect is missing");
  return s;
}

export function BulkSelect({
  ids,
  children,
}: {
  ids: string[];
  children: ReactNode;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const key = ids.join(",");
  // Rows that left the list (deleted, filtered out) drop out of the selection.
  useEffect(() => {
    const visible = new Set(key ? key.split(",") : []);
    setPicked((p) => {
      const next = new Set([...p].filter((id) => visible.has(id)));
      return next.size === p.size ? p : next;
    });
  }, [key]);

  const value = useMemo<Selection>(
    () => ({
      ids,
      selected: ids.filter((id) => picked.has(id)),
      toggle: (id) =>
        setPicked((p) => {
          const next = new Set(p);
          if (!next.delete(id)) next.add(id);
          return next;
        }),
      setAll: (on) => setPicked(on ? new Set(ids) : new Set()),
      clear: () => setPicked(new Set()),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, picked],
  );
  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

const boxClass =
  "h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-brand-600";

export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      className={boxClass}
      aria-label={`Select ${label}`}
      checked={selected.includes(id)}
      onChange={() => toggle(id)}
    />
  );
}

export type BulkResult =
  { ok: true; message?: string } | { ok: false; error: string };

// The bar over a selectable list: select-all box, count, and the section's actions.
// `children` gets `run`, which calls a server action, toasts its result, clears the
// selection and refreshes the page.
export function BulkBar({
  noun,
  hint = "select some to publish, unpublish or delete them together",
  children,
}: {
  noun: [singular: string, plural: string];
  hint?: string;
  children: (ctx: {
    selected: string[];
    run: (action: () => Promise<BulkResult>) => void;
    pending: boolean;
  }) => ReactNode;
}) {
  const { ids, selected, setAll, clear } = useSelection();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const all = ids.length > 0 && selected.length === ids.length;

  function run(action: () => Promise<BulkResult>) {
    start(async () => {
      try {
        const r = await action();
        if (r.ok) {
          toast(r.message ?? "Done.");
          clear();
        } else toast(r.error, "error");
      } catch {
        toast(
          "Couldn't reach the server, or the app was updated since this page loaded. Reload the page.",
          "error",
        );
      }
      router.refresh();
    });
  }

  return (
    <div
      className={cx(
        "flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 py-2 pr-3 pl-4 first:rounded-t-2xl",
        selected.length ? "bg-brand-50/60" : "bg-gray-50/60",
      )}
    >
      <input
        type="checkbox"
        className={boxClass}
        aria-label={
          all ? "Clear selection" : `Select all ${ids.length} ${noun[1]}`
        }
        checked={all}
        ref={(el) => {
          if (el) el.indeterminate = selected.length > 0 && !all;
        }}
        onChange={() => setAll(!all)}
      />
      {selected.length ? (
        <>
          <span className="text-sm font-semibold text-gray-900 tabular-nums">
            {selected.length} {selected.length === 1 ? noun[0] : noun[1]}{" "}
            selected
          </span>
          <button
            type="button"
            className="text-xs font-medium text-gray-500 hover:text-gray-900"
            onClick={clear}
          >
            Clear
          </button>
          <div
            className={cx(
              "ml-auto flex flex-wrap items-center gap-1.5",
              pending && "pointer-events-none opacity-50",
            )}
          >
            {children({ selected, run, pending })}
          </div>
        </>
      ) : (
        <span className="text-xs text-gray-500">
          {ids.length} {ids.length === 1 ? noun[0] : noun[1]} · {hint}
        </span>
      )}
    </div>
  );
}

// A compact button for the bulk bar. Shows how many of the selection it applies to,
// and hides when it applies to none.
export function BulkButton({
  count,
  total,
  danger,
  onClick,
  children,
}: {
  count: number;
  total: number;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  if (!count) return null;
  return (
    <Button
      type="button"
      variant={danger ? "danger" : "secondary"}
      className="px-2.5 py-1 text-xs"
      onClick={onClick}
      title={
        count < total
          ? `Applies to ${count} of the ${total} selected`
          : undefined
      }
    >
      {children}
      {count < total && (
        <span className="font-normal text-gray-500 tabular-nums">
          ({count})
        </span>
      )}
    </Button>
  );
}
