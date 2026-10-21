// Text and media formatting shared by the SDK and the dashboard preview, so
// both render guide content the same way. No dependencies: the SDK bundles it.

import type { LauncherIcon } from "./guide-schema";

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Only http(s) and same-site paths; never javascript: or data: URLs.
export function safeUrl(u: string) {
  return /^(https?:\/\/|\/(?!\/))/i.test(u.trim()) ? encodeURI(u.trim()) : "";
}

// ---------- Rich text ----------
//
// Guide text is stored as plain text with light markup, written by the rich
// text editor (src/lib/rich-editor.ts) and readable by humans and the AI:
//
//   **bold**  _italic_ (or *italic*)  ++underline++  ~~strike~~  [link](https://…)
//   "- item" / "• item" lines → bulleted list, "1. item" lines → numbered list
//   other line breaks → <br>; a backslash makes the next markup character literal.
//
// Markers only count when they hug text (**x**, not ** x **), so "C++ and C++"
// and "snake_case_name" stay as they are.

const ESCAPABLE = "\\*_~+[]().-#•";
const INLINE_MARKS: [string, string][] = [
  ["**", "strong"],
  ["++", "u"],
  ["~~", "s"],
  ["*", "em"],
  ["_", "em"],
];
const wordChar = (c: string | undefined) => Boolean(c && /[\p{L}\p{N}]/u.test(c));
const space = (c: string | undefined) => !c || /\s/.test(c);

function closeAt(s: string, from: number, m: string) {
  for (let j = from + 1; j <= s.length - m.length; j++) {
    if (s[j] === "\\") {
      j++;
      continue;
    }
    if (!s.startsWith(m, j) || space(s[j - 1])) continue;
    // A single * never closes on half of a **.
    if (m === "*" && (s[j + 1] === "*" || s[j - 1] === "*")) continue;
    if (m === "_" && wordChar(s[j + 1])) continue;
    return j;
  }
  return -1;
}

function linkAt(s: string, i: number) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "\\") {
      j++;
      continue;
    }
    if (s[j] === "[") depth++;
    else if (s[j] === "]" && --depth === 0) {
      const m = /^\(((?:https?:\/\/|\/|mailto:)[^)\s]+)\)/i.exec(s.slice(j + 1));
      return m && j > i + 1 ? { text: s.slice(i + 1, j), href: m[1], end: j + 1 + m[0].length } : null;
    }
  }
  return null;
}

function inlineHtml(s: string): string {
  let out = "";
  let i = 0;
  outer: while (i < s.length) {
    const c = s[i];
    if (c === "\\" && ESCAPABLE.includes(s[i + 1] ?? "")) {
      out += escapeHtml(s[i + 1]);
      i += 2;
      continue;
    }
    if (c === "[") {
      const link = linkAt(s, i);
      if (link) {
        out += `<a href="${escapeHtml(link.href)}" target="_blank" rel="noopener">${inlineHtml(link.text)}</a>`;
        i = link.end;
        continue;
      }
    }
    for (const [m, tag] of INLINE_MARKS) {
      if (!s.startsWith(m, i) || space(s[i + m.length])) continue;
      if (m === "*" && s[i + 1] === "*") continue;
      if (m === "_" && wordChar(s[i - 1])) continue;
      const end = closeAt(s, i + m.length, m);
      if (end < 0) continue;
      out += `<${tag}>${inlineHtml(s.slice(i + m.length, end))}</${tag}>`;
      i = end + m.length;
      continue outer;
    }
    out += escapeHtml(c);
    i++;
  }
  return out;
}

const LIST_LINE = /^(?:([-•])|(\d{1,3})\.) (.*)$/;

export function richText(s: string) {
  let html = "";
  let list: "ul" | "ol" | null = null;
  let afterText = false;
  const closeList = () => {
    if (list) html += `</${list}>`;
    list = null;
  };
  for (const line of s.split("\n")) {
    const m = LIST_LINE.exec(line);
    if (m) {
      const type = m[1] ? "ul" : "ol";
      if (list !== type) {
        closeList();
        list = type;
        html += type === "ol" && m[2] !== "1" ? `<ol class="rt-list" start="${Number(m[2])}">` : `<${type} class="rt-list">`;
      }
      html += `<li>${inlineHtml(m[3])}</li>`;
      afterText = false;
      continue;
    }
    closeList();
    if (afterText) html += "<br>";
    html += inlineHtml(line);
    afterText = true;
  }
  closeList();
  return html;
}

// The words only, for list labels and titles in places that show no formatting.
export function plainText(s: string) {
  return richText(s)
    .replace(/<\/?(li|ul|ol)\b[^>]*>|<br>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e as string]!)
    .replace(/\s+/g, " ")
    .trim();
}

// YouTube / Vimeo / Loom page links become embeds; direct video files play
// natively. Autoplay is always muted: browsers block it otherwise. Loom has no
// loop or controls parameters, so those only apply to YouTube, Vimeo and files.
export function videoEmbed(
  url: string,
  opts: { autoplay?: boolean; loop?: boolean; controls?: boolean } = {},
): { kind: "iframe" | "video"; src: string } | null {
  const u = url.trim();
  const auto = opts.autoplay ? "&autoplay=1&mute=1&muted=1" : "";
  const bare = opts.controls === false ? "&controls=0" : "";
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  // YouTube only loops a video that is also its own playlist.
  if (m) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0${auto}${bare}${opts.loop ? `&loop=1&playlist=${m[1]}` : ""}` };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { kind: "iframe", src: `https://player.vimeo.com/video/${m[1]}?dnt=1${auto}${bare}${opts.loop ? "&loop=1" : ""}` };
  m = u.match(/loom\.com\/(?:share|embed)\/([0-9a-f]{16,})/i);
  if (m) return { kind: "iframe", src: `https://www.loom.com/embed/${m[1]}?hide_owner=true${auto}` };
  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(u) && safeUrl(u)) return { kind: "video", src: safeUrl(u) };
  return null;
}
// The recording for a locale: exact, then same language (de-AT → de), then the default.
export function audioFor(block: { url: string; byLocale: Record<string, string> }, locale: string) {
  const exact = Object.entries(block.byLocale).find(([l, u]) => u && l.toLowerCase() === locale.toLowerCase());
  const base = locale.split("-")[0].toLowerCase();
  const same = Object.entries(block.byLocale).find(([l, u]) => u && l.split("-")[0].toLowerCase() === base);
  return (exact ?? same)?.[1] ?? block.url;
}

export const CARD_WIDTH = {
  tooltip: { sm: 280, md: 340, lg: 420 },
  modal: { sm: 380, md: 460, lg: 640 },
} as const;

// Resource center launcher icons (inner SVG markup, 24×24, stroked).
export const LAUNCHER_ICONS: Record<LauncherIcon, string> = {
  help: `<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>`,
  book: `<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>`,
  chat: `<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/>`,
  sparkle: `<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>`,
  rocket: `<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M9 15l-3-3c1-4 4.5-8 12-9-1 7.5-5 11-9 12z"/><circle cx="14.5" cy="9.5" r="1.5"/>`,
};

export const svgIcon = (paths: string, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
