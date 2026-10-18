import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { allDocs, findDoc, renderDoc } from "@/lib/docs";

type Params = { params: Promise<{ slug?: string[] }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return allDocs.map((d) => ({ slug: d.slug ? [d.slug] : [] }));
}

async function slugOf(params: Params["params"]) {
  const { slug } = await params;
  return (slug ?? []).join("/");
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const found = findDoc(await slugOf(params));
  return found ? { title: found.doc.slug ? found.doc.title : { absolute: "Locatify Guides docs" }, description: found.doc.description } : {};
}

export default async function DocPage({ params }: Params) {
  const found = findDoc(await slugOf(params));
  if (!found) notFound();
  const { doc, prev, next } = found;
  const { html, headings } = await renderDoc(doc.slug);

  return (
    <div className="flex gap-10 px-4 py-8 md:px-10 md:py-10">
      <article className="min-w-0 flex-1 xl:max-w-3xl">
        <div className="mb-2 text-sm font-medium text-indigo-600">{doc.section}</div>
        <div
          className="prose prose-gray max-w-none prose-headings:scroll-mt-20 prose-h1:mb-3 prose-h1:text-3xl prose-a:text-indigo-600 prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-[13px] prose-table:text-sm prose-img:rounded-lg [&_.anchor]:text-inherit [&_.anchor]:no-underline [&_pre_code]:bg-transparent [&_pre_code]:p-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <nav className="mt-12 grid gap-3 border-t border-gray-200 pt-6 sm:grid-cols-2">
          {prev ? (
            <Link href={`/docs/${prev.slug}`} className="rounded-lg p-4 ring-1 ring-gray-200 hover:ring-indigo-300">
              <div className="text-xs text-gray-500">← Previous</div>
              <div className="font-medium">{prev.title}</div>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/docs/${next.slug}`} className="rounded-lg p-4 text-right ring-1 ring-gray-200 hover:ring-indigo-300">
              <div className="text-xs text-gray-500">Next →</div>
              <div className="font-medium">{next.title}</div>
            </Link>
          )}
        </nav>
      </article>
      {headings.length > 1 && (
        <aside className="sticky top-24 hidden h-fit w-56 shrink-0 xl:block">
          <div className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">On this page</div>
          <ul className="space-y-1.5 text-sm">
            {headings.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`} className="text-gray-600 hover:text-gray-900">
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
