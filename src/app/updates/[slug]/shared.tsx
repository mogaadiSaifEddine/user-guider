import Link from "next/link";
import { headers } from "next/headers";
import type { ProductUpdate, Workspace } from "@prisma/client";
import { DEFAULT_LOCALE, languageName, matchLocale, workspaceLanguages } from "@/lib/i18n";
import { plainText, safeUrl } from "@/lib/format";
import { parseTheme } from "@/lib/guide-schema";
import type { UpdatesPage } from "@/lib/updates";
import { labelsOf, localizeUpdate } from "@/lib/updates-service";
import { LabelChip, UpdateBody, formatUpdateDate } from "@/components/update-post";
import { resolveUi } from "@/lib/ui-strings-builtin";
import { ReactionBar } from "./reaction-bar";

// Pieces of the public updates page (/updates/<slug>) and a post's own page.

// ?lang= first, then the browser's languages; English when nothing matches.
export async function pageLocale(workspace: Workspace, lang: string | undefined) {
  const languages = workspaceLanguages(workspace.languages);
  const accept = ((await headers()).get("accept-language") ?? "")
    .split(",")
    .map((p) => p.split(";")[0].trim())
    .filter(Boolean);
  return { languages, locale: matchLocale([lang, ...accept], languages) ?? DEFAULT_LOCALE, explicit: Boolean(lang) };
}

export function withLang(href: string, locale: string, explicit: boolean) {
  return explicit ? `${href}${href.includes("?") ? "&" : "?"}lang=${encodeURIComponent(locale)}` : href;
}

export function PageShell({
  slug,
  page,
  accent,
  languages,
  locale,
  path,
  children,
}: {
  slug: string;
  page: UpdatesPage;
  accent: string;
  languages: string[];
  locale: string;
  // Current path, for the language links.
  path: string;
  children: React.ReactNode;
}) {
  const website = safeUrl(page.websiteUrl);
  return (
    <div lang={locale} className="min-h-screen bg-[#f7f7fb]" style={{ ["--accent" as string]: accent }}>
      <header className="sticky top-0 z-20 border-b border-gray-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <Link href={`/updates/${slug}`} className="flex min-w-0 items-center gap-2.5">
            {page.logoUrl && safeUrl(page.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={safeUrl(page.logoUrl)} alt="" className="h-7 max-w-[160px] object-contain" />
            ) : (
              <span className="h-7 w-7 rounded-lg" style={{ background: accent }} />
            )}
            <span className="truncate text-sm font-bold text-gray-900">{page.title}</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {languages.length > 1 && (
              <nav className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 text-xs" aria-label="Language">
                {languages.map((l) => (
                  <Link
                    key={l}
                    href={withLang(path, l, true)}
                    title={languageName(l, true)}
                    className={l === locale ? "rounded-md bg-white px-2 py-1 font-bold text-gray-900 shadow-xs" : "px-2 py-1 font-medium text-gray-500 hover:text-gray-900"}
                  >
                    {l.toUpperCase()}
                  </Link>
                ))}
              </nav>
            )}
            {website && (
              <a href={website} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:brightness-110" style={{ background: accent }}>
                {page.websiteLabel || "Back to app"}
              </a>
            )}
          </div>
        </div>
      </header>
      {children}
      <footer className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 pt-6 pb-12 text-xs text-gray-400">
        <a href={`/updates/${slug}/rss.xml`} className="flex items-center gap-1.5 hover:text-gray-700">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
            <circle cx="5" cy="19" r="1" fill="currentColor" />
          </svg>
          RSS feed
        </a>
        <Link href="/" className="hover:text-gray-700">
          Powered by <b className="font-bold">User Onboarder</b>
        </Link>
      </footer>
    </div>
  );
}

export function PostArticle({
  slug,
  u,
  page,
  workspace,
  locale,
  explicitLocale,
  full,
}: {
  slug: string;
  u: ProductUpdate;
  page: UpdatesPage;
  workspace: Workspace;
  locale: string;
  explicitLocale: boolean;
  // On the post's own page: no title link, no "pinned" mark.
  full?: boolean;
}) {
  const c = localizeUpdate(u, locale);
  const accent = parseTheme(workspace.theme).primaryColor;
  const date = u.publishedAt ?? u.createdAt;
  const href = withLang(`/updates/${slug}/${u.id}`, locale, explicitLocale);
  const cover = u.coverUrl ? safeUrl(u.coverUrl) : "";
  return (
    <article id={u.id} className="relative grid gap-3 md:grid-cols-[150px_minmax(0,1fr)] md:gap-8">
      <div className="md:pt-5">
        <time dateTime={date.toISOString()} className="text-sm font-semibold text-gray-500 md:sticky md:top-20">
          {formatUpdateDate(date, locale)}
        </time>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-200/70">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="aspect-[2/1] w-full object-cover" />
        )}
        <div className="space-y-4 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-1.5">
            {!full && u.pinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-bold text-white">Pinned</span>
            )}
            {labelsOf(page, u.labels).map((l) => (
              <Link key={l.id} href={withLang(`/updates/${slug}?label=${encodeURIComponent(l.id)}`, locale, explicitLocale)}>
                <LabelChip name={l.name} color={l.color} />
              </Link>
            ))}
          </div>
          {full ? (
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 md:text-3xl">{plainText(c.title)}</h1>
          ) : (
            <h2 className="text-xl font-extrabold tracking-tight text-gray-900 md:text-2xl">
              <Link href={href} className="hover:underline">
                {plainText(c.title)}
              </Link>
            </h2>
          )}
          <UpdateBody blocks={c.blocks} accent={accent} />
          {page.reactions && <ReactionBar slug={slug} id={u.id} strings={resolveUi(locale, workspace.uiStrings)} />}
        </div>
      </div>
    </article>
  );
}
