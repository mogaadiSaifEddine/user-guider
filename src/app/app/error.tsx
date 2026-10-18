"use client";

import { Button } from "@/components/ui";

// Dashboard error boundary. The common case is a page loaded before a deploy
// (or dev-server restart) calling a server action id that no longer exists.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const outdated = error.name === "UnrecognizedActionError" || /Server Action .* (was )?not found/i.test(error.message);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold">{outdated ? "This page is out of date" : "Something went wrong"}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {outdated
            ? "The app was updated since you opened this page. Reload to continue. Unsaved changes on this page are lost."
            : "The action didn't complete. Try again, or reload the page."}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          {!outdated && (
            <Button variant="secondary" onClick={reset}>
              Try again
            </Button>
          )}
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </div>
    </div>
  );
}
