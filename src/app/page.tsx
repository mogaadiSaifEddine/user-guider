import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/tokens";
import { ButtonLink, GuideTypeIcon, cx, typeLabels } from "@/components/ui";

export const metadata: Metadata = {
  title: "User Onboarder · Product tours, checklists and surveys for your app",
  description:
    "Build product tours, checklists, announcements, hotspots, surveys and a help center on top of your own web app, then see who finished them.",
};

const guideTypes: { type: keyof typeof typeLabels; text: string }[] = [
  { type: "TOUR", text: "Step-by-step tooltips and modals that point at real buttons on the page and wait for the user to click." },
  { type: "CHECKLIST", text: "A launcher with the tasks that get a new account to its first success, ticked off as people finish them." },
  { type: "ANNOUNCEMENT", text: "Modals and banners for releases and notices, shown once to the right audience." },
  { type: "HOTSPOT", text: "Pulsing beacons next to features people miss, with a short tip on hover or click." },
  { type: "SURVEY", text: "NPS, ratings, single or multiple choice and free text, answered without leaving the page." },
  { type: "RESOURCE_CENTER", text: "One help panel with your guides, checklist, knowledge base articles, links and contact options." },
];

const capabilities = [
  {
    title: "Build on your own page",
    text: "Open your app with the builder, click the element a step should point at, and write the step right there. No browser extension.",
    path: "M4 4l7 17 2.5-7.5L21 11z",
  },
  {
    title: "Draft with AI",
    text: "Describe the tour you want. Gemini reads the page you're on and drafts the steps, already pointed at the right elements.",
    path: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  },
  {
    title: "Target the right people",
    text: "Show guides by page, user attributes, company, language or what someone has already completed.",
    path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  },
  {
    title: "Speak every language",
    text: "Write in English, translate with one click, and each user sees guides in their own language with English as fallback.",
    path: "M4 5h9M8.5 3v2M6 5c0 5 3 8 6 9M11 5c-.5 4-3 7.5-6 9M13 21l4-10 4 10M14.5 17h5",
  },
  {
    title: "See what works",
    text: "Views, completions and drop-off per step, daily and monthly active users, and survey results you can export to CSV.",
    path: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  },
  {
    title: "Answer questions in the app",
    text: "Write help articles in every language, or import them from Zendesk or Intercom, and show them in the resource center.",
    path: "M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zM8 8h6M8 12h6",
  },
];

const snippet = `<script>
  window.UserOnboarder = window.UserOnboarder || { q: [] };
  ["identify", "track", "start", "page", "reset"].forEach(function (m) {
    UserOnboarder[m] = UserOnboarder[m] || function () { UserOnboarder.q.push([m, arguments]); };
  });
</script>
<script async src="https://your-server/sdk.js" data-key="pk_…"></script>`;

export default async function Home() {
  const signedIn = Boolean(await verifySession((await cookies()).get(SESSION_COOKIE)?.value));

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-30 border-b border-gray-200/60 bg-[#f6f6fb]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-extrabold tracking-tight text-gray-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-brand-400 to-brand-700 text-sm text-white shadow-brand">
              U
            </span>
            User Onboarder
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-gray-600 md:flex">
            <a href="#guides" className="hover:text-gray-900">Guide types</a>
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#install" className="hover:text-gray-900">Install</a>
            <Link href="/docs" className="hover:text-gray-900">Docs</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <ButtonLink href="/app">Open dashboard</ButtonLink>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-white">
                  Sign in
                </Link>
                <ButtonLink href="/signup">Get started</ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative">
          <div
            className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[640px] bg-[radial-gradient(ellipse_at_top,var(--color-brand-200),transparent_65%)] opacity-70"
            aria-hidden
          />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 md:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700 shadow-card ring-1 ring-brand-100">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Onboarding that lives inside your product
              </span>
              <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight text-balance text-gray-900 sm:text-5xl lg:text-6xl">
                Show every new user{" "}
                <span className="bg-linear-to-r from-brand-500 to-brand-800 bg-clip-text text-transparent">the way in.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-600">
                Product tours, checklists, announcements, hotspots and surveys, built right on top of your own web app. Ship
                them without a release, and see who finished.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={signedIn ? "/app" : "/signup"} className="px-5 py-2.5 text-base">
                  {signedIn ? "Open dashboard" : "Create a workspace"}
                </ButtonLink>
                <ButtonLink href="/docs" variant="secondary" className="px-5 py-2.5 text-base">
                  Read the docs
                </ButtonLink>
              </div>
              <p className="mt-5 text-sm text-gray-500">Two script tags to install. Works with Angular, React, Vue or plain HTML.</p>
            </div>
            <HeroMock />
          </div>
        </section>

        {/* Guide types */}
        <section id="guides" className="scroll-mt-20 border-y border-gray-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <SectionHead
              eyebrow="Six guide types"
              title="Everything a new user needs, in one snippet"
              text="Mix them freely. A checklist can start a tour, a tour can end in a survey, and the resource center keeps all of it one click away."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {guideTypes.map((g) => (
                <div
                  key={g.type}
                  className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-gray-200/70 transition hover:-translate-y-0.5 hover:shadow-card-hover"
                >
                  <GuideTypeIcon type={g.type} />
                  <h3 className="mt-4 text-base font-bold text-gray-900">{typeLabels[g.type]}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{g.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section id="features" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <SectionHead
              eyebrow="Features"
              title="From first draft to measured result"
              text="The dashboard covers authoring, targeting, translation and analytics, so onboarding doesn't wait on your engineers."
            />
            <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((c) => (
                <div key={c.title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-brand">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={c.path} />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900">{c.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Install */}
        <section id="install" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
            <div className="grid items-center gap-10 overflow-hidden rounded-3xl bg-gray-950 p-8 text-gray-300 md:p-12 lg:grid-cols-[1fr_1.25fr]">
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-widest text-brand-300 uppercase">Install</div>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance text-white">Live in minutes, not sprints</h2>
                <p className="mt-3 leading-relaxed text-gray-400">
                  Paste the snippet into your page head, call <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-gray-100">identify()</code>{" "}
                  when someone signs in, and everything else is managed from the dashboard.
                </p>
                <ol className="mt-6 space-y-3 text-sm">
                  {["Add the snippet to every page", "Identify signed-in users", "Publish your first tour"].map((s, i) => (
                    <li key={s} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-200">{i + 1}</span>
                      <span className="text-gray-200">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="min-w-0 rounded-2xl bg-black/40 ring-1 ring-white/10">
                <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="ml-2 text-xs text-gray-500">index.html</span>
                </div>
                <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-brand-100">{snippet}</pre>
              </div>
            </div>
          </div>
        </section>

        {/* Migration */}
        <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
          <div className="grid gap-6 rounded-3xl bg-white p-8 shadow-card ring-1 ring-gray-200/70 md:grid-cols-[1fr_auto] md:items-center md:p-10">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Coming from UserGuiding?</h2>
              <p className="mt-2 max-w-2xl leading-relaxed text-gray-600">
                Import your existing guides and checklists with their steps, targeting and images. Knowledge base articles come
                across from Zendesk or Intercom.
              </p>
            </div>
            <ButtonLink href="/docs/import-userguiding" variant="secondary" className="px-5 py-2.5">
              How importing works →
            </ButtonLink>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
            <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-500 to-brand-800 px-8 py-14 text-center shadow-brand md:py-16">
              <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10" aria-hidden />
              <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-white/5" aria-hidden />
              <h2 className="relative text-3xl font-extrabold tracking-tight text-balance text-white sm:text-4xl">
                Your next user signs up today. Be ready.
              </h2>
              <p className="relative mx-auto mt-3 max-w-xl text-brand-100">
                Create a workspace, install the snippet and publish a welcome tour before lunch.
              </p>
              <div className="relative mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href={signedIn ? "/app" : "/signup"}
                  className="rounded-lg bg-white px-5 py-2.5 font-bold text-brand-700 shadow-lg transition hover:bg-brand-50"
                >
                  {signedIn ? "Open dashboard" : "Get started"}
                </Link>
                <Link href="/docs" className="rounded-lg px-5 py-2.5 font-bold text-white ring-1 ring-white/30 transition hover:bg-white/10">
                  Browse the docs
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm text-gray-500 md:px-6">
          <span className="font-bold text-gray-700">User Onboarder</span>
          <Link href="/docs" className="hover:text-gray-900">Docs</Link>
          <Link href="/docs/install" className="hover:text-gray-900">Install</Link>
          <Link href="/docs/quick-start" className="hover:text-gray-900">Quick start</Link>
          <span className="ml-auto">© {new Date().getFullYear()} User Onboarder</span>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-xs font-bold tracking-widest text-brand-600 uppercase">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance text-gray-900 sm:text-4xl">{title}</h2>
      <p className="mt-3 leading-relaxed text-gray-600">{text}</p>
    </div>
  );
}

// A sketch of a host app with a tour step and a checklist running on it.
function HeroMock() {
  return (
    <div className="relative min-w-0" aria-hidden>
      <div className="rounded-2xl bg-white shadow-[0_30px_80px_rgb(20_21_43/0.18)] ring-1 ring-gray-200/80">
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
          <span className="ml-3 h-5 flex-1 rounded-md bg-gray-100" />
        </div>
        <div className="grid grid-cols-[88px_1fr] sm:grid-cols-[120px_1fr]">
          <div className="space-y-2 border-r border-gray-100 p-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={cx("h-6 rounded-md", i === 1 ? "bg-brand-100" : "bg-gray-100")} />
            ))}
          </div>
          <div className="relative p-5">
            <div className="h-4 w-1/2 rounded bg-gray-200" />
            <div className="mt-2 h-3 w-3/4 rounded bg-gray-100" />
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-gray-50 ring-1 ring-gray-100" />
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2">
              <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-gray-900 ring-1 ring-gray-200 ring-offset-0 outline-[3px] outline-offset-2 outline-brand-500">
                + Add a stop
              </span>
              <span className="h-7 w-20 rounded-lg bg-gray-100" />
            </div>
            <div className="relative mt-4 w-64 max-w-full rounded-2xl bg-white p-4 shadow-[0_20px_50px_rgb(20_21_43/0.22),0_0_0_1px_rgb(20_21_43/0.05)]">
              <span className="absolute -top-1.5 left-8 h-3 w-3 rotate-45 bg-white shadow-[-1px_-1px_0_rgb(20_21_43/0.05)]" />
              <div className="text-sm font-extrabold text-gray-900">Add your first stop</div>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">Drop a stop on the map, then add audio and photos.</p>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="mr-auto flex gap-1">
                  <i className="h-1.5 w-1.5 rounded-full bg-gray-200" />
                  <i className="h-1.5 w-4 rounded-full bg-brand-500" />
                  <i className="h-1.5 w-1.5 rounded-full bg-gray-200" />
                </span>
                <span className="px-2 py-1 text-xs font-semibold text-gray-500">Back</span>
                <span className="rounded-lg bg-linear-to-br from-brand-400 to-brand-700 px-3 py-1 text-xs font-bold text-white shadow-brand">Next</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -right-2 -bottom-8 hidden w-56 rounded-2xl bg-white p-4 shadow-[0_20px_50px_rgb(20_21_43/0.2)] ring-1 ring-gray-200/70 sm:block lg:-right-6">
        <div className="text-sm font-extrabold text-gray-900">Get started</div>
        <div className="text-xs text-gray-500">2 of 4 done</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full w-1/2 rounded-full bg-linear-to-r from-brand-400 to-brand-700" />
        </div>
        <ul className="mt-3 space-y-2 text-xs">
          {[
            ["Create a project", true],
            ["Add three stops", true],
            ["Generate audio", false],
            ["Publish", false],
          ].map(([t, done]) => (
            <li key={t as string} className="flex items-center gap-2">
              <span
                className={cx(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[9px] text-white",
                  done ? "bg-brand-600" : "ring-2 ring-gray-200",
                )}
              >
                {done ? "✓" : ""}
              </span>
              <span className={done ? "text-gray-400 line-through" : "text-gray-700"}>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute -top-5 -left-3 hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-900 shadow-card-hover ring-1 ring-gray-200/70 sm:flex">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">✓</span>
        68% finished the welcome tour
      </div>
    </div>
  );
}
