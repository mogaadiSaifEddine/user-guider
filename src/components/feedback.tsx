"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, cx } from "./ui";

// Toasts and confirm dialogs for the dashboard. Mounted once in the workspace layout.

type Toast = { id: number; kind: "ok" | "error"; text: string };

export type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
};

type Feedback = {
  toast: (text: string, kind?: Toast["kind"]) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<Feedback | null>(null);

function useFeedback() {
  const f = useContext(FeedbackContext);
  if (!f) throw new Error("FeedbackProvider is missing");
  return f;
}

export const useToast = () => useFeedback().toast;
export const useConfirm = () => useFeedback().confirm;

let nextId = 1;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ask, setAsk] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (text: string, kind: Toast["kind"] = "ok") => {
      const id = nextId++;
      // Errors stay until dismissed or until the next toast (e.g. a save that worked);
      // successes fade on their own.
      setToasts((t) => [...t.filter((x) => x.kind !== "error"), { id, kind, text }].slice(-3));
      if (kind === "ok") setTimeout(() => dismiss(id), 3500);
    },
    [dismiss],
  );

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setAsk({ ...o, resolve })), []);

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={cx(
              "pointer-events-auto flex max-w-lg items-start gap-3 rounded-lg px-4 py-2.5 text-sm shadow-lg ring-1",
              t.kind === "ok" ? "bg-gray-900 text-white ring-gray-900" : "bg-red-50 text-red-800 ring-red-200",
            )}
          >
            <span className="min-w-0 flex-1">{t.text}</span>
            <button type="button" className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
      {ask && (
        <ConfirmDialog
          {...ask}
          onClose={(ok) => {
            ask.resolve(ok);
            setAsk(null);
          }}
        />
      )}
    </FeedbackContext.Provider>
  );
}

function ConfirmDialog({ title, body, confirmLabel = "Continue", danger, onClose }: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      // Esc fires "cancel" then "close"; the close handler covers both paths.
      onClose={() => onClose(ref.current?.returnValue === "ok")}
      onClick={(e) => e.target === ref.current && ref.current.close()}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl bg-white p-0 shadow-xl ring-1 ring-gray-200 backdrop:bg-gray-900/30"
    >
      <form method="dialog" className="p-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {body && <div className="mt-2 text-sm text-gray-600">{body}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="submit" value="cancel" variant="secondary">
            Cancel
          </Button>
          <Button type="submit" value="ok" autoFocus variant={danger ? "destructive" : "primary"}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
