import type {
  AnnouncementContent,
  ChecklistContent,
  HotspotContent,
  SurveyAnswerValue,
  SurveyContent,
  Theme,
  TourContent,
} from "../src/lib/guide-schema";
import { matchesUrl, type UrlRule } from "../src/lib/targeting";
import { builderToken, startBuilder } from "./builder";
import { applyTheme } from "./ui";
import {
  runAnnouncement,
  runChecklist,
  runHotspots,
  runSurvey,
  runTour,
  type ChecklistHandle,
  type EventType,
  type Handle,
} from "./widgets";

type Progress = {
  status: "STARTED" | "COMPLETED" | "DISMISSED";
  currentStep: number;
  completedItems: string[];
} | null;

type SdkGuide = {
  id: string;
  name: string;
  type: "TOUR" | "CHECKLIST" | "ANNOUNCEMENT" | "HOTSPOT" | "SURVEY";
  priority: number;
  content: unknown;
  targeting: { urlRules: UrlRule[]; trigger: "auto" | "manual"; delaySeconds: number };
  autoShow: boolean;
  progress: Progress;
};

type QueuedEvent = {
  type: EventType | "custom";
  guideId?: string;
  name?: string;
  stepIndex?: number;
  value?: SurveyAnswerValue;
  url: string;
};
type Attributes = Record<string, string | number | boolean | null>;

type Stub = { q?: [string, ArrayLike<unknown>][]; key?: string; apiBase?: string };

const ANON_KEY = "lg_anon_id";

(function main() {
  const w = window as unknown as { LocatifyGuides?: Stub & { __loaded?: boolean } };
  if (w.LocatifyGuides?.__loaded) return;
  const stub: Stub = w.LocatifyGuides ?? {};

  const script = document.currentScript as HTMLScriptElement | null;
  const key = script?.dataset.key ?? stub.key;
  const apiBase = (script?.dataset.api ?? stub.apiBase ?? (script?.src ? new URL(script.src).origin : "")).replace(/\/$/, "");
  const waitForIdentify = script?.hasAttribute("data-wait-for-identify") ?? false;

  // ---------- state ----------
  let user: { id?: string; hash?: string; attributes?: Attributes } = {};
  let anonymousId = loadAnonId();
  let guides: SdkGuide[] = [];
  let loaded = false;
  let initSeq = 0;
  let initTimer = 0;
  let modal: { guideId: string; handle: Handle } | null = null;
  let modalPending = false;
  const pendingStarts: string[] = [];
  const shownThisLoad = new Set<string>();
  const hotspots = new Map<string, Handle>();
  const checklists = new Map<string, ChecklistHandle>();
  const buffer: QueuedEvent[] = [];
  let flushTimer = 0;

  const api = {
    __loaded: true,
    identify(id: string, attributes?: Attributes, options?: { hash?: string }) {
      if (!id) return;
      user = { id: String(id), hash: options?.hash, attributes };
      scheduleInit();
    },
    track(name: string) {
      if (!name) return;
      queue({ type: "custom", name: String(name) }, 0);
    },
    start(guideId: string) {
      if (!loaded) {
        pendingStarts.push(guideId);
        return;
      }
      startGuide(guideId);
    },
    page() {
      evaluate();
    },
    reset() {
      flush();
      user = {};
      anonymousId = newAnonId();
      scheduleInit();
    },
  };

  if (!key) {
    console.warn("[LocatifyGuides] Missing data-key on the script tag.");
    return;
  }

  const token = builderToken();
  if (token) {
    // Builder session: edit the guide, don't run live guides.
    w.LocatifyGuides = { ...api, identify() {}, track() {}, start() {}, page() {}, reset() {} } as never;
    void startBuilder(apiBase, token);
    return;
  }

  w.LocatifyGuides = api as never;
  let identified = false;
  for (const [method, args] of stub.q ?? []) {
    const fn = (api as Record<string, unknown>)[method];
    if (typeof fn === "function") fn(...Array.from(args));
    if (method === "identify") identified = true;
  }
  if (!identified && !waitForIdentify) scheduleInit();
  watchLocation(evaluate);
  addEventListener("pagehide", () => flush(true));

  // ---------- server ----------

  function userPayload(withAttributes: boolean) {
    if (!user.id) return { anonymousId };
    return { id: user.id, hash: user.hash, ...(withAttributes && user.attributes ? { attributes: user.attributes } : {}) };
  }

  function scheduleInit() {
    clearTimeout(initTimer);
    initTimer = window.setTimeout(init, 0);
  }

  async function init() {
    const seq = ++initSeq;
    flush();
    try {
      const res = await fetch(apiBase + "/api/sdk/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, user: userPayload(true), url: location.href, context: clientContext() }),
      });
      const data = await res.json();
      if (seq !== initSeq) return;
      if (!res.ok) {
        console.warn("[LocatifyGuides]", data.error ?? res.status);
        return;
      }
      teardown();
      applyTheme(data.theme as Theme);
      guides = data.guides;
      loaded = true;
      evaluate();
      for (const id of pendingStarts.splice(0)) startGuide(id);
    } catch (e) {
      console.warn("[LocatifyGuides] init failed", e);
    }
  }

  function queue(e: Omit<QueuedEvent, "url">, delay = 800) {
    buffer.push({ ...e, url: location.href.slice(0, 1024) });
    clearTimeout(flushTimer);
    if (buffer.length >= 20) flush();
    else flushTimer = window.setTimeout(flush, delay);
  }

  function flush(beacon = false) {
    clearTimeout(flushTimer);
    if (!buffer.length) return;
    const events = buffer.splice(0, 50);
    const body = JSON.stringify({ key, user: userPayload(false), events });
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(apiBase + "/api/sdk/events", new Blob([body], { type: "text/plain" }));
    } else {
      fetch(apiBase + "/api/sdk/events", { method: "POST", headers: { "Content-Type": "text/plain" }, body, keepalive: true })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => data && applyProgress(data.progress))
        .catch(() => {});
    }
    if (buffer.length) flush(beacon);
  }

  function reporter(guideId: string) {
    return (type: EventType, extra?: { name?: string; stepIndex?: number; value?: SurveyAnswerValue }) =>
      queue({ type, guideId, ...extra });
  }

  // The server tells us when checklist items complete (custom events, finished tours).
  function applyProgress(map: Record<string, Progress>) {
    for (const [guideId, p] of Object.entries(map ?? {})) {
      const g = guides.find((x) => x.id === guideId);
      if (!g) continue;
      g.progress = p;
      checklists.get(guideId)?.update(new Set(p?.completedItems ?? []));
    }
  }

  // ---------- rendering ----------

  function teardown() {
    modal?.handle.stop();
    modal = null;
    modalPending = false;
    for (const h of hotspots.values()) h.stop();
    for (const h of checklists.values()) h.stop();
    hotspots.clear();
    checklists.clear();
  }

  function evaluate() {
    if (!loaded) return;
    const href = location.href;
    for (const g of guides) {
      const here = matchesUrl(g.targeting.urlRules, href);
      if (g.type === "HOTSPOT") {
        const h = hotspots.get(g.id);
        if (here && g.autoShow && !h) {
          hotspots.set(
            g.id,
            runHotspots(g.content as HotspotContent, {
              opened: new Set(g.progress?.completedItems ?? []),
              report: reporter(g.id),
            }),
          );
        } else if (!here && h) {
          h.stop();
          hotspots.delete(g.id);
        }
      } else if (g.type === "CHECKLIST") {
        const h = checklists.get(g.id);
        if (here && g.autoShow && !h) {
          checklists.set(
            g.id,
            runChecklist(g.content as ChecklistContent, {
              completed: new Set(g.progress?.completedItems ?? []),
              report: reporter(g.id),
              startTour: startGuide,
              onDismiss: () => {
                g.autoShow = false;
                checklists.delete(g.id);
                reporter(g.id)("guide_dismissed");
              },
            }),
          );
        } else if (!here && h) {
          h.stop();
          checklists.delete(g.id);
        }
      }
    }

    // One tour, announcement or survey at a time, highest priority first.
    if (modal || modalPending) return;
    const next = guides.find(
      (g) =>
        isModal(g) &&
        g.autoShow &&
        g.targeting.trigger === "auto" &&
        !shownThisLoad.has(g.id) &&
        matchesUrl(g.targeting.urlRules, href),
    );
    if (!next) return;
    shownThisLoad.add(next.id);
    modalPending = true;
    setTimeout(() => {
      modalPending = false;
      if (modal || !matchesUrl(next.targeting.urlRules, location.href)) {
        shownThisLoad.delete(next.id);
        return evaluate();
      }
      const resumeAt = next.progress?.status === "STARTED" ? next.progress.currentStep : 0;
      show(next, resumeAt);
    }, next.targeting.delaySeconds * 1000);
  }

  function startGuide(guideId: string) {
    const g = guides.find((x) => x.id === guideId);
    if (!g) return console.warn("[LocatifyGuides] Guide not available for this user:", guideId);
    if (!isModal(g)) return;
    modal?.handle.stop();
    modal = null;
    shownThisLoad.add(g.id);
    show(g, 0);
  }

  function show(g: SdkGuide, startAt: number) {
    let ended = false;
    const onEnd = () => {
      ended = true;
      modal = null;
      g.autoShow = false;
      flush();
      evaluate();
    };
    const handle =
      g.type === "TOUR"
        ? runTour(g.content as TourContent, { startAt, report: reporter(g.id), onEnd, startGuide })
        : g.type === "SURVEY"
          ? runSurvey(g.content as SurveyContent, { report: reporter(g.id), onEnd })
          : runAnnouncement(g.content as AnnouncementContent, { report: reporter(g.id), onEnd, startGuide });
    // An empty tour ends synchronously; don't hold the modal slot for it.
    if (!ended) modal = { guideId: g.id, handle };
  }

  // ---------- helpers ----------

  function isModal(g: SdkGuide) {
    return g.type === "TOUR" || g.type === "ANNOUNCEMENT" || g.type === "SURVEY";
  }

  // Language, time zone and touch support for the audience breakdowns; the
  // server reads browser and OS from the User-Agent header.
  function clientContext() {
    const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
    let timezone: string | undefined;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // old browser
    }
    return {
      language: nav.language?.slice(0, 35),
      timezone: timezone?.slice(0, 64),
      touch: nav.maxTouchPoints > 1,
      mobile: nav.userAgentData?.mobile,
    };
  }

  function loadAnonId() {
    try {
      return localStorage.getItem(ANON_KEY) ?? newAnonId();
    } catch {
      return newAnonId();
    }
  }

  function newAnonId() {
    const id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 64);
    try {
      localStorage.setItem(ANON_KEY, id);
    } catch {
      // per page load then
    }
    return id;
  }
})();

// SPA navigation: wrap history methods and fall back to polling.
function watchLocation(onChange: () => void) {
  let last = location.href;
  const check = () => {
    if (location.href !== last) {
      last = location.href;
      onChange();
    }
  };
  for (const m of ["pushState", "replaceState"] as const) {
    const orig = history[m];
    history[m] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const r = orig.apply(this, args);
      setTimeout(check, 0);
      return r;
    };
  }
  addEventListener("popstate", check);
  addEventListener("hashchange", check);
  setInterval(check, 1000);
}
