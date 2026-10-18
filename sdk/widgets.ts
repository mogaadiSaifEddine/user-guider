import type {
  AnnouncementContent,
  ButtonAction,
  ChecklistContent,
  HotspotContent,
  SurveyAnswerValue,
  SurveyContent,
  SurveyQuestion,
  TourContent,
} from "../src/lib/guide-schema";
import { bannerButtons, bannerText, buttonAt, CARD_WIDTH, label, openUrl, renderBlocks } from "./blocks";
import { el, escapeHtml, everyFrame, findTarget, inViewport, placeBox, richText, safeUrl, shadow, waitForTarget } from "./ui";

export type EventType =
  | "guide_shown"
  | "step_viewed"
  | "guide_completed"
  | "guide_dismissed"
  | "checklist_item_completed"
  | "hotspot_opened"
  | "survey_answered";

export type Report = (type: EventType, extra?: { name?: string; stepIndex?: number; value?: SurveyAnswerValue }) => void;
export type EndReason = "completed" | "dismissed" | "lost";
export type Handle = { stop(): void };

const ELEMENT_TIMEOUT_MS = 15000;

// ---------- Tour ----------

export function runTour(
  content: TourContent,
  opts: { startAt?: number; report: Report; onEnd: (r: EndReason) => void; startGuide?: (guideId: string) => void },
): Handle {
  const steps = content.steps;
  let index = Math.min(Math.max(opts.startAt ?? 0, 0), Math.max(steps.length - 1, 0));
  let stopped = false;
  let teardown: (() => void) | null = null;
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
    opts.onEnd(reason);
  }

  function cleanup() {
    stopped = true;
    teardown?.();
    layer.remove();
    document.removeEventListener("keydown", onKey);
  }

  function go(i: number) {
    if (i >= steps.length) return end("completed");
    index = Math.max(0, i);
    void show();
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
    layer.innerHTML = "";
    const step = steps[index];
    const myIndex = index;

    let target: Element | null = null;
    if (step.selector) {
      target = await waitForTarget(step.selector, ELEMENT_TIMEOUT_MS, () => stopped || index !== myIndex);
      if (stopped || index !== myIndex) return;
      if (!target) return end("lost");
    }
    opts.report("step_viewed", { stepIndex: index });

    const last = index === steps.length - 1;
    const f = step.footer;
    const showNext = !(step.advanceOn === "click" && target);
    const footer =
      f.show && (showNext || (f.showBack && index > 0) || (f.showProgress && steps.length > 1))
        ? `<div class="lg-footer">
           <span class="lg-count">${f.showProgress && steps.length > 1 ? `${index + 1} of ${steps.length}` : ""}</span>
           ${f.showBack && index > 0 ? `<button class="lg-btn lg-ghost" data-act="back">${escapeHtml(f.backLabel)}</button>` : ""}
           ${showNext ? `<button class="lg-btn" data-act="next">${escapeHtml(last ? f.doneLabel : f.nextLabel)}</button>` : ""}
         </div>`
        : "";
    const width = CARD_WIDTH[target ? "tooltip" : "modal"][step.size];
    const card = el(
      "div",
      { class: "lg-card", role: "dialog", "aria-label": label(step.blocks), style: `width:min(${width}px, calc(100vw - 16px))` },
      `<button class="lg-close" aria-label="Close">×</button>${renderBlocks(step.blocks)}${footer}`,
    );
    card.querySelector(".lg-close")!.addEventListener("click", () => end("dismissed"));
    card.querySelector('[data-act="back"]')?.addEventListener("click", () => go(index - 1));
    card.querySelector('[data-act="next"]')?.addEventListener("click", () => go(index + 1));
    card.addEventListener("click", (e) => {
      const a = buttonAt(step.blocks, (e.target as HTMLElement).closest<HTMLElement>("[data-btn]")?.dataset.btn);
      if (a) act(a);
    });

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

    const t = target;
    const stopFrame = everyFrame(() => {
      if (!t.isConnected) return;
      const r = t.getBoundingClientRect();
      const pad = 6;
      spot.style.top = r.top - pad + "px";
      spot.style.left = r.left - pad + "px";
      spot.style.width = r.width + pad * 2 + "px";
      spot.style.height = r.height + pad * 2 + "px";
      placeBox(card, r, step.placement, 14);
    });
    const onTargetClick = () => setTimeout(() => go(index + 1), 0);
    if (step.advanceOn === "click") t.addEventListener("click", onTargetClick, true);
    teardown = () => {
      stopFrame();
      t.removeEventListener("click", onTargetClick, true);
    };
  }

  if (!steps.length) {
    cleanup();
    opts.onEnd("lost");
  } else {
    opts.report("guide_shown");
    go(index);
  }
  return { stop: cleanup };
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

  if (content.format === "banner") {
    layer.appendChild(
      el(
        "div",
        { class: "lg-banner", role: "status" },
        `<span>${bannerText(content.blocks)}</span>${bannerButtons(content.blocks)}<button class="lg-close" aria-label="Close">×</button>`,
      ),
    );
  } else {
    const wrap = el(
      "div",
      { class: "lg-modal-wrap" },
      `<div class="lg-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(label(content.blocks))}"
            style="width:min(${CARD_WIDTH.modal[content.size]}px, 100%)">
         <button class="lg-close" aria-label="Close">×</button>${renderBlocks(content.blocks)}
       </div>`,
    );
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) finish("dismissed");
    });
    layer.appendChild(wrap);
  }
  layer.querySelector(".lg-close")!.addEventListener("click", () => finish("dismissed"));
  layer.addEventListener("click", (e) => {
    const a = buttonAt(content.blocks, (e.target as HTMLElement).closest<HTMLElement>("[data-btn]")?.dataset.btn);
    if (a) act(a);
  });
  opts.report("guide_shown");

  return {
    stop() {
      done = true;
      layer.remove();
      document.removeEventListener("keydown", onKey);
    },
  };
}

// ---------- Hotspots ----------

export function runHotspots(
  content: HotspotContent,
  opts: { opened: Set<string>; report: Report },
): Handle {
  const layer = el("div", { class: "lg" });
  shadow().appendChild(layer);
  const beacons = new Map<string, HTMLButtonElement>();
  let tip: { id: string; card: HTMLElement } | null = null;
  let shownReported = false;

  const closeTip = () => {
    tip?.card.remove();
    tip = null;
  };

  const stopFrame = everyFrame(() => {
    for (const h of content.hotspots) {
      if (opts.opened.has(h.id)) continue;
      const target = findTarget(h.selector);
      let b = beacons.get(h.id);
      if (!target) {
        if (b) b.style.display = "none";
        continue;
      }
      if (!b) {
        b = el("button", { class: "lg-beacon", "aria-label": h.title || "Hint" });
        b.addEventListener("click", () => openTip(h.id));
        layer.appendChild(b);
        beacons.set(h.id, b);
        if (!shownReported) {
          shownReported = true;
          opts.report("guide_shown");
        }
      }
      const r = target.getBoundingClientRect();
      b.style.display = "";
      b.style.top = r.top + 4 + "px";
      b.style.left = r.right - 4 + "px";
      if (tip?.id === h.id) placeBox(tip.card, r, h.placement, 14);
    }
  });

  function openTip(id: string) {
    const h = content.hotspots.find((x) => x.id === id);
    if (!h) return;
    closeTip();
    const card = el(
      "div",
      { class: "lg-card", role: "dialog" },
      `<button class="lg-close" aria-label="Close">×</button>
       ${h.title ? `<h3>${richText(h.title)}</h3>` : ""}
       <div class="lg-body">${richText(h.body)}</div>
       <div class="lg-footer"><span class="lg-count"></span><button class="lg-btn">Got it</button></div>`,
    );
    const ack = () => {
      closeTip();
      opts.opened.add(id);
      beacons.get(id)?.remove();
      beacons.delete(id);
    };
    card.querySelector(".lg-close")!.addEventListener("click", ack);
    card.querySelector(".lg-btn")!.addEventListener("click", ack);
    layer.appendChild(card);
    tip = { id, card };
    opts.report("hotspot_opened", { name: id });
  }

  return {
    stop() {
      stopFrame();
      layer.remove();
    },
  };
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
      { class: "lg-panel", style: `${side}:20px`, role: "dialog", "aria-label": content.title },
      `<header>
         <button class="lg-close" aria-label="Minimize">–</button>
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
       <footer><button class="lg-link" data-act="dismiss">${done === total && total ? "Close checklist" : "Dismiss checklist"}</button></footer>`,
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
    "aria-label": "Survey",
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
    card.innerHTML = `<button class="lg-close" aria-label="Close">×</button>
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

    const count = content.showProgress && questions.length > 1 ? `${index + 1} of ${questions.length}` : "";
    const footer =
      needsButton || !q.required || count
        ? `<div class="lg-footer"><span class="lg-count">${count}</span>
             ${!q.required ? `<button class="lg-btn lg-ghost" data-act="skip">Skip</button>` : ""}
             ${needsButton ? `<button class="lg-btn" data-act="next"${q.required ? " disabled" : ""}>${escapeHtml(last ? content.submitLabel : content.nextLabel)}</button>` : ""}
           </div>`
        : "";
    card.innerHTML = `<button class="lg-close" aria-label="Close">×</button>
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
