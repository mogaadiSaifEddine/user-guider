import type { Block, ButtonAction } from "../src/lib/guide-schema";
import { CARD_WIDTH, escapeHtml, richText, safeUrl, videoEmbed } from "../src/lib/format";

export { CARD_WIDTH };

// Renders a step's blocks to HTML inside the shadow root. Buttons carry
// data-btn="<block index>:<button index>"; the caller resolves clicks with buttonAt().

export function renderBlocks(blocks: Block[]) {
  return blocks
    .map((b, i) => {
      const first = i === 0 ? " lg-first" : "";
      switch (b.type) {
        case "heading":
          return b.text ? `<h3 class="lg-b${first}" style="text-align:${b.align}">${richText(b.text)}</h3>` : "";
        case "text":
          return b.text ? `<div class="lg-b lg-text${first}" style="text-align:${b.align}">${richText(b.text)}</div>` : "";
        case "image": {
          const src = safeUrl(b.url);
          if (!src) return "";
          return `<div class="lg-b lg-img${b.edge ? " lg-edge" : ""}${first}" style="height:${b.height}px">
            <img src="${src}" alt="${escapeHtml(b.alt)}" style="object-fit:${b.fit}">
            ${b.overlay ? `<div class="lg-overlay">${richText(b.overlay)}</div>` : ""}
          </div>`;
        }
        case "video": {
          const v = videoEmbed(b.url);
          if (!v) return "";
          return `<div class="lg-b lg-video${first}">${
            v.kind === "iframe"
              ? `<iframe src="${v.src}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy" title="Video"></iframe>`
              : `<video src="${v.src}" controls playsinline preload="metadata"></video>`
          }</div>`;
        }
        case "buttons":
          if (!b.buttons.length) return "";
          return `<div class="lg-b lg-buttons${first}" style="justify-content:${b.align === "left" ? "flex-start" : b.align === "center" ? "center" : "flex-end"}">${b.buttons
            .map(
              (btn, j) =>
                `<button class="lg-btn${btn.style === "secondary" ? " lg-ghost" : btn.style === "link" ? " lg-link-btn" : ""}" data-btn="${i}:${j}">${escapeHtml(btn.label)}</button>`,
            )
            .join("")}</div>`;
        case "divider":
          return `<hr class="lg-b lg-divider${first}">`;
        case "spacer":
          return `<div class="lg-b" style="height:${b.size}px"></div>`;
      }
    })
    .join("");
}

// Plain-text version for a banner: headings and text in one line.
export function bannerText(blocks: Block[]) {
  return blocks
    .map((b) =>
      b.type === "heading" && b.text ? `<strong>${richText(b.text)}</strong>` : b.type === "text" && b.text ? richText(b.text) : "",
    )
    .filter(Boolean)
    .join(" ");
}

export function bannerButtons(blocks: Block[]) {
  const i = blocks.findIndex((b) => b.type === "buttons");
  const b = blocks[i];
  if (!b || b.type !== "buttons") return "";
  return b.buttons.map((btn, j) => `<button class="lg-btn" data-btn="${i}:${j}">${escapeHtml(btn.label)}</button>`).join("");
}

export function buttonAt(blocks: Block[], ref: string | undefined): ButtonAction | null {
  if (!ref) return null;
  const [i, j] = ref.split(":").map(Number);
  const b = blocks[i];
  return b?.type === "buttons" ? (b.buttons[j]?.action ?? null) : null;
}

export function openUrl(url: string, newTab: boolean) {
  if (!safeUrl(url)) return;
  if (newTab) window.open(url.trim(), "_blank", "noopener");
  else location.href = url.trim();
}

export function label(blocks: Block[]) {
  for (const b of blocks) if ((b.type === "heading" || b.type === "text") && b.text) return b.text.slice(0, 80);
  return "Guide";
}
