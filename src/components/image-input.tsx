"use client";

import { useRef, useState } from "react";
import { Button, Input } from "@/components/ui";

// An image address with an Upload button (stored in the Asset table, see /api/assets).
export function ImageInput({ ws, value, onChange, placeholder = "https://… or upload" }: { ws: string; value: string; onChange: (url: string) => void; placeholder?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("workspaceId", ws);
      const res = await fetch("/api/assets", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input value={value} maxLength={1000} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        <Button type="button" variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "Uploading…" : "Upload"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" onClick={() => onChange("")}>
            Remove
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
