"use client";

import { useState } from "react";
import { Button, Field, Input, cx, typeLabels } from "@/components/ui";
import { createGuide } from "../actions";

const descriptions = {
  TOUR: "Step-by-step tooltips pointing at parts of your app.",
  CHECKLIST: "A list of onboarding tasks with a progress launcher.",
  ANNOUNCEMENT: "A modal or top banner for news and updates.",
  HOTSPOT: "Pulsing beacons that reveal a hint when clicked.",
  SURVEY: "NPS, ratings, multiple choice and open questions.",
  RESOURCE_CENTER: "A help button with guides, articles, links and contact.",
} as const;

export function NewGuideButton({ ws }: { ws: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<keyof typeof typeLabels>("TOUR");

  return (
    <>
      <Button onClick={() => setOpen(true)}>New guide</Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <form
            action={createGuide.bind(null, ws)}
            className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold">New guide</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(Object.keys(typeLabels) as (keyof typeof typeLabels)[]).map((t) => (
                <label
                  key={t}
                  className={cx(
                    "cursor-pointer rounded-lg p-3 ring-1",
                    type === t ? "bg-brand-50 ring-2 ring-brand-500" : "ring-gray-200 hover:bg-gray-50",
                  )}
                >
                  <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                  <div className="text-sm font-semibold">{typeLabels[t]}</div>
                  <div className="mt-0.5 text-xs text-gray-500">{descriptions[t]}</div>
                </label>
              ))}
            </div>
            <Field label="Name">
              <Input name="name" placeholder="e.g. Welcome tour" required maxLength={191} autoFocus />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button>Create</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
