import { selectorFor } from "./selector";
import { isOwnElement } from "./ui";

// A description of the current page for AI drafting: an outline of headings,
// the visible text, and the visible interactive elements with their labels,
// section, state and position. Never reads what users typed into fields.

const INTERACTIVE = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  "[role=button]",
  "[role=link]",
  "[role=tab]",
  "[role=menuitem]",
  "[role=switch]",
  "[role=checkbox]",
  "[role=radio]",
  "[role=combobox]",
  "[role=searchbox]",
  "[role=option]",
  "[data-onboarding]",
  "[data-guide]",
].join(",");

const REGIONS =
  "header,nav,aside,footer,main,dialog,form,[role=banner],[role=navigation],[role=complementary],[role=main],[role=dialog],[role=tablist],[role=toolbar],[role=menu],[role=search]";
const SEMANTIC_HEADINGS = "h1,h2,h3,h4,h5,h6,[role=heading],legend,caption";
const MAX_ELEMENTS = 160;
const MAX_TEXT = 2500;

function clean(s: string | null | undefined, max = 120) {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : undefined;
}

function isVisible(el: Element, r = el.getBoundingClientRect()) {
  if (r.width < 4 || r.height < 4) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
}

function skip(el: Element) {
  return isOwnElement(el) || Boolean(el.closest("user-onboarder"));
}

// ---------- Headings ----------

type Heading = { el: Element; text: string; level: number };

// Real headings plus "visual" ones: short, bold, standalone text that many apps
// (Angular/React dashboards) use instead of <h2>.
function collectHeadings(): Heading[] {
  const found = new Map<Element, Heading>();
  for (const h of document.querySelectorAll(SEMANTIC_HEADINGS)) {
    if (skip(h) || !isVisible(h)) continue;
    const text = clean(h.textContent, 120);
    if (!text) continue;
    const m = h.tagName.match(/^H(\d)$/);
    found.set(h, { el: h, text, level: m ? Number(m[1]) : Number(h.getAttribute("aria-level")) || 3 });
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let n = 0;
  for (let node = walker.nextNode(); node && n < 4000; node = walker.nextNode(), n++) {
    const el = node as HTMLElement;
    if (found.has(el) || skip(el) || el.closest(INTERACTIVE) || el.querySelector(INTERACTIVE)) continue;
    const own = [...el.childNodes].filter((c) => c.nodeType === Node.TEXT_NODE).map((c) => c.textContent ?? "").join("");
    const text = clean(own, 80);
    if (!text || text.length < 3 || el.children.length > 2) continue;
    const cs = getComputedStyle(el);
    const weight = Number(cs.fontWeight) || (cs.fontWeight === "bold" ? 700 : 400);
    const size = parseFloat(cs.fontSize);
    if (weight < 600 || size < 13 || cs.display.startsWith("inline")) continue;
    if (!isVisible(el)) continue;
    found.set(el, { el, text, level: size >= 22 ? 1 : size >= 18 ? 2 : size >= 15 ? 3 : 4 });
  }
  return [...found.values()].sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}

// Nearest heading before the element that sits in one of its ancestors.
function sectionOf(el: Element, headings: Heading[]) {
  let best: Heading | undefined;
  for (const h of headings) {
    if (!(h.el.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
    best = h;
  }
  if (!best) return undefined;
  // Only if they share a small container (a card or section), not the page layout.
  let p: Element | null = best.el.parentElement;
  for (let i = 0; p && p !== document.body && i < 8; i++, p = p.parentElement) {
    if (p.contains(el)) return p.querySelectorAll(INTERACTIVE).length <= 25 ? best.text : undefined;
  }
  return undefined;
}

// ---------- Labels and state ----------

function labelOf(el: Element) {
  const byIds = el
    .getAttribute("aria-labelledby")
    ?.split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
  const forLabel = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : null;
  // <label>Name <input></label>: the label's own text, without any fields or options inside it.
  const wrap = el.closest("label");
  let wrapText: string | null = null;
  if (wrap && wrap !== el) {
    const copy = wrap.cloneNode(true) as Element;
    copy.querySelectorAll("input,select,textarea,option,button").forEach((x) => x.remove());
    // First text piece only: the label, not the help text under it.
    const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (t.textContent?.trim()) {
        wrapText = t.textContent;
        break;
      }
    }
  }
  // Common pattern: <div><span>Label</span><input></div>
  const prev = el.previousElementSibling;
  const prevText = prev && !prev.matches(INTERACTIVE) && (prev.textContent?.length ?? 0) < 60 ? prev.textContent : null;
  const tooltip =
    el.getAttribute("mattooltip") ||
    el.getAttribute("ng-reflect-message") ||
    el.getAttribute("data-tooltip") ||
    el.getAttribute("data-tip") ||
    el.getAttribute("data-original-title");
  return clean(
    el.getAttribute("aria-label") ||
      byIds ||
      forLabel ||
      wrapText ||
      el.getAttribute("title") ||
      tooltip ||
      (el as HTMLImageElement).alt ||
      (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" ? prevText : null),
  );
}

function describedBy(el: Element) {
  return clean(
    el
      .getAttribute("aria-describedby")
      ?.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" "),
    160,
  );
}

function regionOf(el: Element) {
  const r = el.closest(REGIONS);
  if (!r) return undefined;
  const name = r.getAttribute("aria-label") || r.getAttribute("role") || r.tagName.toLowerCase();
  return clean(name, 40);
}

function isCurrent(el: Element) {
  if (el.getAttribute("aria-current") && el.getAttribute("aria-current") !== "false") return true;
  if (el.getAttribute("aria-selected") === "true") return true;
  if (/(^|\s)(active|selected|current)(\s|$)/.test((el as HTMLElement).className?.toString?.() ?? "")) return true;
  const href = el.getAttribute("href");
  if (href && !href.startsWith("#")) {
    try {
      const u = new URL(href, location.href);
      return u.origin === location.origin && u.pathname.replace(/\/$/, "") === location.pathname.replace(/\/$/, "");
    } catch {
      return false;
    }
  }
  return false;
}

// Filled, saturated background = a primary call to action.
function isProminent(el: Element) {
  const cs = getComputedStyle(el);
  const m = cs.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
  if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return false;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min > 60 && max > 80;
}

// Repeated data rows (table rows, list items, cards in a grid) that contain the
// element. A plain run of links or buttons (a menu, a toolbar) is not a row.
function rowOf(el: Element): { row: Element; count: number } | null {
  if (el.closest("nav,header,[role=navigation],[role=menu],[role=menubar],[role=tablist],[role=toolbar]")) return null;
  let p: Element | null = el.parentElement;
  for (let depth = 0; p && p.parentElement && p !== document.body && depth < 6; depth++, p = p.parentElement) {
    const parent = p.parentElement;
    if (parent.children.length < 3) continue;
    const sig = (x: Element) => `${x.tagName}.${[...x.classList].sort().join(".")}`;
    const mine = sig(p);
    const same = [...parent.children].filter((c) => sig(c) === mine).length;
    if (same >= 3) return { row: p, count: same };
  }
  return null;
}

// ---------- Snapshot ----------

export type SnapshotElement = ReturnType<typeof describe>;
export type PageSnapshot = ReturnType<typeof takeSnapshot>;

export function takeSnapshot() {
  const headings = collectHeadings();
  const seenSelectors = new Set<string>();
  const candidates: SnapshotElement[] = [];

  for (const el of document.querySelectorAll(INTERACTIVE)) {
    if (skip(el)) continue;
    const r = el.getBoundingClientRect();
    if (!isVisible(el, r)) continue;

    // Keep only the first item of repeated rows; say how many there are.
    const rep = rowOf(el);
    let repeated: number | undefined;
    if (rep) {
      const firstIndex = [...rep.row.parentElement!.children].find((c) => c.tagName === rep.row.tagName && c.className === (rep.row as HTMLElement).className);
      if (firstIndex && firstIndex !== rep.row) continue;
      repeated = rep.count;
    }

    const d = describe(el, r, headings, repeated);
    if (!d.text && !d.label && !d.placeholder && !d.onboarding) continue;
    if (seenSelectors.has(d.selector)) continue;
    seenSelectors.add(d.selector);
    candidates.push(d);
  }

  let picked = candidates;
  if (candidates.length > MAX_ELEMENTS) {
    const score = (c: SnapshotElement) =>
      (c.onboarding ? 4 : 0) + (c.prominent ? 3 : 0) + (c.inView ? 2 : 0) + (c.region === "nav" || c.region === "navigation" ? 1 : 0);
    picked = [...candidates]
      .map((c, i) => ({ c, i, s: score(c) }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .slice(0, MAX_ELEMENTS)
      .sort((a, b) => a.i - b.i)
      .map((x) => x.c);
  }

  const main = document.querySelector("main,[role=main]") ?? document.body;
  return {
    url: location.href.slice(0, 2000),
    path: location.pathname.slice(0, 300),
    title: clean(document.title, 300) ?? "",
    lang: clean(document.documentElement.lang || navigator.language, 20) ?? "",
    description: clean(document.querySelector('meta[name="description"]')?.getAttribute("content"), 500) ?? "",
    viewport: { w: innerWidth, h: innerHeight },
    headings: headings.slice(0, 60).map((h) => ({ level: h.level, text: h.text })),
    // What the page says, so the model knows what it's about.
    text: clean((main as HTMLElement).innerText, MAX_TEXT) ?? "",
    elements: picked.map((c, i) => ({ ...c, id: i })),
  };
}

function describe(el: Element, r: DOMRect, headings: Heading[], repeated: number | undefined) {
  const tag = el.tagName.toLowerCase();
  const input = el as HTMLInputElement;
  const isField = tag === "input" || tag === "textarea" || tag === "select";
  const href = tag === "a" ? el.getAttribute("href") : null;
  const text = isField ? undefined : clean((el as HTMLElement).innerText ?? el.textContent);
  return {
    id: 0,
    tag,
    role: clean(el.getAttribute("role"), 40),
    type: isField ? clean(input.type, 30) : undefined,
    // For fields, never the value: only what describes the field.
    text,
    label: labelOf(el),
    hint: describedBy(el),
    placeholder: isField ? clean(input.placeholder) : undefined,
    href: href && !href.startsWith("javascript:") ? clean(href.split("?")[0], 300) : undefined,
    region: regionOf(el),
    section: sectionOf(el, headings),
    onboarding: clean(el.getAttribute("data-onboarding") || el.getAttribute("data-guide"), 100),
    current: isCurrent(el) || undefined,
    disabled: (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true" || undefined,
    prominent: (!isField && isProminent(el)) || undefined,
    repeated,
    inView: r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth,
    selector: selectorFor(el),
    rect: {
      x: Math.round(r.left + scrollX),
      y: Math.round(r.top + scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
    },
  };
}
