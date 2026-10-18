import { toCanvas } from "html-to-image";

// Screenshot of the visible part of the page with a numbered box on each
// element ("set-of-marks"), so the AI can match ids to what it sees.
// Built separately into public/sdk-capture.js; only builder mode loads it.

type Mark = { id: number; x: number; y: number; w: number; h: number };

const MAX_WIDTH = 1280;
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

async function capture(marks: Mark[]): Promise<string | null> {
  const vw = innerWidth;
  const vh = innerHeight;
  const scale = Math.min(1, MAX_WIDTH / vw);
  const base = await toCanvas(document.body, {
    width: vw,
    height: vh,
    canvasWidth: Math.round(vw * scale),
    canvasHeight: Math.round(vh * scale),
    pixelRatio: 1,
    skipFonts: true,
    imagePlaceholder: BLANK,
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    // Render only the viewport: shift the page by the scroll position.
    style: { transform: `translate(${-scrollX}px, ${-scrollY}px)`, transformOrigin: "top left", margin: "0" },
    filter: (n) => !(n instanceof Element && n.tagName === "LOCATIFY-GUIDES"),
  });

  const ctx = base.getContext("2d");
  if (!ctx) return null;

  // Never send what's typed in fields: cover every field's area.
  const fields = document.querySelectorAll(
    "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]):not([type=color]),textarea,select,[contenteditable=''],[contenteditable=true]",
  );
  ctx.fillStyle = "#e5e7eb";
  for (const f of fields) {
    if (f.closest("locatify-guides")) continue;
    const r = f.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > vh) continue;
    ctx.fillRect(r.left * scale, r.top * scale, r.width * scale, r.height * scale);
  }

  ctx.lineWidth = 2;
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textBaseline = "top";
  for (const m of marks) {
    const x = (m.x - scrollX) * scale;
    const y = (m.y - scrollY) * scale;
    const w = m.w * scale;
    const h = m.h * scale;
    if (x + w < 0 || y + h < 0 || x > base.width || y > base.height) continue;
    ctx.strokeStyle = "#e11d48";
    ctx.strokeRect(x, y, w, h);
    const label = String(m.id);
    const tw = ctx.measureText(label).width + 6;
    const ly = y >= 15 ? y - 15 : y;
    ctx.fillStyle = "#e11d48";
    ctx.fillRect(x, ly, tw, 15);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x + 3, ly + 1.5);
  }
  return base.toDataURL("image/jpeg", 0.72).split(",")[1] ?? null;
}

(window as unknown as { __lgCapture?: typeof capture }).__lgCapture = capture;
