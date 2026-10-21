import type { Block, ButtonAction } from "../src/lib/guide-schema";
import { currentLocale, t, te } from "./i18n";
import { audioFor, CARD_WIDTH, escapeHtml, plainText, richText, safeUrl, videoEmbed } from "../src/lib/format";

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
          const v = videoEmbed(b.url, b);
          if (!v) return "";
          return `<div class="lg-b lg-video${first}">${
            v.kind === "iframe"
              ? `<iframe src="${v.src}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy" title="${te("video")}"></iframe>`
              : `<video src="${v.src}" data-media="${escapeHtml(b.id)}" playsinline preload="metadata"${b.controls ? " controls" : " disablepictureinpicture disableremoteplayback"}${b.autoplay ? " autoplay muted" : ""}${b.loop ? " loop" : ""}></video>`
          }</div>`;
        }
        case "audio": {
          const src = safeUrl(audioFor(b, currentLocale()));
          if (!src) return "";
          return `<div class="lg-b lg-audio${first}">
            <button class="lg-audio-btn" aria-label="${te("play")}">${PLAY}</button>
            <div class="lg-audio-main">${b.label ? `<div class="lg-audio-label">${escapeHtml(b.label)}</div>` : ""}<div class="lg-audio-bar"><span></span></div></div>
            <span class="lg-audio-time">0:00</span>
            <audio src="${src}" data-media="${escapeHtml(b.id)}" preload="metadata"${b.autoplay ? " data-autoplay" : ""}></audio>
          </div>`;
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

const PLAY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>`;
const PAUSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>`;

const clock = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

// Wires the audio players drawn by renderBlocks, and reports when a video file
// or audio clip plays to the end. Call once per render.
export function wireMedia(root: ParentNode, onEnded: (blockId: string) => void) {
  for (const box of root.querySelectorAll<HTMLElement>(".lg-audio")) {
    const audio = box.querySelector("audio")!;
    const btn = box.querySelector<HTMLButtonElement>(".lg-audio-btn")!;
    const bar = box.querySelector<HTMLElement>(".lg-audio-bar")!;
    const fill = bar.querySelector("span")!;
    const time = box.querySelector(".lg-audio-time")!;
    const sync = () => {
      btn.innerHTML = audio.paused ? PLAY : PAUSE;
      btn.setAttribute("aria-label", t(audio.paused ? "play" : "pause"));
      fill.style.width = (audio.duration ? (audio.currentTime / audio.duration) * 100 : 0) + "%";
      time.textContent = clock(audio.paused && !audio.currentTime ? audio.duration : audio.currentTime);
    };
    btn.addEventListener("click", () => (audio.paused ? void audio.play().catch(() => {}) : audio.pause()));
    bar.addEventListener("click", (e) => {
      const r = bar.getBoundingClientRect();
      if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
    });
    for (const ev of ["play", "pause", "timeupdate", "loadedmetadata", "ended"]) audio.addEventListener(ev, sync);
    // Autoplay with sound is often blocked; the play button is the fallback.
    if (audio.hasAttribute("data-autoplay")) void audio.play().catch(() => {});
  }
  for (const m of root.querySelectorAll<HTMLMediaElement>("[data-media]")) {
    m.addEventListener("ended", () => onEnded(m.dataset.media!));
  }
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
  return b.buttons
    .map((btn, j) => `<button class="lg-btn${btn.style === "primary" ? "" : " lg-ghost"}" data-btn="${i}:${j}">${escapeHtml(btn.label)}</button>`)
    .join("");
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
  for (const b of blocks) if ((b.type === "heading" || b.type === "text") && b.text) return plainText(b.text).slice(0, 80);
  return t("guide");
}
