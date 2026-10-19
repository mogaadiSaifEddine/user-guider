"use client";

import { useState, useTransition } from "react";
import { useConfirm } from "@/components/feedback";
import type { Theme } from "@/lib/guide-schema";
import { Badge, Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { LanguagesForm, type LanguageInfo } from "./languages-form";
import type { UiStrings } from "@/lib/ui-strings";
import { addMember, deleteWorkspace, removeMember, rotateKey, updateWorkspace, type ActionResult } from "../actions";

type Props = {
  ws: string;
  isOwner: boolean;
  currentUserId: string;
  workspace: {
    name: string;
    publicKey: string;
    secretKey: string | null;
    requireIdentityVerification: boolean;
    aiContext: string;
    companyIdAttribute: string;
    companyNameAttribute: string;
    theme: Theme;
  };
  members: { id: string; name: string; email: string; role: "OWNER" | "EDITOR" }[];
  aiEnabled: boolean;
  i18n: { languages: string[]; uiStrings: Record<string, Partial<UiStrings>>; builtins: Record<string, LanguageInfo> };
};

function Notice({ result }: { result: ActionResult | null }) {
  if (!result || (result.ok && !result.message)) return null;
  return (
    <p className={cx("text-sm", result.ok ? "text-emerald-700" : "text-red-600")} role="status">
      {result.ok ? result.message : result.error}
    </p>
  );
}

function Section({ title, description, children, id }: { title: string; description?: string; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="grid scroll-mt-6 gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
      </div>
      <Card className="space-y-4 p-5">{children}</Card>
    </div>
  );
}

export function SettingsForms({ ws, isOwner, currentUserId, workspace, members, aiEnabled, i18n }: Props) {
  const confirm = useConfirm();
  const [name, setName] = useState(workspace.name);
  const [verify, setVerify] = useState(workspace.requireIdentityVerification);
  const [aiContext, setAiContext] = useState(workspace.aiContext);
  const [companyIdAttribute, setCompanyIdAttribute] = useState(workspace.companyIdAttribute);
  const [companyNameAttribute, setCompanyNameAttribute] = useState(workspace.companyNameAttribute);
  const [theme, setTheme] = useState(workspace.theme);
  const [general, setGeneral] = useState<ActionResult | null>(null);
  const [keys, setKeys] = useState<ActionResult | null>(null);
  const [team, setTeam] = useState<ActionResult | null>(null);
  const [danger, setDanger] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [showSecret, setShowSecret] = useState(false);

  const color = (k: "primaryColor" | "textColor" | "backgroundColor", label: string) => (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="color"
          className="h-8 w-10 cursor-pointer rounded border border-gray-300"
          value={theme[k].length === 7 ? theme[k] : "#000000"}
          onChange={(e) => setTheme({ ...theme, [k]: e.target.value })}
        />
        <Input className="font-mono text-xs" value={theme[k]} onChange={(e) => setTheme({ ...theme, [k]: e.target.value })} />
      </div>
    </Field>
  );

  return (
    <div className="space-y-8">
      <Section title="General & appearance" description="How guides look on your site.">
        <Field label="Workspace name">
          <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          {color("primaryColor", "Primary color")}
          {color("textColor", "Text color")}
          {color("backgroundColor", "Background")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Corner radius (px)">
            <Input
              type="number"
              min={0}
              max={24}
              value={theme.radius}
              onChange={(e) => setTheme({ ...theme, radius: Math.max(0, Math.min(24, Math.trunc(Number(e.target.value)) || 0)) })}
            />
          </Field>
          <Field label="Font" hint="'inherit' uses a system font stack.">
            <Input value={theme.fontFamily} maxLength={200} onChange={(e) => setTheme({ ...theme, fontFamily: e.target.value })} />
          </Field>
        </div>

        <div
          className="max-w-xs p-4 shadow-lg ring-1 ring-gray-200"
          style={{ background: theme.backgroundColor, color: theme.textColor, borderRadius: theme.radius, fontFamily: theme.fontFamily }}
        >
          <div className="mb-1 font-semibold">Preview</div>
          <div className="mb-3 text-sm opacity-90">This is how a tour step looks.</div>
          <div className="flex items-center justify-between text-xs">
            <span className="opacity-60">1 of 3</span>
            <span className="px-3 py-1 font-semibold text-white" style={{ background: theme.primaryColor, borderRadius: theme.radius * 0.7 }}>
              Next
            </span>
          </div>
        </div>

        {aiEnabled && (
          <Field
            label="About your product (for AI drafting)"
            hint="What your app does, who uses it and the words they use. The AI reads this before drafting guides, so it can explain features in your terms."
          >
            <Textarea
              rows={4}
              maxLength={4000}
              value={aiContext}
              placeholder="e.g. Locatify CMS lets museums and tourism boards build location-based audio tours and games for the Locatify app. Users are content editors, usually not technical. A 'project' is one tour or game; 'pins' are map locations with media."
              onChange={(e) => setAiContext(e.target.value)}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Company id attribute"
            hint="The identify() attribute that groups users into companies, e.g. publisher. Empty: detect company_id, publisher, …"
          >
            <Input
              className="font-mono text-xs"
              maxLength={100}
              placeholder="auto"
              value={companyIdAttribute}
              onChange={(e) => setCompanyIdAttribute(e.target.value)}
            />
          </Field>
          <Field
            label="Company name attribute"
            hint="Shown instead of the id, e.g. publisher_alias. Empty: detect company_name, publisher_alias, …"
          >
            <Input
              className="font-mono text-xs"
              maxLength={100}
              placeholder="auto"
              value={companyNameAttribute}
              onChange={(e) => setCompanyNameAttribute(e.target.value)}
            />
          </Field>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={verify} onChange={(e) => setVerify(e.target.checked)} />
          <span>
            <span className="font-medium">Require identity verification</span>
            <span className="block text-xs text-gray-500">
              Reject identify() calls without a valid hash. Turn on only after your site sends it (see Install).
            </span>
          </span>
        </label>
        <div className="flex items-center gap-3">
          <Button
            disabled={pending}
            onClick={() => start(async () => setGeneral(await updateWorkspace(ws, {
                    name,
                    requireIdentityVerification: verify,
                    theme,
                    aiContext,
                    companyIdAttribute,
                    companyNameAttribute,
                  })))}
          >
            Save
          </Button>
          <Notice result={general} />
        </div>
      </Section>

      <Section id="languages" title="Languages" description="The languages guides and help articles are shown in.">
        <LanguagesForm ws={ws} {...i18n} aiEnabled={aiEnabled} Notice={Notice} />
      </Section>

      <Section title="Keys" description="The public key goes in the snippet. The secret key signs user hashes on your server.">
        <Field label="Public key">
          <div className="flex gap-2">
            <Input readOnly className="font-mono text-xs" value={workspace.publicKey} />
            {isOwner && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={async () =>
                  (await confirm({
                    title: "Rotate the public key?",
                    body: "The snippet on your site stops working until you update it with the new key.",
                    confirmLabel: "Rotate key",
                    danger: true,
                  })) &&
                  start(async () => setKeys(await rotateKey(ws, "public")))
                }
              >
                Rotate
              </Button>
            )}
          </div>
        </Field>
        {workspace.secretKey && (
          <Field label="Secret key">
            <div className="flex gap-2">
              <Input readOnly className="font-mono text-xs" type={showSecret ? "text" : "password"} value={workspace.secretKey} />
              <Button variant="secondary" onClick={() => setShowSecret((v) => !v)}>
                {showSecret ? "Hide" : "Show"}
              </Button>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={async () =>
                  (await confirm({
                    title: "Rotate the secret key?",
                    body: "Existing user hashes stop working until your server uses the new secret.",
                    confirmLabel: "Rotate key",
                    danger: true,
                  })) &&
                  start(async () => setKeys(await rotateKey(ws, "secret")))
                }
              >
                Rotate
              </Button>
            </div>
          </Field>
        )}
        <Notice result={keys} />
      </Section>

      <Section title="Team" description="People who can edit guides in this workspace. They need an account first.">
        <ul className="divide-y divide-gray-100">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {m.name} {m.id === currentUserId && <span className="text-gray-400">(you)</span>}
                </div>
                <div className="truncate text-xs text-gray-500">{m.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={m.role === "OWNER" ? "brand" : "gray"}>{m.role.toLowerCase()}</Badge>
                {isOwner && (
                  <Button
                    variant="ghost"
                    className="px-2 text-xs"
                    disabled={pending}
                    onClick={async () =>
                      (await confirm({ title: `Remove ${m.name}?`, body: `${m.email} loses access to this workspace.`, confirmLabel: "Remove", danger: true })) &&
                      start(async () => setTeam(await removeMember(ws, m.id)))
                    }
                  >
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {isOwner && (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const form = e.currentTarget;
              start(async () => {
                const r = await addMember(ws, String(f.get("email")), f.get("role") === "OWNER" ? "OWNER" : "EDITOR");
                setTeam(r);
                if (r.ok) form.reset();
              });
            }}
          >
            <Input name="email" type="email" required placeholder="teammate@company.com" className="min-w-0 flex-1" />
            <Select name="role" className="w-28">
              <option value="EDITOR">Editor</option>
              <option value="OWNER">Owner</option>
            </Select>
            <Button disabled={pending}>Add</Button>
          </form>
        )}
        <Notice result={team} />
      </Section>

      {isOwner && (
        <Section title="Delete workspace" description="Removes every guide, user and event. This can't be undone.">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const confirmName = String(new FormData(e.currentTarget).get("confirm"));
              start(async () => setDanger(await deleteWorkspace(ws, confirmName)));
            }}
          >
            <Input name="confirm" placeholder={`Type "${workspace.name}" to confirm`} className="min-w-0 flex-1" />
            <Button variant="danger" disabled={pending}>
              Delete workspace
            </Button>
          </form>
          <Notice result={danger} />
        </Section>
      )}
    </div>
  );
}
