import type {
  Advance,
  AnnouncementContent,
  ButtonAction,
  ChecklistContent,
  HotspotContent,
  HotspotOffset,
  InlineContent,
  SurveyAnswerValue,
  SurveyContent,
  SurveyQuestion,
  TourContent,
  TourStep,
} from "../src/lib/guide-schema";
import { matchesUrl } from "../src/lib/targeting";
import { bannerButtons, bannerText, buttonAt, CARD_WIDTH, label, openUrl, renderBlocks, wireMedia } from "./blocks";
import { plainText } from "../src/lib/format";
import { t, te } from "./i18n";
import { el, escapeHtml, everyFrame, findTarget, inlineHost, inViewport, placeBox, richText, safeUrl, shadow, waitForTarget } from "./ui";

export type EventType =
  | "guide_shown"
  | "step_viewed"
  | "guide_completed"
  | "guide_dismissed"
  | "guide_lost"
  | "checklist_item_completed"
  | "hotspot_opened"
  | "survey_answered"
  | "resource_clicked"
  | "media_completed";

export type Report = (type: EventType, extra?: { name?: string; stepIndex?: number; value?: SurveyAnswerValue }) => void;
export type EndReason = "completed" | "dismissed" | "lost";
export type Handle = { stop(): void };
// A running tour also hears the host's track() calls, for steps that wait for an event.
export type TourHandle = Handle & { event(name: string): void };

const ELEMENT_TIMEOUT_MS = 15000;
// After the last keystroke in a valid field, before an "input" step moves on.
const INPUT_SETTLE_MS = 1200;

// ---------- Tour ----------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEB_ADDRESS = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i;

function inputValid(field: Element, a: Extract<Advance, { type: "input" }>) {
  const v = ("value" in field ? String((field as HTMLInputElement).value) : (field.textContent ?? "")).trim();
  if (v.length < a.minLength) return false;
  if (a.format === "email") return EMAIL.test(v);
  if (a.format === "url") return WEB_ADDRESS.test(v);
  if (a.format === "regex" && a.pattern) {
    try {
      return new RegExp(a.pattern).test(v);
    } catch {
      return true;
    }
  }
  return true;
}

function shouldSkip(step: TourStep) {
  const { when, selector } = step.skipIf;
  if (when === "never" || !selector) return false;
  const present = Boolean(findTarget(selector));
  return when === "present" ? present : !present;
}

export function runTour(
  content: TourContent,
  opts: {
    startAt?: number;
    report: Report;
    onEnd: (r: EndReason) => void;
    startGuide?: (guideId: string) => void;
    // A step is showing; `leaving`: the user may leave the page to finish it (url / click steps).
    onStep?: (index: number, leaving: boolean) => void;
  },
): TourHandle {
  const steps = content.steps;
  let index = Math.min(Math.max(opts.startAt ?? 0, 0), Math.max(steps.length - 1, 0));
  let dir: 1 | -1 = 1;
  let stopped = false;
  let teardown: (() => void) | null = null;
  let onTrack: ((name: string) => void) | null = null;
  const layer = el("div", { class: "lg" });
  shadow().appendChild(layer);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") end("dismissed");
  };
  document.addEventListener("keydown", onKey);

  function end(reason: EndReason) {
    if (stopped) return;
    cleanup();
    if (reason === "completed") opts.report("guide_completed");
    if (reason === "dismissed") opts.report("guide_dismissed", { stepIndex: index });
    if (reason === "lost") opts.report("guide_lost", { stepIndex: index });
    opts.onEnd(reason);
  }

  function cleanup() {
    stopped = true;
    teardown?.();
    layer.remove();
    document.removeEventListener("keydown", onKey);
  }

  function go(i: number) {
    dir = i < index ? -1 : 1;
    if (i >= steps.length) return end("completed");
    index = Math.max(0, i);
    const a = steps[index].advanceOn.type;
    opts.onStep?.(index, a === "url" || a === "click");
    void show();
  }

  // Past a skipped or missing step, in the direction the user was going.
  function skip() {
    go(dir < 0 && index > 0 ? index - 1 : index + 1);
  }

  function act(a: ButtonAction) {
    switch (a.type) {
      case "next":
        return go(index + 1);
      case "back":
        return go(index - 1);
      case "close":
        return end("dismissed");
      case "complete":
        return end("completed");
      case "url":
        return openUrl(a.url, a.newTab);
      case "guide":
        end("completed");
        if (a.guideId) opts.startGuide?.(a.guideId);
        return;
    }
  }

  async function show() {
    teardown?.();
    teardown = null;
    onTrack = null;
    layer.innerHTML = "";
    const step = steps[index];
    const myIndex = index;
    const live = () => !stopped && index === myIndex;
    const advance = () => live() && go(index + 1);
    const adv = step.advanceOn;
    const urlReached = () => adv.type === "url" && Boolean(adv.rule.value) && matchesUrl([adv.rule], location.href);

    if (shouldSkip(step)) return skip();
    // Already where this step sends the user, e.g. resumed after a full page load.
    if (urlReached()) return advance();

    let target: Element | null = null;
    if (step.selector) {
      target = await waitForTarget(step.selector, ELEMENT_TIMEOUT_MS, () => !live() || urlReached());
      if (!live()) return;
      if (urlReached()) return advance();
      if (!target) return step.optional ? skip() : end("lost");
    }
    opts.report("step_viewed", { stepIndex: index });

    // click / input need the element; on a centered step they fall back to Next.
    const mode = (adv.type === "click" || adv.type === "input") && !target ? "next" : adv.type;
    const waits = mode === "click" || mode === "input" || mode === "element";
    const last = index === steps.length - 1;
    const f = step.footer;
    const showNext = !waits;
    const skipLink = waits && step.optional;
    const footer =
      (f.show && (showNext || (f.showBack && index > 0) || (f.showProgress && steps.length > 1))) || skipLink
        ? `<div class="lg-footer">
           <span class="lg-count">${f.show && f.showProgress && steps.length > 1 ? te("stepCount", { n: index + 1, total: steps.length }) : ""}</span>
           ${skipLink ? `<button class="lg-link" data-act="next">${te("skip")}</button>` : ""}
           ${f.show && f.showBack && index > 0 ? `<button class="lg-btn lg-ghost" data-act="back">${escapeHtml(f.backLabel)}</button>` : ""}
           ${f.show && showNext ? `<button class="lg-btn" data-act="next">${escapeHtml(last ? f.doneLabel : f.nextLabel)}</button>` : ""}
         </div>`
        : "";
    const width = CARD_WIDTH[target ? "tooltip" : "modal"][step.size];
    const card = el(
      "div",
      { class: "lg-card", role: "dialog", "aria-label": label(step.blocks), style: `width:min(${width}px, calc(100vw - 16px))` },
      `<button class="lg-close" aria-label="${te("close")}">×</button>${renderBlocks(step.blocks)}${footer}`,
    );
    card.querySelector(".lg-close")!.addEventListener("click", () => end("dismissed"));
    card.querySelector('[data-act="back"]')?.addEventListener("click", () => go(index - 1));
    card.querySelector('[data-act="next"]')?.addEventListener("click", () => go(index + 1));
    card.addEventListener("click", (e) => {
      const a = buttonAt(step.blocks, (e.target as HTMLElement).closest<HTMLElement>("[data-btn]")?.dataset.btn);
      if (a) act(a);
    });
    wireMedia(card, (blockId) => {
      if (!live()) return;
      opts.report("media_completed", { name: blockId, stepIndex: index });
      if (mode === "media_end") advance();
    });

    const cleanups: (() => void)[] = [];
    teardown = () => cleanups.forEach((fn) => fn());
    const poll = (done: () => boolean) => {
      const id = window.setInterval(() => done() && advance(), 250);
      cleanups.push(() => clearInterval(id));
    };
    if (mode === "element" && adv.type === "element" && adv.selector) poll(() => Boolean(findTarget(adv.selector)));
    if (mode === "url") poll(urlReached);
    if (mode === "event" && adv.type === "event") onTrack = (name) => name === adv.name && advance();

    if (!target) {
      const wrap = el("div", { class: "lg-modal-wrap" });
      wrap.appendChild(card);
      layer.appendChild(wrap);
      (card.querySelector('[data-act="next"], [data-btn]') as HTMLElement | null)?.focus();
      return;
    }

    const spot = el("div", { class: "lg-spot" + (step.backdrop ? "" : " lg-nobackdrop") });
    layer.append(spot, card);
    if (!inViewport(target.getBoundingClientRect())) target.scrollIntoView({ block: "center", behavior: "smooth" });

    const tg = target;
    cleanups.push(
      everyFrame(() => {
        if (!tg.isConnected) return;
        const r = tg.getBoundingClientRect();
        const pad = 6;
        spot.style.top = r.top - pad + "px";
        spot.style.left = r.left - pad + "px";
        spot.style.width = r.width + pad * 2 + "px";
        spot.style.height = r.height + pad * 2 + "px";
        placeBox(card, r, step.placement, 14);
      }),
    );
    const listen = (type: string, fn: (e: Event) => void, capture = false) => {
      tg.addEventListener(type, fn, capture);
      cleanups.push(() => tg.removeEventListener(type, fn, capture));
    };
    if (mode === "click") {
      listen(
        "click",
        () => {
          // Saved before the click can navigate away, so the next page carries on from the next step.
          opts.onStep?.(index + 1, true);
          setTimeout(advance, 0);
        },
        true,
      );
    }
    if (mode === "input" && adv.type === "input") {
      // The element may be the field itself or a wrapper around it.
      const field = tg.matches("input, textarea, select, [contenteditable]")
        ? tg
        : (tg.querySelector("input, textarea, select, [contenteditable]") ?? tg);
      let settle = 0;
      cleanups.push(() => clearTimeout(settle));
      listen("input", () => {
        clearTimeout(settle);
        if (inputValid(field, adv)) settle = window.setTimeout(advance, INPUT_SETTLE_MS);
      });
      const commit = () => inputValid(field, adv) && advance();
      listen("change", commit);
      listen("focusout", commit);
      listen("keydown", (e) => (e as KeyboardEvent).key === "Enter" && commit());
      (field as HTMLElement).focus?.({ preventScroll: true });
    }
  }

  if (!steps.length) {
    cleanup();
    opts.onEnd("lost");
  } else {
    opts.report("guide_shown");
    go(index);
  }
  return {
    stop: cleanup,
    event(name) {
      onTrack?.(name);
    },
  };
}

// ---------- Announcement ----------

export function runAnnouncement(
  content: AnnouncementContent,
  opts: { report: Report; onEnd: (r: EndReason) => void; startGuide?: (guideId: string) => void },
): Handle {
  const layer = el("div", { class: "lg" });
  shadow().appendChild(layer);
  let done = false;

  const finish = (reason: EndReason) => {
    if (done) return;
    done = true;
    layer.remove();
    document.removeEventListener("keydown", onKey);
    opts.report(reason === "completed" ? "guide_completed" : "guide_dismissed");
    opts.onEnd(reason);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") finish("dismissed");
  };
  document.addEventListener("keydown", onKey);

  // An announcement has a single "step": next/back/complete all finish it.
  const act = (a: ButtonAction) => {
    if (a.type === "close") return finish("dismissed");
    if (a.type === "url") openUrl(a.url, a.newTab);
    finish("completed");
    if (a.type === "guide" && a.guideId) opts.startGuide?.(a.guideId);
  };

  const wrap = el(
    "div",
    { class: "lg-modal-wrap" },
    `<div class="lg-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(label(content.blocks))}"
          style="width:min(${CARD_WIDTH.modal[content.size]}px, 100%)">
       <button class="lg-close" aria-label="${te("close")}">×</button>${renderBlocks(content.blocks)}
     </div>`,
  );
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) finish("dismissed");
  });
  layer.appendChild(wrap);
  layer.querySelector(".lg-close")!.addEventListener("click", () => finish("dismissed"));
  layer.addEventListener("click", (e) => {
    const a = buttonAt(content.blocks, (e.target as HTMLElement).closest<HTMLElement>("[data-btn]")?.dataset.btn);
    if (a) act(a);
  });
  wireMedia(layer, (name) => opts.report("media_completed", { name }));
  opts.report("guide_shown");

  return {
    stop() {
      done = true;
      layer.remove();
      document.removeEventListener("keydown", onKey);
    },
  };
}

// ---------- Banner ----------

const TONES = {
  brand: null,
  info: { bg: "#2563eb", fg: "#ffffff" },
  success: { bg: "#059669", fg: "#ffffff" },
  warning: { bg: "#f59e0b", fg: "#1c1917" },
} as const;

// An announcement with format "banner": a strip at the top or bottom of the
// page. It has a slot of its own, so it never blocks a tour or survey.
export function runBanner(
  content: AnnouncementContent,
  opts: { report: Report; onEnd: (r: EndReason) => void; startGuide?: (guideId: string) => void },
): Handle {
  const s = content.banner;
  const layer = el("div", { class: "lg" });
  shadow().appendChild(layer);
  let done = false;
  let unpush = () => {};

  const tone = TONES[s.tone];
  const bg = s.background || tone?.bg || "";
  const fg = s.textColor || (s.background ? "#ffffff" : (tone?.fg ?? ""));
  const vars = [bg && `--lg-bb:${bg}`, fg && `--lg-bf:${fg}`, bg && `--lg-bs:${bg}`].filter(Boolean).join(";");

  const link = safeUrl(s.link.url);
  // The whole text becomes one link, so links inside it are dropped.
  const text = link
    ? `<a class="lg-banner-text" href="${link}"${s.link.newTab ? ' target="_blank" rel="noopener"' : ""}>${bannerText(content.blocks).replace(/<\/?a\b[^>]*>/g, "")}</a>`
    : `<span>${bannerText(content.blocks)}</span>`;
  const bar = el(
    "div",
    {
      class: `lg-banner lg-${s.position}${s.dismissible ? "" : " lg-nodismiss"}`,
      role: "region",
      "aria-label": label(content.blocks),
      style: vars,
    },
    `${text}${bannerButtons(content.blocks)}${s.dismissible ? `<button class="lg-close" aria-label="${te("close")}">×</button>` : ""}`,
  );
  layer.appendChild(bar);

  // push: pad the page by the banner's height. Fixed headers on the host page aren't moved.
  if (s.mode === "push") {
    const prop = s.position === "top" ? "paddingTop" : "paddingBottom";
    const body = document.body;
    const before = body.style[prop];
    const base = parseFloat(getComputedStyle(body)[prop]) || 0;
    const ro = new ResizeObserver(() => (body.style[prop] = base + bar.offsetHeight + "px"));
    ro.observe(bar);
    unpush = () => {
      ro.disconnect();
      body.style[prop] = before;
    };
  }

  const cleanup = () => {
    done = true;
    unpush();
    layer.remove();
  };
  const finish = (reason: EndReason) => {
    if (done) return;
    cleanup();
    opts.report(reason === "completed" ? "guide_completed" : "guide_dismissed");
    opts.onEnd(reason);
  };

  bar.querySelector(".lg-close")?.addEventListener("click", () => finish("dismissed"));
  bar.querySelector(".lg-banner-text")?.addEventListener("click", () => finish("completed"));
  bar.addEventListener("click", (e) => {
    const a = buttonAt(content.blocks, (e.target as HTMLElement).closest<HTMLElement>("[data-btn]")?.dataset.btn);
    if (!a) return;
    if (a.type === "close") return finish("dismissed");
    if (a.type === "url") openUrl(a.url, a.newTab);
    finish("completed");
    if (a.type === "guide" && a.guideId) opts.startGuide?.(a.guideId);
  });
  opts.report("guide_shown");
  return { stop: cleanup };
}

// ---------- Hotspots ----------

// Where the marker sits on the element's box.
function markerPoint(r: DOMRect, offset: HotspotOffset) {
  switch (offset) {
    case "top-left":
      return { x: r.left + 4, y: r.top + 4 };
    case "bottom-right":
      return { x: r.right - 4, y: r.bottom - 4 };
    case "bottom-left":
      return { x: r.left + 4, y: r.bottom - 4 };
    case "right":
      return { x: r.right + 14, y: r.top + r.height / 2 };
    case "left":
      return { x: r.left - 14, y: r.top + r.height / 2 };
    default:
      return { x: r.right - 4, y: r.top + 4 };
  }
}

export function runHotspots(
  content: HotspotContent,
  opts: { opened: Set<string>; report: Report; startGuide?: (guideId: string) => void },
): Handle {
  const layer = el("div", { class: "lg" });
  shadow().appendChild(layer);
  const markers = new Map<string, HTMLButtonElement>();
  // Opening is recorded once per hotspot, persistent or not.
  const reported = new Set(opts.opened);
  let tip: { id: string; card: HTMLElement } | null = null;
  let shownReported = false;
  let hoverTimer = 0;

  const visible = (id: string) => content.hotspots.find((h) => h.id === id)?.persistent || !opts.opened.has(id);

  const closeTip = () => {
    clearTimeout(hoverTimer);
    if (tip) markers.get(tip.id)?.setAttribute("aria-expanded", "false");
    tip?.card.remove();
    tip = null;
  };
  const closeSoon = () => {
    clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(closeTip, 300);
  };

  // Gone for good (non-persistent), or just closed (persistent).
  const acknowledge = (id: string) => {
    closeTip();
    if (content.hotspots.find((h) => h.id === id)?.persistent) return;
    opts.opened.add(id);
    markers.get(id)?.remove();
    markers.delete(id);
  };

  const stopFrame = everyFrame(() => {
    for (const h of content.hotspots) {
      if (!visible(h.id)) continue;
      const target = findTarget(h.selector);
      let b = markers.get(h.id);
      if (!target) {
        if (b) b.style.display = "none";
        if (tip?.id === h.id) closeTip();
        continue;
      }
      if (!b) {
        const icon = h.style === "icon";
        b = el(
          "button",
          { class: icon ? "lg-hs-icon" : "lg-beacon", "aria-label": label(h.blocks) || t("hint"), "aria-expanded": "false" },
          icon ? (h.icon === "info" ? "i" : "?") : "",
        );
        const id = h.id;
        b.addEventListener("click", () => (tip?.id === id ? closeTip() : openTip(id)));
        if (h.openOn === "hover") {
          b.addEventListener("mouseenter", () => {
            clearTimeout(hoverTimer);
            if (tip?.id !== id) openTip(id);
          });
          b.addEventListener("mouseleave", closeSoon);
        }
        layer.appendChild(b);
        markers.set(h.id, b);
        if (!shownReported) {
          shownReported = true;
          opts.report("guide_shown");
        }
      }
      const r = target.getBoundingClientRect();
      const p = markerPoint(r, h.offset);
      b.style.display = "";
      b.style.top = p.y + "px";
      b.style.left = p.x + "px";
      if (tip?.id === h.id) placeBox(tip.card, r, h.placement, 14);
    }
  });

  function openTip(id: string) {
    const h = content.hotspots.find((x) => x.id === id);
    if (!h) return;
    closeTip();
    // One-off hints get a "Got it" unless the author added buttons of their own.
    const gotIt = !h.persistent && !h.blocks.some((b) => b.type === "buttons");
    const card = el(
      "div",
      { class: "lg-card", role: "dialog", "aria-label": label(h.blocks), style: `width:min(${CARD_WIDTH.tooltip[h.size]}px, calc(100vw - 16px))` },
      `<button class="lg-close" aria-label="${te("close")}">×</button>${renderBlocks(h.blocks)}
       ${gotIt ? `<div class="lg-footer"><span class="lg-count"></span><button class="lg-btn" data-act="ack">${te("gotIt")}</button></div>` : ""}`,
    );
    card.querySelector(".lg-close")!.addEventListener("click", () => acknowledge(id));
    card.querySelector('[data-act="ack"]')?.addEventListener("click", () => acknowledge(id));
    card.addEventListener("click", (e) => {
      const a = buttonAt(h.blocks, (e.target as HTMLElement).closest<HTMLElement>("[data-btn]")?.dataset.btn);
      if (!a) return;
      if (a.type === "back") return closeTip();
      if (a.type === "url") openUrl(a.url, a.newTab);
      acknowledge(id);
      if (a.type === "guide" && a.guideId) opts.startGuide?.(a.guideId);
    });
    if (h.openOn === "hover") {
      card.addEventListener("mouseenter", () => clearTimeout(hoverTimer));
      card.addEventListener("mouseleave", closeSoon);
    }
    wireMedia(card, (name) => opts.report("media_completed", { name }));
    layer.appendChild(card);
    tip = { id, card };
    markers.get(id)?.setAttribute("aria-expanded", "true");
    if (!reported.has(id)) {
      reported.add(id);
      if (h.persistent) opts.opened.add(id);
      opts.report("hotspot_opened", { name: id });
    }
  }

  // Clicking elsewhere or Escape closes the tip without dismissing the hotspot.
  const onDown = (e: PointerEvent) => {
    if (!tip) return;
    const path = e.composedPath();
    if (!path.includes(tip.card) && !path.includes(markers.get(tip.id)!)) closeTip();
  };
  const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeTip();
  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("keydown", onKey);

  return {
    stop() {
      stopFrame();
      closeTip();
      layer.remove();
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    },
  };
}

// ---------- Inline card ----------

const inlineAnchor = (selector: string): Element | null => {
  if (!selector) return null;
  try {
    // Prefer a visible match; an empty container can have no size yet.
    return findTarget(selector) ?? document.querySelector(selector);
  } catch {
    return null;
  }
};

// A card inside the host page at a selector. It has its own shadow host so it
// scrolls and flows with the page, and a MutationObserver puts it back when
// the host app re-renders (Angular, React) and drops it.
export function runInline(
  content: InlineContent,
  opts: { report: Report; onEnd: (r: EndReason) => void; startGuide?: (guideId: string) => void },
): Handle {
  const { host, root } = inlineHost();
  const card = el(
    "div",
    { class: "lg lg-inline", role: "region", "aria-label": label(content.blocks) },
    `${content.dismissible ? `<button class="lg-close" aria-label="${te("close")}">×</button>` : ""}${renderBlocks(content.blocks)}`,
  );
  root.appendChild(card);
  wireMedia(card, (name) => opts.report("media_completed", { name }));

  let anchor: Element | null = null;
  let hidden: { el: HTMLElement; display: string } | null = null;
  let shown = false;
  let done = false;
  let frame = 0;

  const unhide = () => {
    if (hidden) hidden.el.style.display = hidden.display;
    hidden = null;
  };

  const inPlace = () => {
    if (!anchor?.isConnected || !host.isConnected) return false;
    switch (content.position) {
      case "before":
        return host.nextElementSibling === anchor;
      case "after":
      case "replace":
        return anchor.nextElementSibling === host;
      default:
        return host.parentElement === anchor;
    }
  };

  function place() {
    frame = 0;
    if (done || inPlace()) return;
    const target = anchor?.isConnected ? anchor : inlineAnchor(content.selector);
    if (target !== anchor) unhide();
    anchor = target;
    if (!target) return host.remove();
    switch (content.position) {
      case "before":
        target.before(host);
        break;
      case "after":
        target.after(host);
        break;
      case "prepend":
        target.prepend(host);
        break;
      case "append":
        target.append(host);
        break;
      case "replace":
        target.after(host);
        if (!hidden && target instanceof HTMLElement) {
          hidden = { el: target, display: target.style.display };
          target.style.display = "none";
        }
        break;
    }
    if (!shown) {
      shown = true;
      opts.report("guide_shown");
    }
  }

  const observer = new MutationObserver(() => {
    frame ||= requestAnimationFrame(place);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  place();

  const cleanup = () => {
    done = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    host.remove();
    unhide();
  };
  const finish = (reason: EndReason) => {
    if (done) return;
    cleanup();
    opts.report(reason === "completed" ? "guide_completed" : "guide_dismissed");
    opts.onEnd(reason);
  };

  card.querySelector(".lg-close")?.addEventListener("click", () => finish("dismissed"));
  card.addEventListener("click", (e) => {
    const a = buttonAt(content.blocks, (e.target as HTMLElement).closest<HTMLElement>("[data-btn]")?.dataset.btn);
    if (!a) return;
    if (a.type === "url") return openUrl(a.url, a.newTab);
    if (a.type === "close") return finish("dismissed");
    if (a.type === "back") return;
    finish("completed");
    if (a.type === "guide" && a.guideId) opts.startGuide?.(a.guideId);
  });

  return { stop: cleanup };
}


// ---------- Checklist ----------

export type ChecklistHandle = Handle & { update(completed: Set<string>): void };

export function runChecklist(
  content: ChecklistContent,
  opts: {
    completed: Set<string>;
    report: Report;
    startTour: (guideId: string) => void;
    onDismiss: () => void;
  },
): ChecklistHandle {
  const layer = el("div", { class: "lg" });
  shadow().appendChild(layer);
  const side = content.position === "bottom-left" ? "left" : "right";
  let open = false;
  let completed = opts.completed;
  opts.report("guide_shown");

  function render() {
    const total = content.items.length;
    const done = content.items.filter((i) => completed.has(i.id)).length;
    layer.innerHTML = "";

    const launcher = el(
      "button",
      { class: "lg-launcher", style: `${side}:20px`, "aria-expanded": String(open) },
      `${richText(content.title)} <span class="lg-badge">${done}/${total}</span>`,
    );
    launcher.addEventListener("click", () => {
      open = !open;
      render();
    });
    layer.appendChild(launcher);
    if (!open) return;

    const panel = el(
      "div",
      { class: "lg-panel", style: `${side}:20px`, role: "dialog", "aria-label": plainText(content.title) },
      `<header>
         <button class="lg-close" aria-label="${te("minimize")}">–</button>
         <h3>${richText(content.title)}</h3>
         ${content.description ? `<p>${richText(content.description)}</p>` : ""}
         <div class="lg-progress"><span style="width:${total ? (done / total) * 100 : 0}%"></span></div>
       </header>
       <ul class="lg-items">
         ${content.items
           .map(
             (i) => `<li class="lg-item${completed.has(i.id) ? " lg-done" : ""}" data-id="${richText(i.id)}" tabindex="0">
               <span class="lg-check">${completed.has(i.id) ? "✓" : ""}</span>
               <span><div class="lg-title">${richText(i.title)}</div>${i.description ? `<div class="lg-desc">${richText(i.description)}</div>` : ""}</span>
             </li>`,
           )
           .join("")}
       </ul>
       <footer><button class="lg-link" data-act="dismiss">${done === total && total ? t("closeChecklist") : t("dismissChecklist")}</button></footer>`,
    );
    panel.querySelector(".lg-close")!.addEventListener("click", () => {
      open = false;
      render();
    });
    panel.querySelector('[data-act="dismiss"]')!.addEventListener("click", () => {
      stop();
      opts.onDismiss();
    });
    panel.querySelectorAll<HTMLElement>(".lg-item").forEach((li) => {
      const activate = () => clickItem(li.dataset.id!);
      li.addEventListener("click", activate);
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });
    layer.appendChild(panel);
  }

  function clickItem(id: string) {
    const item = content.items.find((i) => i.id === id);
    if (!item) return;
    if (item.completeOn.type === "click" && !completed.has(id)) {
      completed.add(id);
      opts.report("checklist_item_completed", { name: id });
    }
    if (item.action.type === "tour") {
      open = false;
      render();
      opts.startTour(item.action.guideId);
    } else if (item.action.type === "url" && safeUrl(item.action.url)) {
      location.href = item.action.url.trim();
    } else {
      render();
    }
  }

  function stop() {
    layer.remove();
  }

  render();
  return {
    stop,
    update(next) {
      completed = next;
      render();
    },
  };
}

// ---------- Survey ----------

// One question at a time in a corner card (or a centered modal). NPS, rating
// and single choice move on as soon as the user picks; multiple choice and
// text have a Next button. Each answer is sent as it's given, so partial
// responses still count.
export function runSurvey(content: SurveyContent, opts: { report: Report; onEnd: (r: EndReason) => void }): Handle {
  const questions = content.questions;
  const layer = el("div", { class: "lg" });
  shadow().appendChild(layer);
  const center = content.position === "center";
  const card = el("div", {
    class: "lg-card lg-survey" + (center ? "" : " lg-corner"),
    role: "dialog",
    "aria-label": t("survey"),
    style: center ? "width:min(460px, 100%)" : `${content.position === "bottom-left" ? "left" : "right"}:20px`,
  });
  if (center) {
    const wrap = el("div", { class: "lg-modal-wrap" });
    wrap.appendChild(card);
    layer.appendChild(wrap);
  } else {
    layer.appendChild(card);
  }

  let index = 0;
  let stopped = false;
  let submitted = false;
  let timer = 0;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);

  function cleanup() {
    stopped = true;
    clearTimeout(timer);
    layer.remove();
    document.removeEventListener("keydown", onKey);
  }

  function close() {
    if (stopped) return;
    cleanup();
    if (submitted) return opts.onEnd("completed");
    opts.report("guide_dismissed", { stepIndex: index });
    opts.onEnd("dismissed");
  }

  function answer(q: SurveyQuestion, value: SurveyAnswerValue | null) {
    if (stopped) return;
    if (value !== null) opts.report("survey_answered", { name: q.id, stepIndex: index, value });
    if (index + 1 < questions.length) {
      index++;
      render();
      return;
    }
    submitted = true;
    opts.report("guide_completed");
    if (!content.thankYou.show) return close();
    card.innerHTML = `<button class="lg-close" aria-label="${te("close")}">×</button>
      <div class="lg-thanks">
        <div class="lg-thanks-mark" aria-hidden="true">✓</div>
        ${content.thankYou.heading ? `<h3>${richText(content.thankYou.heading)}</h3>` : ""}
        ${content.thankYou.text ? `<p>${richText(content.thankYou.text)}</p>` : ""}
      </div>`;
    card.querySelector(".lg-close")!.addEventListener("click", close);
    timer = window.setTimeout(close, 4000);
  }

  function render() {
    const q = questions[index];
    const last = index === questions.length - 1;
    opts.report("step_viewed", { stepIndex: index });

    let body: string;
    let needsButton = false;
    if (q.type === "nps" || q.type === "rating") {
      const from = q.type === "nps" ? 0 : 1;
      const to = q.type === "nps" ? 10 : q.scale;
      const cells = Array.from({ length: to - from + 1 }, (_, i) => from + i);
      body = `<div class="lg-scale${q.type === "nps" ? " lg-nps" : ""}" role="radiogroup">${cells
        .map((n) => `<button class="lg-scale-btn" data-v="${n}" role="radio" aria-checked="false">${n}</button>`)
        .join("")}</div>
        ${q.lowLabel || q.highLabel ? `<div class="lg-scale-labels"><span>${escapeHtml(q.lowLabel)}</span><span>${escapeHtml(q.highLabel)}</span></div>` : ""}`;
    } else if (q.type === "single" || q.type === "multiple") {
      body = `<div class="lg-options" role="${q.type === "single" ? "radiogroup" : "group"}">${q.options
        .map(
          (o) => `<button class="lg-option" data-v="${escapeHtml(o.id)}" role="${q.type === "single" ? "radio" : "checkbox"}" aria-checked="false">
            <span class="lg-mark${q.type === "single" ? " lg-round" : ""}"></span><span>${escapeHtml(o.label)}</span></button>`,
        )
        .join("")}</div>`;
      needsButton = q.type === "multiple";
    } else {
      body = `<textarea class="lg-input" rows="3" maxlength="2000" placeholder="${escapeHtml(q.placeholder)}"></textarea>`;
      needsButton = true;
    }

    const count = content.showProgress && questions.length > 1 ? te("stepCount", { n: index + 1, total: questions.length }) : "";
    const footer =
      needsButton || !q.required || count
        ? `<div class="lg-footer"><span class="lg-count">${count}</span>
             ${!q.required ? `<button class="lg-btn lg-ghost" data-act="skip">${te("skip")}</button>` : ""}
             ${needsButton ? `<button class="lg-btn" data-act="next"${q.required ? " disabled" : ""}>${escapeHtml(last ? content.submitLabel : content.nextLabel)}</button>` : ""}
           </div>`
        : "";
    card.innerHTML = `<button class="lg-close" aria-label="${te("close")}">×</button>
      ${q.title ? `<h3 class="lg-q">${richText(q.title)}</h3>` : ""}
      ${q.description ? `<div class="lg-body lg-q-desc">${richText(q.description)}</div>` : ""}
      ${body}${footer}`;

    card.querySelector(".lg-close")!.addEventListener("click", close);
    card.querySelector('[data-act="skip"]')?.addEventListener("click", () => answer(q, null));
    const next = card.querySelector<HTMLButtonElement>('[data-act="next"]');

    if (q.type === "nps" || q.type === "rating" || q.type === "single") {
      const buttons = [...card.querySelectorAll<HTMLButtonElement>("[data-v]")];
      for (const b of buttons) {
        b.addEventListener("click", () => {
          for (const x of buttons) x.setAttribute("aria-checked", String(x === b));
          const raw = b.dataset.v!;
          // Brief pause so the choice is visible before moving on.
          clearTimeout(timer);
          timer = window.setTimeout(() => answer(q, q.type === "single" ? raw : Number(raw)), 250);
        });
      }
    } else if (q.type === "multiple") {
      const picked = new Set<string>();
      for (const b of card.querySelectorAll<HTMLButtonElement>("[data-v]")) {
        b.addEventListener("click", () => {
          const v = b.dataset.v!;
          if (picked.has(v)) picked.delete(v);
          else picked.add(v);
          b.setAttribute("aria-checked", String(picked.has(v)));
          if (next && q.required) next.disabled = picked.size === 0;
        });
      }
      next?.addEventListener("click", () => answer(q, picked.size ? [...picked] : null));
    } else {
      const input = card.querySelector<HTMLTextAreaElement>("textarea")!;
      input.addEventListener("input", () => {
        if (next && q.required) next.disabled = !input.value.trim();
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && next && !next.disabled) next.click();
      });
      next?.addEventListener("click", () => answer(q, input.value.trim() || null));
      input.focus();
    }
  }

  if (!questions.length) {
    cleanup();
    opts.onEnd("lost");
  } else {
    opts.report("guide_shown");
    render();
  }
  return { stop: cleanup };
}
