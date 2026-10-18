import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import { Marked } from "marked";

// Docs live as Markdown in content/docs/<slug>.md. This list sets their order,
// titles and sidebar grouping; a page that isn't listed here isn't served.

export type DocPage = { slug: string; title: string; description: string };
export type DocSection = { title: string; pages: DocPage[] };

export const docSections: DocSection[] = [
  {
    title: "Start here",
    pages: [
      { slug: "", title: "Introduction", description: "What Locatify Guides does and the ideas behind it." },
      { slug: "quick-start", title: "Quick start", description: "From a new account to your first live tour." },
    ],
  },
  {
    title: "For guide authors",
    pages: [
      { slug: "tours", title: "Product tours", description: "Step-by-step tooltips that point at your app." },
      { slug: "builder", title: "The visual builder", description: "Attach steps to elements by clicking them on your site." },
      { slug: "ai", title: "Draft guides with AI", description: "Let AI pick the features to highlight and write a first draft." },
      { slug: "checklists", title: "Checklists", description: "Onboarding tasks that tick themselves off." },
      { slug: "announcements", title: "Announcements", description: "Modals and banners for news." },
      { slug: "hotspots", title: "Hotspots", description: "Pulsing beacons with a hint." },
      { slug: "targeting", title: "Targeting and timing", description: "Who sees a guide, where, when and how often." },
      { slug: "publishing", title: "Publishing and editing", description: "Drafts, live versions, archiving." },
      { slug: "analytics", title: "Analytics", description: "Reach, completion and where people drop off." },
      { slug: "workspace", title: "Workspace, team and theme", description: "Members, roles, colors and keys." },
      { slug: "import-userguiding", title: "Import from UserGuiding", description: "Bring your UserGuiding guides and checklists over." },
    ],
  },
  {
    title: "For developers",
    pages: [
      { slug: "install", title: "Install the snippet", description: "Add Locatify Guides to any website or web app." },
      { slug: "identify", title: "Identify users", description: "Tell Locatify Guides who is signed in." },
      { slug: "javascript-api", title: "JavaScript API", description: "identify, track, start, page and reset." },
      { slug: "identity-verification", title: "Identity verification", description: "Stop people from impersonating other users." },
      { slug: "http-api", title: "HTTP API", description: "Send events from your server." },
      { slug: "troubleshooting", title: "Troubleshooting", description: "When a guide doesn't show up." },
    ],
  },
  {
    title: "Self-hosting",
    pages: [
      { slug: "self-hosting", title: "Deploy", description: "Run Locatify Guides on your own servers." },
      { slug: "operations", title: "Operations", description: "Upgrades, backups, data retention and security." },
    ],
  },
];

export const allDocs = docSections.flatMap((s) => s.pages.map((p) => ({ ...p, section: s.title })));

export function findDoc(slug: string) {
  const i = allDocs.findIndex((d) => d.slug === slug);
  if (i < 0) return null;
  return { doc: allDocs[i], prev: allDocs[i - 1] ?? null, next: allDocs[i + 1] ?? null };
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export type Heading = { id: string; text: string };

// Docs are our own trusted files, so raw HTML in them is allowed.
export async function renderDoc(slug: string) {
  const file = path.join(process.cwd(), "content", "docs", `${slug || "index"}.md`);
  const source = await readFile(file, "utf8");
  const headings: Heading[] = [];
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        const id = slugify(html);
        if (depth === 2) headings.push({ id, text: html.replace(/<[^>]+>/g, "") });
        return `<h${depth} id="${id}"><a href="#${id}" class="anchor">${html}</a></h${depth}>`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href);
        // Relative links between docs pages: "targeting" -> "/docs/targeting".
        const url = external || href.startsWith("/") || href.startsWith("#") ? href : `/docs/${href}`;
        return `<a href="${url}"${title ? ` title="${title}"` : ""}${external ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
      },
    },
  });
  const html = await marked.parse(source);
  return { html, headings };
}
