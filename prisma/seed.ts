// Creates a demo account, workspace and one guide of each type, wired to
// public/demo.html. Run with `npm run db:seed`; safe to re-run.
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { parseTargeting, parseTheme, contentSchemas } from "../src/lib/guide-schema";

const prisma = new PrismaClient();
const DEMO_EMAIL = "demo@locatify.local";
const DEMO_KEY = "pk_demo";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: "Demo", passwordHash: await bcrypt.hash("demo1234", 10) },
  });

  const existing = await prisma.workspace.findUnique({ where: { publicKey: DEMO_KEY } });
  if (existing) await prisma.workspace.delete({ where: { id: existing.id } });

  const ws = await prisma.workspace.create({
    data: {
      name: "Demo site",
      publicKey: DEMO_KEY,
      secretKey: "sk_" + randomBytes(24).toString("hex"),
      theme: parseTheme({}),
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  const json = (v: unknown) => v as Prisma.InputJsonObject;
  const guide = async (name: string, type: keyof typeof contentSchemas, content: unknown, targeting: unknown = {}, priority = 0) => {
    const c = contentSchemas[type].parse(content);
    return prisma.guide.create({
      data: {
        workspaceId: ws.id,
        name,
        type,
        status: "PUBLISHED",
        priority,
        content: json(c),
        publishedContent: json(c),
        publishedAt: new Date(),
        targeting: json(parseTargeting(targeting)),
      },
    });
  };

  const tour = await guide(
    "Welcome tour",
    "TOUR",
    {
      steps: [
        { id: "s1", title: "Welcome to Acme Tours 👋", body: "A quick look around. It takes **30 seconds**." },
        { id: "s2", title: "Your projects", body: "Everything you build lives here.", selector: "#nav-projects" },
        {
          id: "s3",
          title: "Create a project",
          body: "Click the button to start your first tour.",
          selector: "#new-project",
          advanceOn: "click",
        },
        { id: "s4", title: "Need help?", body: "The help center has guides for every feature.", selector: "#help", placement: "left" },
      ],
    },
    { includeAnonymous: true },
    10,
  );

  await guide(
    "Getting started",
    "CHECKLIST",
    {
      title: "Get started",
      description: "Three steps to your first published tour.",
      items: [
        { id: "i1", title: "Take the welcome tour", action: { type: "tour", guideId: tour.id }, completeOn: { type: "guide", guideId: tour.id } },
        { id: "i2", title: "Create a project", completeOn: { type: "event", name: "project_created" } },
        { id: "i3", title: "Read the docs", action: { type: "url", url: "/demo.html#docs" } },
      ],
    },
    { includeAnonymous: true },
  );

  await guide(
    "New: offline maps",
    "ANNOUNCEMENT",
    { format: "banner", title: "New:", body: "Offline maps are here.", buttonText: "Got it" },
    { includeAnonymous: true, frequency: "until_completed" },
  );

  await guide(
    "Settings hints",
    "HOTSPOT",
    { hotspots: [{ id: "h1", selector: "#settings", title: "Settings", body: "Change your language and theme here." }] },
    { includeAnonymous: true },
  );

  console.log(`Seeded. Sign in as ${DEMO_EMAIL} / demo1234. Demo page: /demo.html`);
}

main().finally(() => prisma.$disconnect());
