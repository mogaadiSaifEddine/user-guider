"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { mountRichEditor, type RichEditor } from "@/lib/rich-editor";

// Rich text field for any guide text people see (titles, bodies, descriptions).
// Bold, italic, underline, strikethrough and links everywhere; line breaks and
// lists when `multiline`. Stores the light markup that richText() renders.
export function RichTextInput({
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  maxLength,
  autoFocus,
  "aria-label": label,
}: {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  "aria-label"?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<RichEditor | null>(null);
  const latest = useRef(onChange);

  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    const ed = mountRichEditor(host.current!, {
      value,
      multiline,
      rows,
      placeholder,
      maxLength,
      label,
      onChange: (v) => latest.current(v),
    });
    editor.current = ed;
    if (autoFocus) ed.focus();
    return () => {
      ed.destroy();
      editor.current = null;
    };
    // Mounted once per field; value changes arrive through setValue below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiline, rows, placeholder, maxLength, label]);

  useEffect(() => {
    editor.current?.setValue(value);
  }, [value]);

  return <div ref={host} className="min-h-[34px]" />;
}

// Like <Field> with a RichTextInput inside. Not a <label>: a label would forward
// clicks in the text to the first toolbar button.
export function RichField({
  label,
  hint,
  ...input
}: Omit<Parameters<typeof RichTextInput>[0], "aria-label"> & { label: string; hint?: ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-700">{label}</span>
      <RichTextInput aria-label={label} {...input} />
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </div>
  );
}
