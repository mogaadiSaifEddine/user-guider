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

// Guide text is plain text with **bold**, *italic*, [links](https://…) and line breaks.
export function richText(s: string) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, "<br>");
}

// YouTube / Vimeo page links become embeds; direct video files play natively.
export function videoEmbed(url: string): { kind: "iframe" | "video"; src: string } | null {
  const u = url.trim();
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (m) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0` };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { kind: "iframe", src: `https://player.vimeo.com/video/${m[1]}` };
  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(u) && safeUrl(u)) return { kind: "video", src: safeUrl(u) };
  return null;
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
