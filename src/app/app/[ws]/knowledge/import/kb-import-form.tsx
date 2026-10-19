"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ImportReport } from "@/lib/kb-import";
import { languageName } from "@/lib/i18n";
import { Button, ButtonLink, Card, Field, Input, Select, cx } from "@/components/ui";
import { runImport } from "../actions";

type Kind = "zendesk" | "intercom";

export function KbImport({ ws, languages }: { ws: string; languages: { code: string; name: string }[] }) {
  const [kind, setKind] = useState<Kind>("zendesk");
  const [zendesk, setZendesk] = useState({ url: "", email: "", token: "" });
  const [intercom, setIntercom] = useState({ token: "", region: "us" as "us" | "eu" | "au" });
  const [status, setStatus] = useState<"source" | "draft">("source");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function run() {
    setError("");
    setReport(null);
    start(async () => {
      try {
        const r = await runImport(ws, {
          source: kind === "zendesk" ? { kind, ...zendesk } : { kind, ...intercom },
          status,
        });
        if (!r.ok) setError(r.error);
        else setReport(r.report ?? null);
      } catch {
        setError("The import took too long or the server stopped answering. Large help centers can be imported again: it picks up where it left off.");
      }
    });
  }

  if (report) {
    const r = report;
    return (
      <Card className="max-w-3xl space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">
            Imported {r.articles.created + r.articles.updated} articles
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {r.articles.created} new, {r.articles.updated} updated; {r.collections.created + r.collections.updated} collections;{" "}
            {r.translations} translations. The articles came from the {r.sourceLocale} version.
          </p>
        </div>
        {r.skippedLocales.length > 0 && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Also available there, but not used in this workspace: {r.skippedLocales.map((l) => languageName(l)).join(", ")}. Add them in{" "}
            <Link href={`/app/${ws}/settings#languages`} className="font-medium underline">
              Settings → Languages
            </Link>{" "}
            and import again to bring those translations over.
          </div>
        )}
        {r.warnings.length > 0 && (
          <div>
            <div className="mb-1 text-sm font-semibold">Worth a look</div>
            <ul className="max-h-64 space-y-1 overflow-auto text-sm text-gray-600">
              {r.warnings.map((w, i) => (
                <li key={i}>
                  <span className="font-medium text-gray-800">{w.title}</span>: {w.issues.join("; ")}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-2">
          <ButtonLink href={`/app/${ws}/knowledge`}>Open the knowledge base</ButtonLink>
          <Button variant="secondary" onClick={() => setReport(null)}>
            Import again
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(["zendesk", "intercom"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cx(
              "rounded-xl bg-white p-4 text-left ring-1",
              kind === k ? "ring-2 ring-brand-500" : "ring-gray-200 hover:bg-gray-50",
            )}
          >
            <div className="text-sm font-semibold">{k === "zendesk" ? "Zendesk Guide" : "Intercom Articles"}</div>
            <div className="mt-0.5 text-xs text-gray-500">
              {k === "zendesk" ? "Sections become collections. Public help centers need no credentials." : "Collections and every language. Needs an access token."}
            </div>
          </button>
        ))}
      </div>

      <Card className="space-y-4 p-5">
        {kind === "zendesk" ? (
          <>
            <Field label="Help center" hint="Your subdomain (acme), acme.zendesk.com, or your help center's own domain.">
              <Input placeholder="acme" value={zendesk.url} maxLength={300} onChange={(e) => setZendesk({ ...zendesk, url: e.target.value })} />
            </Field>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-gray-700">Private help center or drafts? Add an API token</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Agent email">
                  <Input type="email" value={zendesk.email} maxLength={200} onChange={(e) => setZendesk({ ...zendesk, email: e.target.value })} />
                </Field>
                <Field label="API token" hint="Admin Center → Apps and integrations → Zendesk API.">
                  <Input type="password" value={zendesk.token} maxLength={200} onChange={(e) => setZendesk({ ...zendesk, token: e.target.value })} />
                </Field>
              </div>
            </details>
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
            <Field label="Access token" hint="Developer Hub → your app → Authentication. It needs permission to read articles.">
              <Input type="password" value={intercom.token} maxLength={500} onChange={(e) => setIntercom({ ...intercom, token: e.target.value })} />
            </Field>
            <Field label="Data region">
              <Select value={intercom.region} onChange={(e) => setIntercom({ ...intercom, region: e.target.value as "us" | "eu" | "au" })}>
                <option value="us">United States</option>
                <option value="eu">Europe</option>
                <option value="au">Australia</option>
              </Select>
            </Field>
          </div>
        )}

        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as "source" | "draft")}>
            <option value="source">Same as there: published articles go live, drafts stay drafts</option>
            <option value="draft">New articles start as drafts; I&apos;ll publish them myself</option>
          </Select>
        </Field>

        <p className="text-xs text-gray-500">
          English becomes the article; {languages.length > 1 ? languages.slice(1).map((l) => l.name).join(", ") : "other languages"} come over as
          translations{languages.length > 1 ? "" : " once you add them in Settings"}. Images keep loading from{" "}
          {kind === "zendesk" ? "Zendesk" : "Intercom"}. Credentials are used for this import only and aren&apos;t stored.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button disabled={pending} onClick={run}>
          {pending ? "Importing… this can take a minute" : `Import from ${kind === "zendesk" ? "Zendesk" : "Intercom"}`}
        </Button>
      </Card>
    </div>
  );
}
