// Builds a CSS selector for an element the author picked in builder mode.
// Prefers attributes that survive redeploys (id, data-onboarding, data-testid…)
// over positional paths.

const STABLE_ATTRS = ["data-onboarding", "data-guide", "data-testid", "data-test", "data-cy", "aria-label", "name", "title"];

function looksGenerated(token: string) {
  return (
    token.length > 40 ||
    /\d{3,}/.test(token) ||
    /^(ng-|_ng|css-|sc-|jsx-|svelte-|cdk-|mat-mdc-|is-|has-)/.test(token) ||
    /[A-Za-z]+_[A-Za-z0-9]{5,}$/.test(token) // CSS-modules hashes like Button_x8f2a
  );
}

function unique(sel: string) {
  try {
    return document.querySelectorAll(sel).length === 1;
  } catch {
    return false;
  }
}

function attrSelector(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  if (el.id && !looksGenerated(el.id)) {
    const s = `#${CSS.escape(el.id)}`;
    if (unique(s)) return s;
  }
  for (const a of STABLE_ATTRS) {
    const v = el.getAttribute(a);
    if (v && v.length < 80) {
      const s = `${tag}[${a}="${CSS.escape(v)}"]`;
      if (unique(s)) return s;
    }
  }
  return null;
}

function segment(el: Element): string {
  let part = el.tagName.toLowerCase();
  const classes = [...el.classList].filter((c) => !looksGenerated(c)).slice(0, 2);
  if (classes.length) part += classes.map((c) => "." + CSS.escape(c)).join("");
  const parent = el.parentElement;
  if (parent) {
    const same = [...parent.children].filter((c) => c.tagName === el.tagName);
    if (same.length > 1) part += `:nth-of-type(${same.indexOf(el) + 1})`;
  }
  return part;
}

export function selectorFor(target: Element): string {
  const direct = attrSelector(target);
  if (direct) return direct;

  const parts: string[] = [];
  let cur: Element | null = target;
  while (cur && cur !== document.documentElement) {
    const anchor = cur !== target ? attrSelector(cur) : null;
    if (anchor) {
      parts.unshift(anchor);
      const s = parts.join(" > ");
      if (unique(s)) return s;
      parts[0] = segment(cur);
    } else {
      parts.unshift(segment(cur));
    }
    const s = parts.join(" > ");
    if (unique(s)) return s;
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}
