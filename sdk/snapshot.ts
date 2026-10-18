import { selectorFor } from "./selector";
import { isOwnElement } from "./ui";

// A compact description of the current page for AI drafting: headings plus the
// visible interactive elements with their labels and positions. Never reads
// what users typed into fields.

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
  "[role=combobox]",
  "[role=searchbox]",
  "[data-onboarding]",
  "[data-guide]",
].join(",");

const REGIONS = "header,nav,aside,footer,main,dialog,[role=banner],[role=navigation],[role=complementary],[role=main],[role=dialog],[role=tablist],[role=toolbar],[role=menu]";
const MAX_ELEMENTS = 200;

function clean(s: string | null | undefined, max = 120) {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : undefined;
}

function visible(el: Element, r: DOMRect) {
  if (r.width < 4 || r.height < 4) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
}

function labelOf(el: Element) {
  const labelledBy = el.getAttribute("aria-labelledby");
  const fromIds = labelledBy
    ?.split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
  const forLabel = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : null;
  return clean(el.getAttribute("aria-label") || fromIds || forLabel || el.getAttribute("title") || (el as HTMLImageElement).alt);
}

function regionOf(el: Element) {
  const r = el.closest(REGIONS);
  return r ? clean(r.getAttribute("role") || r.tagName.toLowerCase(), 30) : undefined;
}

export type PageSnapshot = ReturnType<typeof takeSnapshot>;

export function takeSnapshot() {
  const headings = [...document.querySelectorAll("h1,h2,h3,[role=heading]")]
    .filter((h) => !isOwnElement(h) && visible(h, h.getBoundingClientRect()))
    .map((h) => clean(h.textContent, 200))
    .filter((t): t is string => Boolean(t))
    .slice(0, 40);

  const seen = new Set<string>();
  const candidates: Omit<ReturnType<typeof describe>, "id">[] = [];

  for (const el of document.querySelectorAll(INTERACTIVE)) {
    if (isOwnElement(el) || el.closest("locatify-guides")) continue;
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) continue;
    const d = describe(el, r, 0);
    // Skip elements that give the model nothing to go on.
    if (!d.text && !d.label && !d.placeholder && !d.onboarding) continue;
    if (seen.has(d.selector)) continue;
    seen.add(d.selector);
    candidates.push(d);
  }

  // Too many: keep tagged elements and page chrome first, then document order.
  let picked = candidates;
  if (candidates.length > MAX_ELEMENTS) {
    const important = (c: (typeof candidates)[number]) =>
      Boolean(c.onboarding) || c.region === "nav" || c.region === "navigation" || c.region === "header" || c.region === "banner";
    const first = candidates.filter(important);
    const rest = candidates.filter((c) => !important(c));
    picked = [...first, ...rest].slice(0, MAX_ELEMENTS);
  }

  return {
    url: location.href.slice(0, 2000),
    title: clean(document.title, 300) ?? "",
    lang: clean(document.documentElement.lang || navigator.language, 20) ?? "",
    description: clean(document.querySelector('meta[name="description"]')?.getAttribute("content"), 500) ?? "",
    headings,
    elements: picked.map((c, i) => ({ ...c, id: i })),
  };
}

function describe(el: Element, r: DOMRect, id: number) {
  const tag = el.tagName.toLowerCase();
  const input = el as HTMLInputElement;
  const isField = tag === "input" || tag === "textarea" || tag === "select";
  const href = tag === "a" ? (el as HTMLAnchorElement).getAttribute("href") : null;
  return {
    id,
    tag,
    role: clean(el.getAttribute("role"), 40),
    type: isField ? clean(input.type, 30) : undefined,
    // For fields, never the value: only what describes the field.
    text: isField ? undefined : clean((el as HTMLElement).innerText ?? el.textContent),
    label: labelOf(el),
    placeholder: isField ? clean(input.placeholder) : undefined,
    href: href && !href.startsWith("javascript:") ? clean(href.split("?")[0], 300) : undefined,
    region: regionOf(el),
    onboarding: clean(el.getAttribute("data-onboarding") || el.getAttribute("data-guide"), 100),
    selector: selectorFor(el),
    rect: {
      x: Math.round(r.left + scrollX),
      y: Math.round(r.top + scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
    },
  };
}
