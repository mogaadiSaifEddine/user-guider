import "server-only";
import { parse, NodeType, type HTMLElement, type Node } from "node-html-parser";
import { newId, type Block } from "./guide-schema";
import { videoEmbed } from "./format";

// Turns help center article HTML (Zendesk, Intercom) into content blocks:
// headings, text with the light markup of src/lib/format.ts, images, videos
// and dividers. Anything else (tables, callouts, embeds) is flattened to text,
// and reported so the importer can say which articles need a look.

const TEXT_LIMIT = 3800;

export type Converted = { blocks: Block[]; warnings: string[] };

// Markup characters in plain text must not turn into formatting.
function escapeText(s: string) {
  return s.replace(/[\\*_~+[\]]/g, "\\$&");
}

function absolute(url: string | undefined, baseUrl: string) {
  if (!url) return "";
  try {
    const u = new URL(url.trim(), baseUrl || undefined);
    return u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:" ? u.toString() : "";
  } catch {
    return "";
  }
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

const isEl = (n: Node): n is HTMLElement => n.nodeType === NodeType.ELEMENT_NODE;
const tag = (n: HTMLElement) => n.rawTagName?.toLowerCase() ?? "";

const BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "header", "footer", "main", "aside", "blockquote", "pre", "figure", "figcaption",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "table", "thead", "tbody", "tr", "hr", "img", "iframe", "video", "details", "summary",
]);

export function htmlToBlocks(html: string, baseUrl = ""): Converted {
  const root = parse(html ?? "", { comment: false, blockTextElements: { script: false, style: false, pre: true, noscript: false } });
  const blocks: Block[] = [];
  const warnings = new Set<string>();
  // Text paragraphs collected until the next heading/image/video/divider.
  let para: string[] = [];

  const flush = () => {
    const parts = para.map((p) => p.replace(/[ \t]+\n/g, "\n").trim()).filter(Boolean);
    para = [];
    let cur = "";
    for (const p of parts) {
      if (cur && cur.length + p.length + 2 > TEXT_LIMIT) {
        blocks.push({ type: "text", id: newId(), text: cur, align: "left" });
        cur = "";
      }
      cur = cur ? `${cur}\n\n${p}` : p.slice(0, TEXT_LIMIT);
    }
    if (cur) blocks.push({ type: "text", id: newId(), text: cur, align: "left" });
  };

  // Inline content to marked-up text.
  const inline = (n: Node): string => {
    if (n.nodeType === NodeType.TEXT_NODE) return escapeText(decode(n.rawText).replace(/\s+/g, " "));
    if (!isEl(n)) return "";
    const t = tag(n);
    const inner = () => n.childNodes.map(inline).join("");
    const wrap = (m: string) => {
      const s = inner();
      const trimmed = s.trim();
      if (!trimmed) return s;
      // Markers must hug the text: keep surrounding spaces outside.
      const lead = s.match(/^\s*/)![0];
      const trail = s.match(/\s*$/)![0];
      return `${lead}${m}${trimmed}${m}${trail}`;
    };
    switch (t) {
      case "br":
        return "\n";
      case "strong":
      case "b":
        return wrap("**");
      case "em":
      case "i":
        return wrap("_");
      case "u":
        return wrap("++");
      case "s":
      case "strike":
      case "del":
        return wrap("~~");
      case "a": {
        const href = absolute(n.getAttribute("href"), baseUrl);
        const text = inner().trim();
        return href && text ? `[${text}](${href.replace(/\)/g, "%29").replace(/ /g, "%20")})` : inner();
      }
      case "img":
      case "iframe":
      case "video":
      case "script":
      case "style":
        return "";
      case "span":
        // Zendesk's editor (and help centers migrated from it) underline with a class.
        return /\bwysiwyg-underline\b/.test(n.getAttribute("class") ?? "") || /text-decoration[^;]*underline/i.test(n.getAttribute("style") ?? "")
          ? wrap("++")
          : inner();
      default:
        return inner();
    }
  };

  // Lists become "- " / "1. " lines. A screenshot inside a step splits the
  // list: the lines so far, the image, then the list carries on numbering.
  const list = (el: HTMLElement, depth = 0, lines: string[] = []) => {
    const ordered = tag(el) === "ol";
    const isList = (c: Node) => isEl(c) && (tag(c) === "ul" || tag(c) === "ol");
    let i = Number(el.getAttribute("start")) || 1;
    for (const li of el.childNodes) {
      if (!isEl(li) || tag(li) !== "li") continue;
      const own = li.childNodes.filter((c) => !isList(c));
      const text = own.map(inline).join("").replace(/\s*\n\s*/g, " ").trim();
      // Nested lists are flattened, marked with a dash prefix.
      if (text) lines.push(`${ordered && depth === 0 ? `${i}. ` : "- "}${depth ? "– ".repeat(depth) : ""}${text}`);
      if (ordered && depth === 0) i++;
      const images = own.flatMap((c) => (isEl(c) ? (tag(c) === "img" ? [c] : c.querySelectorAll("img")) : []));
      if (images.length) {
        if (lines.length) para.push(lines.splice(0).join("\n"));
        images.forEach(image);
      }
      for (const c of li.childNodes) if (isList(c)) list(c as HTMLElement, depth + 1, lines);
    }
    if (depth === 0 && lines.length) para.push(lines.join("\n"));
  };

  const image = (img: HTMLElement) => {
    const url = absolute(img.getAttribute("src"), baseUrl);
    if (!url || url.startsWith("mailto:")) return;
    flush();
    const h = Number(img.getAttribute("height"));
    blocks.push({
      type: "image",
      id: newId(),
      url: url.slice(0, 1000),
      alt: decode(img.getAttribute("alt") ?? "").slice(0, 200),
      height: Number.isFinite(h) && h >= 60 ? Math.min(480, Math.round(h)) : 240,
      fit: "contain",
      edge: false,
      overlay: "",
    });
  };

  const video = (src: string | undefined) => {
    const url = absolute(src, baseUrl);
    if (url && videoEmbed(url)) {
      flush();
      blocks.push({ type: "video", id: newId(), url: url.slice(0, 1000), autoplay: false, loop: false, controls: true });
    } else if (url) {
      warnings.add("embeds other than YouTube, Vimeo and video files became links");
      para.push(`[${escapeText(url)}](${url})`);
    }
  };

  // Walks block-level structure; runs of inline content become paragraphs.
  const walk = (n: Node) => {
    let run = "";
    const endRun = () => {
      // A line of prose starting with "- " or "1. " must not become a list.
      const text = run
        .trim()
        .replace(/^([-•]) /gm, "\\$1 ")
        .replace(/^(\d{1,3})\. /gm, "$1\\. ");
      if (text) para.push(text);
      run = "";
    };
    for (const c of n.childNodes) {
      if (!isEl(c)) {
        run += inline(c);
        continue;
      }
      const t = tag(c);
      if (!BLOCK_TAGS.has(t) && !c.querySelector("img, iframe, video, p, div, ul, ol, table, h1, h2, h3, h4, h5, h6")) {
        run += inline(c);
        continue;
      }
      endRun();
      switch (t) {
        case "h1":
        case "h2":
        case "h3": {
          const text = c.childNodes.map(inline).join("").replace(/\s+/g, " ").trim();
          if (text) {
            flush();
            blocks.push({ type: "heading", id: newId(), text: text.slice(0, 200), align: "left" });
          }
          break;
        }
        case "h4":
        case "h5":
        case "h6": {
          const text = c.childNodes.map(inline).join("").replace(/\s+/g, " ").trim();
          if (text) para.push(`**${text.replace(/\*\*/g, "")}**`);
          break;
        }
        case "ul":
        case "ol": {
          list(c);
          break;
        }
        case "hr":
          flush();
          blocks.push({ type: "divider", id: newId() });
          break;
        case "img":
          image(c);
          break;
        case "iframe":
          video(c.getAttribute("src"));
          break;
        case "video":
          video(c.getAttribute("src") ?? c.querySelector("source")?.getAttribute("src"));
          break;
        case "pre":
          para.push(escapeText(decode(c.innerText)).trim());
          warnings.add("code blocks became plain text");
          break;
        case "table": {
          const rows = c.querySelectorAll("tr").map((tr) =>
            tr
              .querySelectorAll("th, td")
              .map((cell) => cell.childNodes.map(inline).join("").replace(/\s+/g, " ").trim())
              .join(" | "),
          );
          if (rows.length) para.push(rows.filter(Boolean).join("\n"));
          warnings.add("tables became lines of text");
          break;
        }
        default:
          walk(c);
      }
    }
    endRun();
  };

  walk(root);
  flush();
  // An article can't hold more than 400 blocks; merge the tail if one ever does.
  if (blocks.length > 400) {
    warnings.add("very long article was shortened");
    blocks.length = 400;
  }
  return { blocks, warnings: [...warnings] };
}

// Plain text for summaries.
export function htmlToText(html: string) {
  return decode(parse(html ?? "").innerText).replace(/\s+/g, " ").trim();
}
