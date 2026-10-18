"use client";

import { useState } from "react";

export function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg bg-gray-900 text-gray-100">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-gray-400">
        <span>{label}</span>
        <button
          className="rounded px-2 py-0.5 font-medium text-gray-200 hover:bg-white/10"
          onClick={() => {
            navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
