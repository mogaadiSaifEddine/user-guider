// Text and media formatting shared by the SDK and the dashboard preview, so
// both render guide content the same way. No dependencies: the SDK bundles it.

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
