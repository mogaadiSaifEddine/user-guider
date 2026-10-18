import type { Theme } from "../src/lib/guide-schema";

// Everything the SDK draws lives in one shadow root so host-page CSS can't
// leak in and ours can't leak out.

let host: HTMLElement | null = null;
let root: ShadowRoot | null = null;

export function isOwnElement(el: EventTarget | null) {
  return el === host;
}

export function shadow(): ShadowRoot {
  if (root) return root;
  host = document.createElement("locatify-guides");
  host.style.cssText = "all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000;";
  root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  root.appendChild(style);
  document.documentElement.appendChild(host);
  return root;
}

export function applyTheme(theme: Theme) {
  const h = (shadow(), host!);
  h.style.setProperty("--lg-primary", theme.primaryColor);
  h.style.setProperty("--lg-text", theme.textColor);
  h.style.setProperty("--lg-bg", theme.backgroundColor);
  h.style.setProperty("--lg-radius", theme.radius + "px");
  h.style.setProperty("--lg-font", theme.fontFamily === "inherit" ? "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" : theme.fontFamily);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  html = "",
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
}

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

// First visible element matching the selector.
export function findTarget(selector: string): Element | null {
  if (!selector) return null;
  let list: NodeListOf<Element>;
  try {
    list = document.querySelectorAll(selector);
  } catch {
    return null;
  }
  for (const e of list) {
    const r = e.getBoundingClientRect();
    if (r.width > 0 || r.height > 0) return e;
  }
  return null;
}

export function waitForTarget(selector: string, timeoutMs: number, isCancelled: () => boolean): Promise<Element | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (isCancelled()) return resolve(null);
      const t = findTarget(selector);
      if (t) return resolve(t);
      if (Date.now() - start > timeoutMs) return resolve(null);
      setTimeout(tick, 250);
    };
    tick();
  });
}

export type Placement = "auto" | "top" | "bottom" | "left" | "right";

// Positions a fixed `box` next to `rect`, flipping when there's no room.
export function placeBox(box: HTMLElement, rect: DOMRect, placement: Placement, gap = 12) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bw = box.offsetWidth;
  const bh = box.offsetHeight;
  const room = {
    bottom: vh - rect.bottom,
    top: rect.top,
    right: vw - rect.right,
    left: rect.left,
  };
  const fits = (p: Exclude<Placement, "auto">) =>
    p === "bottom" || p === "top" ? room[p] >= bh + gap : room[p] >= bw + gap;
  const order: Exclude<Placement, "auto">[] =
    placement === "auto" ? ["bottom", "top", "right", "left"] : [placement, "bottom", "top", "right", "left"];
  const p = order.find(fits) ?? "bottom";

  let top: number;
  let left: number;
  if (p === "bottom" || p === "top") {
    top = p === "bottom" ? rect.bottom + gap : rect.top - bh - gap;
    left = rect.left + rect.width / 2 - bw / 2;
  } else {
    left = p === "right" ? rect.right + gap : rect.left - bw - gap;
    top = rect.top + rect.height / 2 - bh / 2;
  }
  box.style.top = clamp(top, 8, vh - bh - 8) + "px";
  box.style.left = clamp(left, 8, vw - bw - 8) + "px";
  box.dataset.placement = p;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, Math.max(min, max)));
}

export function inViewport(r: DOMRect) {
  return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
}

// Calls `fn` every animation frame until the returned stop function runs.
export function everyFrame(fn: () => void) {
  let id = 0;
  const loop = () => {
    fn();
    id = requestAnimationFrame(loop);
  };
  id = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(id);
}

const CSS = `
:host { --lg-primary:#4f46e5; --lg-text:#1f2937; --lg-bg:#fff; --lg-radius:10px; --lg-font:system-ui,sans-serif; }
* { box-sizing:border-box; }
.lg { font-family:var(--lg-font); color:var(--lg-text); font-size:14px; line-height:1.5; }
.lg a { color:var(--lg-primary); }
.lg-card { position:fixed; width:min(340px, calc(100vw - 16px)); background:var(--lg-bg); border-radius:var(--lg-radius);
  box-shadow:0 12px 40px rgba(0,0,0,.22), 0 2px 6px rgba(0,0,0,.08); padding:18px 18px 14px; pointer-events:auto;
  animation:lg-in .18s ease-out; }
.lg-card h3 { margin:0 26px 6px 0; font-size:16px; font-weight:650; line-height:1.3; }
.lg-card .lg-body { margin:0 0 14px; word-wrap:break-word; }
.lg-card .lg-body:empty { display:none; }
.lg-close { position:absolute; top:10px; right:10px; width:26px; height:26px; border:0; background:transparent;
  color:inherit; opacity:.55; cursor:pointer; border-radius:6px; font-size:18px; line-height:1; }
.lg-close:hover { opacity:1; background:rgba(0,0,0,.06); }
.lg-footer { display:flex; align-items:center; gap:8px; }
.lg-count { font-size:12px; opacity:.6; margin-right:auto; }
.lg-btn { border:0; border-radius:calc(var(--lg-radius) * .7); padding:7px 14px; font:inherit; font-weight:600; cursor:pointer;
  background:var(--lg-primary); color:#fff; }
.lg-btn:hover { filter:brightness(1.08); }
.lg-btn.lg-ghost { background:transparent; color:var(--lg-text); opacity:.75; }
.lg-btn.lg-ghost:hover { opacity:1; background:rgba(0,0,0,.05); }
.lg-modal-wrap { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; padding:16px;
  background:rgba(15,23,42,.45); pointer-events:auto; }
.lg-modal-wrap .lg-card { position:relative; width:min(460px, 100%); padding:24px; }
.lg-modal-wrap .lg-card img { display:block; width:calc(100% + 48px); margin:-24px -24px 16px; max-height:240px; object-fit:cover;
  border-radius:var(--lg-radius) var(--lg-radius) 0 0; }
.lg-spot { position:fixed; border-radius:8px; pointer-events:none; box-shadow:0 0 0 4px var(--lg-primary), 0 0 0 9999px rgba(15,23,42,.45);
  transition:all .2s ease; }
.lg-spot.lg-nobackdrop { box-shadow:0 0 0 3px var(--lg-primary); }
.lg-banner { position:fixed; top:0; left:0; right:0; display:flex; align-items:center; justify-content:center; gap:14px;
  padding:10px 48px 10px 16px; background:var(--lg-primary); color:#fff; pointer-events:auto; animation:lg-down .2s ease-out; flex-wrap:wrap; }
.lg-banner a { color:#fff; }
.lg-banner .lg-btn { background:#fff; color:var(--lg-primary); padding:5px 12px; }
.lg-banner .lg-close { color:#fff; opacity:.8; top:50%; transform:translateY(-50%); }
.lg-beacon { position:fixed; width:22px; height:22px; margin:-11px 0 0 -11px; border:0; padding:0; border-radius:50%; cursor:pointer;
  background:transparent; pointer-events:auto; }
.lg-beacon::before, .lg-beacon::after { content:""; position:absolute; inset:5px; border-radius:50%; background:var(--lg-primary); }
.lg-beacon::after { inset:0; opacity:.5; animation:lg-pulse 1.6s ease-out infinite; }
.lg-launcher { position:fixed; bottom:20px; display:flex; align-items:center; gap:10px; border:0; cursor:pointer; pointer-events:auto;
  background:var(--lg-primary); color:#fff; padding:10px 16px 10px 12px; border-radius:999px; font:inherit; font-weight:600;
  box-shadow:0 8px 24px rgba(0,0,0,.2); }
.lg-launcher .lg-badge { background:rgba(255,255,255,.25); border-radius:999px; padding:1px 8px; font-size:12px; }
.lg-panel { position:fixed; bottom:76px; width:min(360px, calc(100vw - 24px)); max-height:min(560px, calc(100vh - 100px)); overflow:auto;
  background:var(--lg-bg); border-radius:var(--lg-radius); box-shadow:0 16px 48px rgba(0,0,0,.25); pointer-events:auto; animation:lg-in .18s ease-out; }
.lg-panel header { padding:18px 18px 12px; position:relative; }
.lg-panel header h3 { margin:0 26px 4px 0; font-size:16px; }
.lg-panel header p { margin:0; opacity:.7; font-size:13px; }
.lg-progress { height:6px; background:rgba(0,0,0,.08); border-radius:3px; margin-top:12px; overflow:hidden; }
.lg-progress span { display:block; height:100%; background:var(--lg-primary); transition:width .3s; }
.lg-items { list-style:none; margin:0; padding:4px 8px 8px; }
.lg-item { display:flex; gap:12px; align-items:flex-start; padding:10px; border-radius:8px; cursor:pointer; }
.lg-item:hover { background:rgba(0,0,0,.04); }
.lg-check { flex:none; width:22px; height:22px; border-radius:50%; border:2px solid rgba(0,0,0,.2); display:flex; align-items:center;
  justify-content:center; color:#fff; font-size:13px; margin-top:1px; }
.lg-item.lg-done .lg-check { background:var(--lg-primary); border-color:var(--lg-primary); }
.lg-item.lg-done .lg-title { text-decoration:line-through; opacity:.55; }
.lg-title { font-weight:600; }
.lg-desc { font-size:13px; opacity:.7; }
.lg-panel footer { padding:0 18px 14px; text-align:right; }
.lg-link { background:none; border:0; font:inherit; font-size:12px; color:inherit; opacity:.6; cursor:pointer; text-decoration:underline; }
@keyframes lg-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
@keyframes lg-down { from { transform:translateY(-100%); } to { transform:none; } }
@keyframes lg-pulse { from { transform:scale(.6); opacity:.6; } to { transform:scale(1.8); opacity:0; } }
@media (prefers-reduced-motion: reduce) { * { animation:none !important; transition:none !important; } }
`;
