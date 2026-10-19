import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import { CopyBlock } from "@/components/copy-block";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function InstallPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const { workspace } = await requireWorkspace(ws);
  const base = await appUrl();
  const lastSeen = await prisma.endUser.findFirst({
    where: { workspaceId: ws },
    orderBy: { lastSeenAt: "desc" },
    select: { lastSeenAt: true },
  });

  const snippet = `<script>
  window.UserOnboarder = window.UserOnboarder || { q: [] };
  ["identify", "track", "start", "page", "reset", "setLocale", "openResourceCenter", "closeResourceCenter"].forEach(function (m) {
    UserOnboarder[m] = UserOnboarder[m] || function () { UserOnboarder.q.push([m, arguments]); };
  });
</script>
<script async src="${base}/sdk.js" data-key="${workspace.publicKey}" data-wait-for-identify></script>`;

  const identify = `// After login, once you know who the user is:
UserOnboarder.identify(user.id, {
  email: user.email,
  plan: user.plan,                 // anything you want to target on
  signedUpAt: user.createdAt,      // ISO dates compare with "greater/less than"
}${workspace.requireIdentityVerification ? ", { hash: userHashFromYourServer }" : ""});

// On logout:
UserOnboarder.reset();`;

  const track = `// Completes checklist items set to "Done when an event is tracked"
UserOnboarder.track("project_created");

// Start a guide from your own button
UserOnboarder.start("GUIDE_ID");`;

  const hashNode = `import { createHmac } from "crypto";

const hash = createHmac("sha256", process.env.USER_ONBOARDER_SECRET)
  .update(String(user.id))
  .digest("hex");`;

  const hashPython = `import hmac, hashlib

user_hash = hmac.new(
    settings.USER_ONBOARDER_SECRET.encode(),
    str(user.id).encode(),
    hashlib.sha256,
).hexdigest()`;

  return (
    <>
      <PageHeader
        title="Install"
        description={
          <>
            Add the snippet to every page of your site, then identify signed-in users. Full guide in the{" "}
            <a href="/docs/install" target="_blank" className="font-medium text-brand-600 hover:underline">
              developer docs
            </a>
            .
          </>
        }
        actions={
          lastSeen ? (
            <Badge color="green">Receiving data · last seen {lastSeen.lastSeenAt.toLocaleString()}</Badge>
          ) : (
            <Badge color="yellow">Waiting for the first visitor</Badge>
          )
        }
      />

      <div className="space-y-8">
        <section>
          <h2 className="mb-1 text-sm font-semibold">1. Add the snippet</h2>
          <p className="mb-3 text-sm text-gray-500">
            Paste it before <code>&lt;/head&gt;</code> (in an Angular app: <code>src/index.html</code>). Calls made before the
            script loads are queued. <code>data-wait-for-identify</code> holds guides until <code>identify()</code> runs; remove it
            to also serve anonymous visitors right away.
          </p>
          <CopyBlock label="HTML" code={snippet} />
        </section>

        <section>
          <h2 className="mb-1 text-sm font-semibold">2. Identify users</h2>
          <p className="mb-3 text-sm text-gray-500">
            The id must be stable and unique per user. Attributes are merged on every call and can be used in user targeting.
          </p>
          <CopyBlock label="JavaScript" code={identify} />
        </section>

        <section>
          <h2 className="mb-1 text-sm font-semibold">3. Track events and start guides (optional)</h2>
          <CopyBlock label="JavaScript" code={track} />
        </section>

        <section>
          <h2 className="mb-1 text-sm font-semibold">
            Identity verification{" "}
            {workspace.requireIdentityVerification ? <Badge color="green">required</Badge> : <Badge>optional</Badge>}
          </h2>
          <p className="mb-3 text-sm text-gray-500">
            Without it, anyone can call <code>identify()</code> with another user&apos;s id and read their guide progress. Compute an
            HMAC of the user id with your secret key on your server and pass it as <code>hash</code>. Turn on enforcement in Settings
            once every page sends it. Never put the secret in browser code.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <CopyBlock label="Node.js" code={hashNode} />
            <CopyBlock label="Python / Django" code={hashPython} />
          </div>
        </section>

        <Card className="p-5 text-sm">
          <div className="font-semibold">Content Security Policy</div>
          <p className="mt-1 text-gray-500">
            If your site sets a CSP, allow <code>{base}</code> in <code>script-src</code> and <code>connect-src</code>.
          </p>
        </Card>
      </div>
    </>
  );
}
