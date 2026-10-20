"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { createUpdate } from "./actions";

export function NewUpdateButton({ ws }: { ws: string }) {
  const [pending, start] = useTransition();
  return (
    <Button disabled={pending} onClick={() => start(() => createUpdate(ws))}>
      New update
    </Button>
  );
}
