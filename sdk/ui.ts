import type { Theme } from "../src/lib/guide-schema";

// Everything the SDK draws lives in one shadow root so host-page CSS can't
// leak in and ours can't leak out.

let host: HTMLElement | null = null;
let root: ShadowRoot | null = null;
let theme: Theme | null = null;

// Inline cards live inside the host page, each in a <user-onboarder-inline> of its own.
export const INLINE_TAG = "user-onboarder-inline";

export function isOwnElement(el: EventTarget | null) {
  return el === host || (el instanceof Element && el.localName === INLINE_TAG);
}

function newHost(tag: string, css: string) {
  const h = document.createElement(tag);
  h.style.cssText = css;
  const r = h.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  r.appendChild(style);
  if (theme) setThemeVars(h, theme);
  return { host: h, root: r };
}

export function shadow(): ShadowRoot {
  if (root) return root;
  ({ host, root } = newHost("user-onboarder", "all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000;"));
  document.documentElement.appendChild(host);
  return root;
}

// A host that flows with the page; the caller inserts it.
export function inlineHost() {
  return newHost(INLINE_TAG, "all:initial;display:block;");
}

export function applyTheme(next: Theme) {
  theme = next;
  setThemeVars((shadow(), host!), next);
}

function setThemeVars(h: HTMLElement, t: Theme) {
  h.style.setProperty("--lg-primary", t.primaryColor);
  h.style.setProperty("--lg-text", t.textColor);
  h.style.setProperty("--lg-bg", t.backgroundColor);
  h.style.setProperty("--lg-radius", t.radius + "px");
  h.style.setProperty("--lg-font", t.fontFamily === "inherit" ? "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" : t.fontFamily);
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

export { escapeHtml, richText, safeUrl } from "../src/lib/format";

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
:host { --lg-primary:#6847f5; --lg-text:#14152b; --lg-bg:#fff; --lg-radius:14px; --lg-font:system-ui,sans-serif;
  --lg-grad:linear-gradient(135deg, color-mix(in srgb, var(--lg-primary) 72%, #fff), var(--lg-primary));
  --lg-glow:0 6px 16px color-mix(in srgb, var(--lg-primary) 32%, transparent);
  --lg-float:0 20px 50px rgba(20,21,43,.22), 0 4px 12px rgba(20,21,43,.06), 0 0 0 1px rgba(20,21,43,.05); }
* { box-sizing:border-box; }
.lg { font-family:var(--lg-font); color:var(--lg-text); font-size:14px; line-height:1.5; }
.lg a { color:var(--lg-primary); }
.lg-card { position:fixed; width:min(340px, calc(100vw - 16px)); background:var(--lg-bg); border-radius:var(--lg-radius);
  box-shadow:var(--lg-float); padding:18px 18px 14px; pointer-events:auto;
  animation:lg-in .18s ease-out; }
.lg-card h3 { margin:0 26px 6px 0; font-size:16px; font-weight:750; line-height:1.3; letter-spacing:-.01em; }
.lg-card { --lg-pad:18px; }
.lg-modal-wrap .lg-card { --lg-pad:24px; }
.lg-b { margin:0 0 12px; }
.lg-card h3.lg-b { margin:0 0 6px; }
.lg-card h3.lg-first { margin-right:26px; }
.lg-text { word-wrap:break-word; }
.lg ul.rt-list, .lg ol.rt-list { margin:4px 0; padding-left:20px; }
.lg ul.rt-list { list-style:disc; }
.lg ol.rt-list { list-style:decimal; }
.lg u { text-decoration:underline; }
.lg-img { position:relative; overflow:hidden; border-radius:calc(var(--lg-radius) * .6); }
.lg-img img { display:block; width:100%; height:100%; }
.lg-img.lg-edge { margin-left:calc(var(--lg-pad) * -1); margin-right:calc(var(--lg-pad) * -1); border-radius:0; }
.lg-img.lg-edge.lg-first { margin-top:calc(var(--lg-pad) * -1); border-radius:var(--lg-radius) var(--lg-radius) 0 0; }
.lg-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:16px; text-align:center;
  color:#fff; font-size:24px; font-weight:750; line-height:1.2; text-shadow:0 2px 12px rgba(0,0,0,.35); }
.lg-video { position:relative; aspect-ratio:16/9; border-radius:calc(var(--lg-radius) * .6); overflow:hidden; background:#000; }
.lg-video iframe, .lg-video video { position:absolute; inset:0; width:100%; height:100%; border:0; }
.lg-buttons { display:flex; flex-wrap:wrap; gap:8px; }
.lg-btn.lg-link-btn { background:transparent; box-shadow:none; color:var(--lg-primary); padding-left:4px; padding-right:4px; text-decoration:underline; }
.lg-divider { border:0; border-top:1px solid rgba(0,0,0,.1); }
.lg-close { z-index:1; }
.lg-card:has(> .lg-img.lg-edge.lg-first) > .lg-close { background:rgba(255,255,255,.85); opacity:.9; }
.lg-card .lg-body { margin:0 0 14px; word-wrap:break-word; }
.lg-card .lg-body:empty { display:none; }
.lg-close { position:absolute; top:10px; right:10px; width:26px; height:26px; border:0; background:transparent;
  color:inherit; opacity:.55; cursor:pointer; border-radius:6px; font-size:18px; line-height:1; }
.lg-close:hover { opacity:1; background:rgba(0,0,0,.06); }
.lg-footer { display:flex; align-items:center; gap:8px; }
.lg-count { font-size:12px; opacity:.6; margin-right:auto; }
.lg-btn { border:0; border-radius:calc(var(--lg-radius) * .7); padding:7px 14px; font:inherit; font-weight:650; cursor:pointer;
  background:var(--lg-grad); color:#fff; box-shadow:var(--lg-glow); transition:filter .15s, transform .15s; }
.lg-btn:hover { filter:brightness(1.08); }
.lg-btn:active { transform:translateY(1px); }
.lg-btn:focus { outline:none; }
.lg-btn:focus-visible { outline:2px solid var(--lg-primary); outline-offset:2px; }
.lg-btn.lg-ghost { background:transparent; box-shadow:none; color:var(--lg-text); opacity:.75; }
.lg-btn.lg-ghost:hover { opacity:1; background:rgba(0,0,0,.05); }
.lg-modal-wrap { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; padding:16px;
  background:rgba(15,18,34,.5); backdrop-filter:blur(2px); pointer-events:auto; }
.lg-modal-wrap .lg-card { position:relative; padding:24px; max-height:calc(100vh - 32px); overflow:auto; }
.lg-spot { position:fixed; border-radius:8px; pointer-events:none; box-shadow:0 0 0 4px color-mix(in srgb, var(--lg-primary) 70%, #fff), 0 0 0 9999px rgba(15,18,34,.5);
  transition:all .2s ease; }
.lg-spot.lg-nobackdrop { box-shadow:0 0 0 3px var(--lg-primary); }
/* Banner colors come from --lg-bb (background), --lg-bf (text) and --lg-bs (solid accent for buttons). */
.lg-banner { position:fixed; left:0; right:0; display:flex; align-items:center; justify-content:center; gap:14px;
  padding:10px 48px 10px 16px; background:var(--lg-bb, var(--lg-grad)); color:var(--lg-bf, #fff); pointer-events:auto; flex-wrap:wrap; }
.lg-banner.lg-top { top:0; animation:lg-down .2s ease-out; }
.lg-banner.lg-bottom { bottom:0; animation:lg-up .2s ease-out; }
.lg-banner.lg-nodismiss { padding-right:16px; }
.lg-banner a { color:inherit; }
.lg-banner a.lg-banner-text { text-decoration:underline; text-underline-offset:2px; }
.lg-banner .lg-btn { background:var(--lg-bf, #fff); color:var(--lg-bs, var(--lg-primary)); padding:5px 12px; box-shadow:none; }
.lg-banner .lg-btn.lg-ghost { background:transparent; color:inherit; box-shadow:inset 0 0 0 1px currentColor; opacity:.9; }
.lg-banner .lg-close { color:inherit; opacity:.8; top:50%; transform:translateY(-50%); }
.lg-hs-icon { position:fixed; width:20px; height:20px; margin:-10px 0 0 -10px; border:0; padding:0; border-radius:50%; cursor:pointer; pointer-events:auto;
  background:var(--lg-primary); color:#fff; font:700 12px/20px var(--lg-font); text-align:center; box-shadow:0 2px 6px rgba(20,21,43,.25); }
.lg-hs-icon:focus-visible, .lg-beacon:focus-visible { outline:2px solid var(--lg-primary); outline-offset:2px; }
.lg-audio { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:calc(var(--lg-radius) * .6); background:rgba(0,0,0,.04); }
.lg-audio-btn { flex:none; width:32px; height:32px; border:0; border-radius:50%; background:var(--lg-grad); color:#fff; cursor:pointer;
  display:flex; align-items:center; justify-content:center; box-shadow:var(--lg-glow); }
.lg-audio-main { flex:1; min-width:0; }
.lg-audio-label { font-size:12px; font-weight:600; margin-bottom:5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lg-audio-bar { height:6px; border-radius:3px; background:rgba(0,0,0,.1); cursor:pointer; overflow:hidden; }
.lg-audio-bar span { display:block; width:0; height:100%; background:var(--lg-primary); }
.lg-audio-time { flex:none; font-size:12px; opacity:.6; font-variant-numeric:tabular-nums; }
.lg-inline { position:relative; margin:8px 0; padding:18px 18px 6px; --lg-pad:18px; background:var(--lg-bg); border-radius:var(--lg-radius);
  box-shadow:0 1px 3px rgba(20,21,43,.08), 0 0 0 1px rgba(20,21,43,.07); animation:lg-in .18s ease-out; overflow:hidden; }
.lg-inline h3.lg-b { margin:0 0 6px; font-size:16px; font-weight:750; line-height:1.3; }
.lg-inline h3.lg-first { margin-right:26px; }
.lg-inline .lg-img.lg-edge.lg-first { margin-top:-18px; border-radius:var(--lg-radius) var(--lg-radius) 0 0; }
.lg-skip { margin-right:auto; }
.lg-beacon { position:fixed; width:22px; height:22px; margin:-11px 0 0 -11px; border:0; padding:0; border-radius:50%; cursor:pointer;
  background:transparent; pointer-events:auto; }
.lg-beacon::before, .lg-beacon::after { content:""; position:absolute; inset:5px; border-radius:50%; background:var(--lg-primary); }
.lg-beacon::after { inset:0; opacity:.5; animation:lg-pulse 1.6s ease-out infinite; }
.lg-launcher { position:fixed; bottom:20px; display:flex; align-items:center; gap:10px; border:0; cursor:pointer; pointer-events:auto;
  background:var(--lg-grad); color:#fff; padding:10px 16px 10px 12px; border-radius:999px; font:inherit; font-weight:650;
  box-shadow:var(--lg-glow), 0 8px 24px rgba(20,21,43,.18); }
.lg-launcher .lg-badge { background:rgba(255,255,255,.25); border-radius:999px; padding:1px 8px; font-size:12px; }
.lg-panel { position:fixed; bottom:76px; width:min(360px, calc(100vw - 24px)); max-height:min(560px, calc(100vh - 100px)); overflow:auto;
  background:var(--lg-bg); border-radius:var(--lg-radius); box-shadow:var(--lg-float); pointer-events:auto; animation:lg-in .18s ease-out; }
.lg-panel header { padding:18px 18px 12px; position:relative; }
.lg-panel header h3 { margin:0 26px 4px 0; font-size:16px; }
.lg-panel header p { margin:0; opacity:.7; font-size:13px; }
.lg-progress { height:6px; background:rgba(0,0,0,.08); border-radius:3px; margin-top:12px; overflow:hidden; }
.lg-progress span { display:block; height:100%; background:var(--lg-grad); border-radius:3px; transition:width .3s; }
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
.lg-survey.lg-corner { bottom:20px; width:min(380px, calc(100vw - 24px)); }
.lg-survey h3.lg-q { margin:0 26px 6px 0; font-size:16px; font-weight:650; line-height:1.35; }
.lg-survey .lg-q-desc { opacity:.75; font-size:13px; margin-bottom:12px; }
.lg-survey h3.lg-q + .lg-scale, .lg-survey h3.lg-q + .lg-options, .lg-survey h3.lg-q + .lg-input { margin-top:12px; }
.lg-scale { display:flex; gap:6px; margin-bottom:6px; }
.lg-scale-btn { flex:1; min-width:0; height:36px; border:1px solid rgba(0,0,0,.15); border-radius:calc(var(--lg-radius) * .6);
  background:transparent; color:inherit; font:inherit; font-weight:600; cursor:pointer; padding:0; }
.lg-nps { gap:4px; }
.lg-nps .lg-scale-btn { height:32px; font-size:13px; }
.lg-scale-btn:hover { border-color:var(--lg-primary); color:var(--lg-primary); }
.lg-scale-btn[aria-checked="true"] { background:var(--lg-grad); border-color:var(--lg-primary); color:#fff; }
.lg-scale-labels { display:flex; justify-content:space-between; gap:12px; font-size:12px; opacity:.65; margin-bottom:12px; }
.lg-options { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
.lg-option { display:flex; align-items:center; gap:10px; text-align:left; border:1px solid rgba(0,0,0,.15);
  border-radius:calc(var(--lg-radius) * .6); background:transparent; color:inherit; font:inherit; padding:9px 12px; cursor:pointer; }
.lg-option:hover { border-color:var(--lg-primary); }
.lg-option[aria-checked="true"] { border-color:var(--lg-primary); box-shadow:inset 0 0 0 1px var(--lg-primary); }
.lg-mark { flex:none; width:16px; height:16px; border:2px solid rgba(0,0,0,.3); border-radius:4px; }
.lg-mark.lg-round { border-radius:50%; }
.lg-option[aria-checked="true"] .lg-mark { border-color:var(--lg-primary); background:var(--lg-primary); box-shadow:inset 0 0 0 2px var(--lg-bg); }
.lg-input { display:block; width:100%; resize:vertical; min-height:72px; margin-bottom:12px; padding:8px 10px; font:inherit; color:inherit;
  background:transparent; border:1px solid rgba(0,0,0,.2); border-radius:calc(var(--lg-radius) * .6); }
.lg-input:focus { outline:2px solid var(--lg-primary); outline-offset:-1px; border-color:transparent; }
.lg-btn:disabled { opacity:.45; cursor:not-allowed; filter:none; }
.lg-thanks { text-align:center; padding:8px 0 4px; }
.lg-thanks h3 { margin:0 0 4px; font-size:16px; }
.lg-thanks p { margin:0; opacity:.75; }
.lg-thanks-mark { width:40px; height:40px; margin:0 auto 10px; border-radius:50%; background:var(--lg-grad); color:#fff;
  display:flex; align-items:center; justify-content:center; font-size:20px; }
.lg-rc-launcher { padding:10px 16px 10px 12px; gap:8px; }
.lg-rc-launcher.lg-round { width:52px; height:52px; padding:0; justify-content:center; }
.lg-rc-launcher.lg-round .lg-badge { position:absolute; top:-4px; right:-4px; background:#ef4444; color:#fff; padding:1px 6px; }
/* Resource center positions. The panel sits next to the launcher, or in the corner when there's none. */
.lg-rc-launcher.lg-pos-bottom-right, .lg-rc.lg-pos-bottom-right, .lg-rc-launcher.lg-pos-top-right, .lg-rc.lg-pos-top-right { right:20px; }
.lg-rc-launcher.lg-pos-bottom-left, .lg-rc.lg-pos-bottom-left, .lg-rc-launcher.lg-pos-top-left, .lg-rc.lg-pos-top-left { left:20px; }
.lg-rc-launcher.lg-pos-top-right, .lg-rc-launcher.lg-pos-top-left { top:20px; bottom:auto; }
.lg-rc.lg-pos-top-right, .lg-rc.lg-pos-top-left { top:76px; bottom:auto; }
.lg-rc.lg-nolauncher.lg-pos-bottom-right, .lg-rc.lg-nolauncher.lg-pos-bottom-left { bottom:20px; }
.lg-rc.lg-nolauncher.lg-pos-top-right, .lg-rc.lg-nolauncher.lg-pos-top-left { top:20px; }
.lg-rc-launcher.lg-pos-center-right, .lg-rc-launcher.lg-pos-center-left { top:50%; bottom:auto; translate:0 -50%; writing-mode:vertical-rl;
  padding:14px 10px; gap:8px; }
.lg-rc-launcher.lg-pos-center-right { right:0; border-radius:var(--lg-radius) 0 0 var(--lg-radius); }
/* Rotated so the text reads bottom to top; corners are given pre-rotation. */
.lg-rc-launcher.lg-pos-center-left { left:0; border-radius:var(--lg-radius) 0 0 var(--lg-radius); rotate:180deg; }
.lg-rc-launcher.lg-pos-center-right.lg-round, .lg-rc-launcher.lg-pos-center-left.lg-round { width:44px; height:52px; padding:0; }
.lg-rc-launcher.lg-pos-center-left svg { rotate:180deg; }
.lg-rc-launcher.lg-pos-center-right .lg-badge, .lg-rc-launcher.lg-pos-center-left .lg-badge { padding:6px 1px; text-combine-upright:all; }
.lg-rc.lg-pos-center-right, .lg-rc.lg-pos-center-left { top:50%; bottom:auto; translate:0 -50%; width:min(380px, calc(100vw - 80px));
  max-height:min(620px, calc(100vh - 40px)); }
.lg-rc.lg-pos-center-right { right:60px; }
.lg-rc.lg-pos-center-left { left:60px; }
.lg-rc.lg-nolauncher.lg-pos-center-right { right:20px; }
.lg-rc.lg-nolauncher.lg-pos-center-left { left:20px; }
.lg-rc { display:flex; flex-direction:column; width:min(380px, calc(100vw - 24px)); max-height:min(620px, calc(100vh - 100px)); overflow:hidden; }
.lg-rc-head { background:var(--lg-grad); color:#fff; padding:18px 18px 16px; }
.lg-panel .lg-rc-head h3 { margin:0 26px 4px 0; font-size:17px; }
.lg-panel .lg-rc-head p { opacity:.85; }
.lg-rc-head .lg-close { color:#fff; opacity:.8; }
.lg-rc-head .lg-close:hover { background:rgba(255,255,255,.15); }
.lg-rc-search { display:block; width:100%; margin-top:12px; padding:8px 12px; border:0; border-radius:calc(var(--lg-radius) * .7);
  font:inherit; color:var(--lg-text); background:var(--lg-bg); }
.lg-rc-search:focus { outline:2px solid rgba(255,255,255,.7); outline-offset:1px; }
.lg-rc-body { overflow:auto; padding:6px 0 10px; }
.lg-rc-sec { padding:8px 10px 4px; }
.lg-rc-sec + .lg-rc-sec { border-top:1px solid rgba(0,0,0,.06); }
.lg-rc-sec h4 { margin:4px 8px 6px; font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; opacity:.55; }
.lg-rc-sec > .lg-btn { margin:0 8px 8px; }
.lg-rc-list { list-style:none; margin:0; padding:0; }
.lg-rc-row { display:flex; gap:12px; align-items:flex-start; padding:9px 8px; border-radius:8px; cursor:pointer; }
.lg-rc-row:hover, .lg-rc-row:focus-visible, .lg-rc .lg-item:focus-visible { background:rgba(0,0,0,.04); outline:none; }
.lg-rc-icon { flex:none; width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center;
  color:var(--lg-primary); background:color-mix(in srgb, var(--lg-primary) 12%, transparent); font-size:13px; font-weight:700; }
.lg-rc-row.lg-done .lg-rc-icon { background:var(--lg-primary); color:#fff; }
.lg-rc-text { display:flex; flex-direction:column; min-width:0; padding-top:3px; }
.lg-rc-note { margin:0 8px 10px; opacity:.75; font-size:13px; }
.lg-rc-empty { margin:16px 18px 8px; opacity:.7; }
.lg-rc-progress { display:flex; align-items:center; gap:10px; margin:0 8px 4px; font-size:12px; opacity:.8; }
.lg-rc-progress .lg-progress { flex:1; margin:0; }
.lg-rc-checklist { padding:0; }
.lg-rc-article { padding:6px 18px 8px; --lg-pad:18px; }
.lg-rc-article .lg-rc-back { margin:0 0 10px; padding:0; }
.lg-rc-article h3.lg-b { margin:0 0 10px; font-size:17px; font-weight:650; line-height:1.3; }
.lg-rc-article .lg-img.lg-edge { border-radius:0; }
.lg-rc-meta { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-bottom:3px; font-size:11px; opacity:.85; }
.lg-rc-meta > span:last-child { opacity:.7; }
.lg-label { display:inline-block; padding:1px 8px; border-radius:999px; font-size:11px; font-weight:700; line-height:1.5; }
.lg-new { display:inline-block; padding:1px 8px; border-radius:999px; font-size:11px; font-weight:700; line-height:1.5; color:#fff; background:var(--lg-grad, var(--lg-primary)); }
.lg-rc-all { display:inline-block; margin:2px 8px 8px; font-size:13px; font-weight:600; color:var(--lg-primary); opacity:1; text-decoration:none; }
.lg-rc-all:hover { text-decoration:underline; }
.lg-rc-cover { display:block; width:calc(100% + 36px); margin:0 -18px 12px; aspect-ratio:2/1; object-fit:cover; }
.lg-rc-post .lg-rc-meta { margin-bottom:6px; }
.lg-react { margin-top:16px; padding-top:12px; border-top:1px solid rgba(0,0,0,.08); text-align:center; }
.lg-react p { margin:0 0 8px; font-size:13px; font-weight:600; opacity:.75; }
.lg-react-row { display:flex; justify-content:center; gap:8px; }
.lg-react-btn { width:40px; height:40px; border:0; border-radius:999px; font-size:20px; line-height:1; cursor:pointer;
  background:rgba(0,0,0,.04); box-shadow:inset 0 0 0 1px rgba(0,0,0,.08); transition:transform .12s; }
.lg-react-btn:hover { transform:scale(1.12); }
.lg-react-btn.lg-on { background:color-mix(in srgb, var(--lg-primary) 14%, transparent); box-shadow:inset 0 0 0 2px var(--lg-primary); }
.lg-react-btn.lg-dim { opacity:.4; filter:grayscale(1); }
.lg-react-btn.lg-dim:hover { opacity:1; filter:none; }
.lg-react-comment { display:block; box-sizing:border-box; width:100%; margin:12px 0 8px; padding:8px 10px; border:0; resize:vertical; font:inherit; font-size:13px;
  color:inherit; background:rgba(0,0,0,.04); border-radius:calc(var(--lg-radius) * .7); box-shadow:inset 0 0 0 1px rgba(0,0,0,.1); }
.lg-react-comment:focus { outline:2px solid var(--lg-primary); outline-offset:0; }
@keyframes lg-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
@keyframes lg-down { from { transform:translateY(-100%); } to { transform:none; } }
@keyframes lg-up { from { transform:translateY(100%); } to { transform:none; } }
@keyframes lg-pulse { from { transform:scale(.6); opacity:.6; } to { transform:scale(1.8); opacity:0; } }
@media (prefers-reduced-motion: reduce) { * { animation:none !important; transition:none !important; } }
`;
