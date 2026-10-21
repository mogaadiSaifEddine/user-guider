import type { Advance, Block, Hotspot, HotspotContent, InlineContent, Theme, TourContent, TourStep } from "../src/lib/guide-schema";
import { plainText } from "../src/lib/format";
import { mountRichEditor, type RichEditor } from "../src/lib/rich-editor";
import { selectorFor } from "./selector";
import { takeSnapshot, type PageSnapshot } from "./snapshot";
import { applyTheme, el, escapeHtml, findTarget, isOwnElement, shadow } from "./ui";
import { runHotspots, runInline, runTour } from "./widgets";

// Builder mode: opened from the dashboard with ?lg_builder=<token>. Lets the
// author pick elements on the real page and edit step text, then saves the
// draft back through /api/builder/guide.

export const BUILDER_PARAM = "lg_builder";
const STORAGE_KEY = "lg_builder_token";

type BuilderGuide = {
  id: string;
  name: string;
  type: "TOUR" | "HOTSPOT" | "INLINE" | "CHECKLIST" | "ANNOUNCEMENT";
  content: TourContent | HotspotContent | InlineContent;
  theme: Theme;
  ai: { enabled: boolean; autoGoal: string | null };
};

// A tour step, a hotspot, or the one inline card.
type Item = TourStep | Hotspot | InlineContent;

// Everything is made of blocks; the builder edits the first heading and text
// block as "Title" and "Text". Images, video and buttons are edited in the dashboard.
function isStep(it: Item): it is TourStep {
  return "advanceOn" in it;
}

function firstOf(it: Item, type: "heading" | "text") {
  return it.blocks.find((b) => b.type === type) as Extract<Block, { type: "heading" | "text" }> | undefined;
}

function titleOf(it: Item) {
  return firstOf(it, "heading")?.text ?? "";
}

function bodyOf(it: Item) {
  return firstOf(it, "text")?.text ?? "";
}

function setText(it: Item, field: "title" | "body", value: string) {
  const type = field === "title" ? "heading" : "text";
  const existing = firstOf(it, type);
  if (existing) {
    existing.text = value;
    return;
  }
  // Insert after leading images; text goes after the heading.
  let at = it.blocks.findIndex((b) => b.type !== "image");
  if (at < 0) at = it.blocks.length;
  if (type === "text") {
    const h = it.blocks.findIndex((b) => b.type === "heading");
    if (h >= 0) at = h + 1;
  }
  it.blocks.splice(at, 0, { type, id: rid(), text: value, align: "left" });
}

function newStep(selector: string, title: string, body: string): TourStep {
  return {
    id: rid(),
    blocks: [
      { type: "heading", id: rid(), text: title, align: "left" },
      { type: "text", id: rid(), text: body, align: "left" },
    ],
    footer: { show: true, showProgress: true, showBack: true, nextLabel: "Next", backLabel: "Back", doneLabel: "Done" },
    size: "md",
    selector,
    placement: "auto",
    advanceOn: { type: "next" },
    skipIf: { when: "never", selector: "" },
    optional: false,
    backdrop: true,
  };
}

function newHotspot(selector: string, title: string, body: string): Hotspot {
  return {
    id: rid(),
    selector,
    blocks: [
      { type: "heading", id: rid(), text: title, align: "left" },
      { type: "text", id: rid(), text: body, align: "left" },
    ],
    size: "sm",
    placement: "auto",
    style: "beacon",
    icon: "help",
    persistent: false,
    openOn: "click",
    offset: "top-right",
  };
}

// Same defaults as advanceSchema; the SDK doesn't bundle zod.
function newAdvance(type: string): Advance {
  switch (type) {
    case "click":
    case "media_end":
      return { type };
    case "input":
      return { type, minLength: 1, format: "any", pattern: "" };
    case "element":
      return { type, selector: "" };
    case "url":
      return { type, rule: { op: "contains", value: "" } };
    case "event":
      return { type, name: "" };
    default:
      return { type: "next" };
  }
}

const ADVANCE_LABELS: [Advance["type"], string][] = [
  ["next", "Next button"],
  ["click", "Click on element"],
  ["input", "Typing in the field"],
  ["element", "Another element appears"],
  ["url", "Going to a page"],
  ["event", "An event (track)"],
  ["media_end", "The video or audio ends"],
];

const INLINE_POSITIONS: [InlineContent["position"], string][] = [
  ["before", "Above it"],
  ["after", "Below it"],
  ["prepend", "Inside, at the top"],
  ["append", "Inside, at the bottom"],
  ["replace", "Instead of it"],
];

function hasExtraBlocks(it: Item) {
  return it.blocks.some((b) => b.type !== "heading" && b.type !== "text");
}

// Returns the builder token if this page load is a builder session.
export function builderToken(): string | null {
  const url = new URL(location.href);
  const fromUrl = url.searchParams.get(BUILDER_PARAM);
  if (fromUrl) {
    try {
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
    } catch {
      // private mode: the session ends on the next navigation
    }
    url.searchParams.delete(BUILDER_PARAM);
    history.replaceState(history.state, "", url.toString());
    return fromUrl;
  }
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function startBuilder(apiBase: string, token: string) {
  const res = await fetch(apiBase + "/api/builder/guide", { headers: { Authorization: "Bearer " + token } });
  const data = await res.json().catch(() => ({}));
  const root = shadow();
  const style = el("style");
  style.textContent = BUILDER_CSS;
  root.appendChild(style);

  if (!res.ok) {
    const box = el("div", { class: "lg lgb" }, `<div class="lgb-head"><strong>User Onboarder builder</strong></div>
      <p class="lgb-msg">${escapeHtml(data.error ?? "Could not load the guide.")}</p>
      <div class="lgb-actions"><button class="lgb-btn" data-act="exit">Exit builder</button></div>`);
    box.querySelector('[data-act="exit"]')!.addEventListener("click", exit);
    root.appendChild(box);
    return;
  }

  const guide = data as BuilderGuide;
  applyTheme(guide.theme);
  const isTour = guide.type === "TOUR";
  const isInline = guide.type === "INLINE";
  if (!isTour && !isInline && guide.type !== "HOTSPOT") {
    const box = el("div", { class: "lg lgb" }, `<div class="lgb-head"><strong>${escapeHtml(guide.name)}</strong></div>
      <p class="lgb-msg">This guide type has no on-page elements. Edit it in the dashboard.</p>
      <div class="lgb-actions"><button class="lgb-btn" data-act="exit">Exit builder</button></div>`);
    box.querySelector('[data-act="exit"]')!.addEventListener("click", exit);
    root.appendChild(box);
    return;
  }

  const items: Item[] = isTour
    ? (guide.content as TourContent).steps
    : isInline
      ? [guide.content as InlineContent]
      : (guide.content as HotspotContent).hotspots;
  const kindLabel = isTour ? "Tour" : isInline ? "Inline card" : "Hotspots";
  let open = 0;
  let dirty = false;
  let status = "";
  let collapsed = false;
  const ai = { open: false, busy: false, goal: "", count: isTour ? 5 : 4, mode: "replace" as "replace" | "append", error: "" };

  const panel = el("div", { class: "lg lgb" });
  root.appendChild(panel);

  window.addEventListener("beforeunload", (e) => {
    if (dirty) e.preventDefault();
  });

  function markDirty() {
    dirty = true;
    status = "Unsaved changes";
    const s = panel.querySelector(".lgb-status");
    if (s) s.textContent = status;
  }

  // Rich text editors for the open item's Title and Text, re-mounted on every render.
  const editors: RichEditor[] = [];

  function mountEditors() {
    for (const host of panel.querySelectorAll<HTMLElement>("[data-rte]")) {
      const i = Number(host.dataset.i);
      const field = host.dataset.rte as "title" | "body";
      const it = items[i];
      if (!it) continue;
      editors.push(
        mountRichEditor(host, {
          value: field === "title" ? titleOf(it) : bodyOf(it),
          multiline: field === "body",
          rows: 3,
          label: field === "title" ? "Title" : "Text",
          maxLength: field === "title" ? 200 : isTour ? 4000 : 2000,
          onChange(value) {
            setText(it, field, value);
            markDirty();
            if (field === "title") {
              const row = panel.querySelector(".lgb-open .lgb-row-title");
              if (row) row.textContent = plainText(value) || "Untitled";
            }
          },
        }),
      );
    }
  }

  function render() {
    for (const e of editors.splice(0)) e.destroy();
    renderPanel();
    mountEditors();
  }

  function advanceFields(it: TourStep, i: number) {
    const a = it.advanceOn;
    const select = `<label>Advance on<select data-f="advanceOn" data-i="${i}">
      ${ADVANCE_LABELS.map(([v, l]) => `<option value="${v}" ${v === a.type ? "selected" : ""}>${l}</option>`).join("")}
    </select></label>`;
    let extra = "";
    if (a.type === "element") {
      extra = `<div class="lgb-sel">
        <code title="${escapeHtml(a.selector)}">${escapeHtml(a.selector || "No element picked: the step waits for this one to appear")}</code>
        <div class="lgb-row-btns"><button class="lgb-btn" data-act="pick-adv" data-i="${i}">${a.selector ? "Re-pick" : "Pick"} the element to wait for</button></div>
      </div>`;
    } else if (a.type === "url") {
      extra = `<label>URL contains<input data-adv="url" data-i="${i}" value="${escapeHtml(a.rule.value)}" placeholder="/projects/new"></label>`;
    } else if (a.type === "event") {
      extra = `<label>Event name<input data-adv="event" data-i="${i}" value="${escapeHtml(a.name)}" placeholder="project_created"></label>`;
    } else if (a.type === "input") {
      extra = `<label>At least this many characters<input type="number" min="1" max="500" data-adv="minLength" data-i="${i}" value="${a.minLength}"></label>`;
    }
    return { select, extra };
  }

  function itemFields(it: Item, i: number) {
    if (isInline) {
      const c = it as InlineContent;
      return `<div class="lgb-grid">
          <label>Place the card<select data-f="position" data-i="${i}">
            ${INLINE_POSITIONS.map(([v, l]) => `<option value="${v}" ${v === c.position ? "selected" : ""}>${l}</option>`).join("")}
          </select></label>
        </div>
        <label class="lgb-check"><input type="checkbox" data-f="dismissible" data-i="${i}" ${c.dismissible ? "checked" : ""}> People can close it</label>`;
    }
    const position = `<label>Position<select data-f="placement" data-i="${i}">
        ${["auto", "top", "bottom", "left", "right"].map((p) => `<option ${p === (it as TourStep | Hotspot).placement ? "selected" : ""}>${p}</option>`).join("")}
      </select></label>`;
    if (!isStep(it)) {
      return `<div class="lgb-grid">${position}</div>
        <label class="lgb-check"><input type="checkbox" data-f="persistent" data-i="${i}" ${(it as Hotspot).persistent ? "checked" : ""}> Keep it after it's opened</label>`;
    }
    const adv = advanceFields(it, i);
    return `<div class="lgb-grid">${position}${adv.select}</div>${adv.extra}
      <label class="lgb-check"><input type="checkbox" data-f="optional" data-i="${i}" ${it.optional ? "checked" : ""}> Skip this step if its element isn't found</label>
      <label class="lgb-check"><input type="checkbox" data-f="backdrop" data-i="${i}" ${it.backdrop !== false ? "checked" : ""}> Dim the rest of the page</label>`;
  }

  function renderPanel() {
    const noun = isTour ? "Step" : isInline ? "Card" : "Hotspot";
    panel.innerHTML = `
      <div class="lgb-head">
        <div><strong>${escapeHtml(guide.name)}</strong><span class="lgb-type">${kindLabel}</span></div>
        <button class="lgb-icon" data-act="collapse" title="${collapsed ? "Expand" : "Collapse"}">${collapsed ? "▴" : "▾"}</button>
      </div>
      ${
        collapsed
          ? ""
          : `${aiSection()}<div class="lgb-list">
        ${items
          .map((it, i) => {
            const found = it.selector ? Boolean(findTarget(it.selector)) : null;
            const where = !it.selector
              ? isTour
                ? "Centered modal"
                : "No element yet"
              : found
                ? "Element on this page"
                : "Element not on this page";
            return `<div class="lgb-item${i === open ? " lgb-open" : ""}">
              <button class="lgb-row" data-act="toggle" data-i="${i}">
                <span class="lgb-num">${i + 1}</span>
                <span class="lgb-row-title">${escapeHtml(plainText(titleOf(it)) || `Untitled ${noun.toLowerCase()}`)}</span>
                <span class="lgb-dot ${found === null ? "" : found ? "lgb-ok" : "lgb-miss"}" title="${where}"></span>
              </button>
              ${
                i === open
                  ? `<div class="lgb-fields">
                <div class="lgb-label">Title<div data-rte="title" data-i="${i}"></div></div>
                <div class="lgb-label">Text<div data-rte="body" data-i="${i}"></div></div>
                ${hasExtraBlocks(it) ? `<p class="lgb-note">This step also has images, video or buttons. Edit those in the dashboard.</p>` : ""}
                <div class="lgb-sel">
                  <code title="${escapeHtml(it.selector)}">${escapeHtml(it.selector || (isTour ? "No element: shown as a centered modal" : "No element picked"))}</code>
                  <span class="lgb-where">${where}</span>
                  <div class="lgb-row-btns">
                    <button class="lgb-btn" data-act="pick" data-i="${i}">${it.selector ? "Re-pick element" : "Pick element"}</button>
                    ${it.selector && isTour ? `<button class="lgb-btn lgb-ghost" data-act="clear" data-i="${i}">Make modal</button>` : ""}
                  </div>
                </div>
                ${itemFields(it, i)}
                ${
                  isInline
                    ? ""
                    : `<div class="lgb-row-btns">
                  <button class="lgb-btn lgb-ghost" data-act="up" data-i="${i}" ${i === 0 ? "disabled" : ""}>Move up</button>
                  <button class="lgb-btn lgb-ghost" data-act="down" data-i="${i}" ${i === items.length - 1 ? "disabled" : ""}>Move down</button>
                  <button class="lgb-btn lgb-danger" data-act="delete" data-i="${i}">Delete</button>
                </div>`
                }
              </div>`
                  : ""
              }
            </div>`;
          })
          .join("")}
        ${isInline ? "" : `<button class="lgb-add" data-act="add">+ Add ${noun.toLowerCase()}</button>`}
      </div>
      <div class="lgb-actions">
        <span class="lgb-status">${escapeHtml(status)}</span>
        <button class="lgb-btn lgb-ghost" data-act="exit">Exit</button>
        <button class="lgb-btn lgb-ghost" data-act="preview" ${items.length ? "" : "disabled"}>Preview</button>
        <button class="lgb-btn" data-act="save">Save</button>
      </div>`
      }`;
  }

  function aiSection() {
    if (!guide.ai.enabled || isInline) return "";
    const noun = isTour ? "steps" : "hotspots";
    if (!ai.open) {
      return `<div class="lgb-ai-bar"><button class="lgb-btn lgb-ai-btn" data-act="ai-toggle" ${ai.busy ? "disabled" : ""}>✨ Draft ${noun} with AI</button></div>`;
    }
    return `<div class="lgb-ai">
      <div class="lgb-ai-title">✨ Draft ${noun} with AI</div>
      <p class="lgb-ai-hint">AI reads this page's buttons, links, fields and headings (never what's typed in fields) and picks what to highlight.</p>
      <label>Goal (optional)<textarea data-ai="goal" rows="2" placeholder="e.g. Show new users how to create and publish a tour">${escapeHtml(ai.goal)}</textarea></label>
      <div class="lgb-grid">
        <label>How many<select data-ai="count">${[3, 4, 5, 6, 8, 10].map((n) => `<option ${n === ai.count ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        ${
          items.length
            ? `<label>Existing ${noun}<select data-ai="mode">
                <option value="replace" ${ai.mode === "replace" ? "selected" : ""}>Replace them</option>
                <option value="append" ${ai.mode === "append" ? "selected" : ""}>Keep, add more</option>
              </select></label>`
            : ""
        }
      </div>
      ${ai.error ? `<p class="lgb-ai-error">${escapeHtml(ai.error)}</p>` : ""}
      <div class="lgb-row-btns">
        <button class="lgb-btn" data-act="ai-run" ${ai.busy ? "disabled" : ""}>${ai.busy ? "Reading the page…" : "Generate"}</button>
        <button class="lgb-btn lgb-ghost" data-act="ai-toggle" ${ai.busy ? "disabled" : ""}>Close</button>
      </div>
    </div>`;
  }

  async function runAi() {
    ai.busy = true;
    ai.error = "";
    render();
    try {
      const snapshot = takeSnapshot();
      const screenshot = await captureScreenshot(apiBase, snapshot);
      const res = await fetch(apiBase + "/api/builder/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          kind: isTour ? "TOUR" : "HOTSPOT",
          goal: ai.goal,
          maxItems: ai.count,
          existing: ai.mode === "append" ? items.map(titleOf).filter(Boolean) : [],
          snapshot,
          screenshot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "AI drafting failed.");
      const drafted: Item[] = (data.items as { selector: string; title: string; body: string }[]).map((d) =>
        isTour ? newStep(d.selector, d.title, d.body) : newHotspot(d.selector, d.title, d.body),
      );
      const firstNew = ai.mode === "append" ? items.length : 0;
      if (ai.mode === "append") items.push(...drafted);
      else items.splice(0, items.length, ...drafted);
      open = firstNew;
      ai.open = false;
      markDirty();
      status = `AI drafted ${drafted.length}. Review, Preview, then Save.`;
    } catch (e) {
      ai.error = e instanceof Error ? e.message : "AI drafting failed.";
    } finally {
      ai.busy = false;
      render();
    }
  }

  panel.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.ai) {
      if (t.dataset.ai === "goal") ai.goal = t.value;
      if (t.dataset.ai === "count") ai.count = Number(t.value);
      if (t.dataset.ai === "mode") ai.mode = t.value === "append" ? "append" : "replace";
      return;
    }
    const i = Number(t.dataset.i);
    const it = items[i];
    if (!it) return;
    if (t.dataset.adv && isStep(it)) {
      const a = it.advanceOn;
      if (a.type === "url") a.rule = { op: "contains", value: t.value };
      if (a.type === "event") a.name = t.value;
      if (a.type === "input") a.minLength = Math.max(1, Math.min(500, Math.trunc(Number(t.value)) || 1));
      return markDirty();
    }
    const f = t.dataset.f;
    if (!f) return;
    if (f === "advanceOn" && isStep(it)) {
      it.advanceOn = newAdvance(t.value);
      markDirty();
      return render();
    }
    (it as Record<string, unknown>)[f] = t.type === "checkbox" ? t.checked : t.value;
    markDirty();
  });

  panel.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!btn) return;
    const i = Number(btn.dataset.i);
    switch (btn.dataset.act) {
      case "collapse":
        collapsed = !collapsed;
        break;
      case "ai-toggle":
        ai.open = !ai.open;
        ai.error = "";
        break;
      case "ai-run":
        return runAi();
      case "toggle":
        open = open === i ? -1 : i;
        break;
      case "add":
        items.push(isTour ? newStep("", "", "") : newHotspot("", "", ""));
        open = items.length - 1;
        markDirty();
        if (!isTour) return pick(open);
        break;
      case "pick":
        return pick(i);
      case "pick-adv":
        return pick(i, true);
      case "clear":
        items[i].selector = "";
        markDirty();
        break;
      case "up":
      case "down": {
        const j = btn.dataset.act === "up" ? i - 1 : i + 1;
        [items[i], items[j]] = [items[j], items[i]];
        open = j;
        markDirty();
        break;
      }
      case "delete":
        if (!confirm("Delete this " + (isTour ? "step" : "hotspot") + "?")) return;
        items.splice(i, 1);
        open = -1;
        markDirty();
        break;
      case "preview":
        return preview();
      case "save":
        return save();
      case "exit":
        if (dirty && !confirm("You have unsaved changes. Exit anyway?")) return;
        dirty = false;
        return exit();
    }
    render();
  });

  async function save() {
    status = "Saving…";
    render();
    const res = await fetch(apiBase + "/api/builder/guide", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ content: guide.content }),
    }).catch(() => null);
    if (res?.ok) {
      dirty = false;
      status = "Saved. Publish from the dashboard to go live.";
    } else {
      const err = await res?.json().catch(() => null);
      status = err?.error ?? "Save failed";
    }
    render();
  }

  function preview() {
    panel.style.display = "none";
    const restore = () => {
      panel.style.display = "";
      render();
    };
    if (isTour) {
      runTour(guide.content as TourContent, { startAt: Math.max(open, 0), report: () => {}, onEnd: restore });
    } else {
      let ended = () => {};
      const h = isInline
        ? runInline(guide.content as InlineContent, { report: () => {}, onEnd: () => ended() })
        : runHotspots(guide.content as HotspotContent, { opened: new Set(), report: () => {} });
      const bar = el("div", { class: "lg lgb-previewbar" }, `Previewing ${isInline ? "the card" : "hotspots"} <button class="lgb-btn">End preview</button>`);
      // Closing the card from inside ends the preview too.
      ended = () => bar.querySelector("button")!.click();
      bar.querySelector("button")!.addEventListener("click", () => {
        h.stop();
        bar.remove();
        restore();
      });
      root.appendChild(bar);
    }
  }

  // advance: pick the element a step waits for, not the one it points at.
  function pick(i: number, advance = false) {
    panel.style.display = "none";
    const hl = el("div", { class: "lgb-hl" });
    const what = advance
      ? "Click the element the step should wait for (open it first if it's in a menu or dialog)."
      : isInline
        ? "Click the element the card should sit next to."
        : `Click the element this ${isTour ? "step" : "hotspot"} should point at.`;
    const tip = el("div", { class: "lg lgb-pickbar" }, `${what} <kbd>Esc</kbd> to cancel.`);
    root.append(hl, tip);
    let current: Element | null = null;

    const move = (e: MouseEvent) => {
      const t = document.elementFromPoint(e.clientX, e.clientY);
      if (!t || isOwnElement(t)) {
        hl.style.display = "none";
        current = null;
        return;
      }
      current = t;
      const r = t.getBoundingClientRect();
      Object.assign(hl.style, { display: "block", top: r.top + "px", left: r.left + "px", width: r.width + "px", height: r.height + "px" });
    };
    const block = (e: Event) => {
      if (isOwnElement(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    const click = (e: MouseEvent) => {
      if (isOwnElement(e.target)) return;
      block(e);
      if (current) {
        const it = items[i];
        if (advance && isStep(it)) it.advanceOn = { type: "element", selector: selectorFor(current) };
        else it.selector = selectorFor(current);
        markDirty();
      }
      done();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        done();
      }
    };
    const events: [string, EventListener][] = [
      ["mousemove", move as EventListener],
      ["click", click as EventListener],
      ["mousedown", block],
      ["mouseup", block],
      ["pointerdown", block],
      ["pointerup", block],
      ["keydown", key as EventListener],
    ];
    for (const [n, f] of events) document.addEventListener(n, f, true);

    function done() {
      for (const [n, f] of events) document.removeEventListener(n, f, true);
      hl.remove();
      tip.remove();
      panel.style.display = "";
      open = i;
      render();
    }
  }

  render();

  // Opened from the dashboard with "Draft with AI": run once per builder session,
  // after the app has had a moment to render.
  if (guide.ai.autoGoal !== null) {
    const flag = "lg_builder_ai_done:" + token.slice(-24);
    let done = false;
    try {
      done = sessionStorage.getItem(flag) === "1";
      sessionStorage.setItem(flag, "1");
    } catch {
      // ignore
    }
    if (!done) {
      ai.goal = guide.ai.autoGoal;
      ai.mode = "replace";
      ai.open = true;
      setTimeout(runAi, 1500);
    }
  }
}

// The screenshot helper is a separate script, loaded on first use only.
let captureScript: Promise<void> | null = null;

async function captureScreenshot(apiBase: string, snapshot: PageSnapshot): Promise<string | undefined> {
  try {
    captureScript ??= new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = apiBase + "/sdk-capture.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("capture script failed to load"));
      document.head.appendChild(s);
    });
    await captureScript;
    const capture = (window as unknown as { __lgCapture?: (m: unknown[]) => Promise<string | null> }).__lgCapture;
    if (!capture) return undefined;
    const marks = snapshot.elements.filter((e) => e.inView).map((e) => ({ id: e.id, ...e.rect }));
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 8000));
    return (await Promise.race([capture(marks), timeout])) ?? undefined;
  } catch (e) {
    // The AI still works from the element list alone.
    console.warn("[UserOnboarder] screenshot skipped", e);
    return undefined;
  }
}

function exit() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  location.reload();
}

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

const BUILDER_CSS = `
.lgb { position:fixed; left:16px; bottom:16px; width:min(380px, calc(100vw - 32px)); max-height:calc(100vh - 32px); display:flex; flex-direction:column;
  background:#fff; color:#111827; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,.3), 0 0 0 1px rgba(0,0,0,.06); pointer-events:auto;
  font:13px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
.lgb-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px 14px; background:#111827; color:#fff;
  border-radius:12px 12px 0 0; }
.lgb-type { margin-left:8px; font-size:11px; padding:1px 7px; border-radius:999px; background:rgba(255,255,255,.18); }
.lgb-icon { border:0; background:transparent; color:#fff; font-size:14px; cursor:pointer; padding:2px 6px; }
.lgb-msg { padding:14px; margin:0; }
.lgb-list { overflow:auto; padding:8px; flex:1; }
.lgb-item { border:1px solid #e5e7eb; border-radius:8px; margin-bottom:6px; }
.lgb-open { border-color:#7c5cff; }
.lgb-row { display:flex; align-items:center; gap:8px; width:100%; padding:8px 10px; border:0; background:transparent; cursor:pointer; font:inherit; text-align:left; color:inherit; }
.lgb-num { flex:none; width:20px; height:20px; border-radius:50%; background:#eef2ff; color:#4338ca; font-size:11px; font-weight:700;
  display:flex; align-items:center; justify-content:center; }
.lgb-row-title { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; }
.lgb-dot { width:8px; height:8px; border-radius:50%; background:#d1d5db; }
.lgb-dot.lgb-ok { background:#10b981; } .lgb-dot.lgb-miss { background:#f59e0b; }
.lgb-fields { padding:4px 10px 10px; display:flex; flex-direction:column; gap:8px; }
.lgb label, .lgb .lgb-label { display:flex; flex-direction:column; gap:3px; font-weight:600; font-size:12px; color:#374151; }
.lgb .lgb-label .rte { font-size:13px; font-weight:400; }
.lgb input:not([type=checkbox]), .lgb textarea, .lgb select { font:inherit; font-weight:400; border:1px solid #d1d5db; border-radius:6px; padding:6px 8px;
  color:#111827; background:#fff; width:100%; }
.lgb textarea { resize:vertical; }
.lgb label.lgb-check { flex-direction:row; align-items:center; gap:6px; font-weight:500; }
.lgb-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.lgb-sel { background:#f9fafb; border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:6px; }
.lgb-sel code { font:11px/1.4 ui-monospace,Consolas,monospace; word-break:break-all; color:#4b5563; }
.lgb-where { font-size:11px; color:#6b7280; }
.lgb-row-btns { display:flex; gap:6px; flex-wrap:wrap; }
.lgb-btn { border:0; border-radius:6px; padding:6px 11px; font:inherit; font-weight:600; cursor:pointer; background:linear-gradient(135deg,#7c5cff,#5236e0); color:#fff; }
.lgb-btn:disabled { opacity:.4; cursor:default; }
.lgb-btn.lgb-ghost { background:#f3f4f6; color:#111827; }
.lgb-btn.lgb-danger { background:#fef2f2; color:#b91c1c; margin-left:auto; }
.lgb-add { width:100%; border:1px dashed #c7d2fe; background:#f5f7ff; color:#4338ca; border-radius:8px; padding:8px; font:inherit; font-weight:600; cursor:pointer; }
.lgb-actions { display:flex; align-items:center; gap:6px; padding:10px 12px; border-top:1px solid #e5e7eb; }
.lgb-status { margin-right:auto; font-size:11px; color:#6b7280; }
.lgb-hl { position:fixed; display:none; pointer-events:none; border:2px solid #6847f5; background:rgba(104,71,245,.12); border-radius:4px; transition:all .05s; }
.lgb-pickbar, .lgb-previewbar { position:fixed; top:12px; left:50%; transform:translateX(-50%); background:#111827; color:#fff; padding:8px 14px;
  border-radius:999px; font:13px system-ui,sans-serif; pointer-events:none; box-shadow:0 8px 24px rgba(0,0,0,.3); }
.lgb-previewbar { pointer-events:auto; display:flex; gap:10px; align-items:center; }
.lgb-ai-bar { padding:8px 8px 0; }
.lgb-ai-btn { width:100%; background:linear-gradient(135deg,#7c5cff,#5236e0); }
.lgb-ai { margin:8px 8px 0; padding:10px; border-radius:8px; background:#f5f3ff; border:1px solid #ddd6fe; display:flex; flex-direction:column; gap:8px; }
.lgb-ai-title { font-weight:700; color:#4c1d95; }
.lgb-note { margin:0; font-size:11px; color:#6b7280; }
.lgb-ai-hint { margin:0; font-size:11px; color:#6b7280; }
.lgb-ai-error { margin:0; font-size:12px; color:#b91c1c; }
.lgb-pickbar kbd { background:rgba(255,255,255,.2); border-radius:4px; padding:0 5px; }
`;
