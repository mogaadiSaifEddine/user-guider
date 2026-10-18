import type {
  AnnouncementContent,
  ChecklistContent,
  HotspotContent,
  TourContent,
} from "../src/lib/guide-schema";
import { el, everyFrame, findTarget, inViewport, placeBox, richText, safeUrl, shadow, waitForTarget } from "./ui";

export type EventType =
  | "guide_shown"
  | "step_viewed"
  | "guide_completed"
  | "guide_dismissed"
  | "checklist_item_completed"
  | "hotspot_opened";

export type Report = (type: EventType, extra?: { name?: string; stepIndex?: number }) => void;
export type EndReason = "completed" | "dismissed" | "lost";
export type Handle = { stop(): void };

const ELEMENT_TIMEOUT_MS = 15000;

// ---------- Tour ----------

export function runTour(
  content: TourContent,
  opts: { startAt?: number; report: Report; onEnd: (r: EndReason) => void },
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
    const card = el(
      "div",
      { class: "lg-card", role: "dialog", "aria-label": step.title || "Guide" },
      `<button class="lg-close" aria-label="Close">×</button>
       ${step.title ? `<h3>${richText(step.title)}</h3>` : ""}
       <div class="lg-body">${richText(step.body)}</div>
       <div class="lg-footer">
         ${steps.length > 1 ? `<span class="lg-count">${index + 1} of ${steps.length}</span>` : `<span class="lg-count"></span>`}
         ${index > 0 ? `<button class="lg-btn lg-ghost" data-act="back">Back</button>` : ""}
         ${step.advanceOn === "click" && target ? "" : `<button class="lg-btn" data-act="next">${last ? "Done" : "Next"}</button>`}
       </div>`,
    );
    card.querySelector(".lg-close")!.addEventListener("click", () => end("dismissed"));
    card.querySelector('[data-act="back"]')?.addEventListener("click", () => go(index - 1));
    card.querySelector('[data-act="next"]')?.addEventListener("click", () => go(index + 1));

    if (!target) {
      const wrap = el("div", { class: "lg-modal-wrap" });
      wrap.appendChild(card);
      layer.appendChild(wrap);
      (card.querySelector('[data-act="next"]') as HTMLElement | null)?.focus();
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
  opts: { report: Report; onEnd: (r: EndReason) => void },
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

  const buttonUrl = safeUrl(content.buttonUrl);
  const imageUrl = safeUrl(content.imageUrl);
  const button = content.buttonText
    ? buttonUrl
      ? `<a class="lg-btn" data-act="ok" href="${buttonUrl}" target="_blank" rel="noopener" style="text-decoration:none">${richText(content.buttonText)}</a>`
      : `<button class="lg-btn" data-act="ok">${richText(content.buttonText)}</button>`
    : "";

  if (content.format === "banner") {
    layer.appendChild(
      el(
        "div",
        { class: "lg-banner", role: "status" },
        `<span>${content.title ? `<strong>${richText(content.title)}</strong> ` : ""}${richText(content.body)}</span>
         ${button}
         <button class="lg-close" aria-label="Close">×</button>`,
      ),
    );
  } else {
    const wrap = el(
      "div",
      { class: "lg-modal-wrap" },
      `<div class="lg-card" role="dialog" aria-modal="true" aria-label="${richText(content.title || "Announcement")}">
         ${imageUrl ? `<img src="${imageUrl}" alt="">` : ""}
         <button class="lg-close" aria-label="Close">×</button>
         ${content.title ? `<h3>${richText(content.title)}</h3>` : ""}
         <div class="lg-body">${richText(content.body)}</div>
         <div class="lg-footer"><span class="lg-count"></span>${button}</div>
       </div>`,
    );
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) finish("dismissed");
    });
    layer.appendChild(wrap);
  }
  layer.querySelector(".lg-close")!.addEventListener("click", () => finish("dismissed"));
  layer.querySelector('[data-act="ok"]')?.addEventListener("click", () => finish("completed"));
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
