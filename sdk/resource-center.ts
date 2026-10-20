import type { Block, ChecklistContent, RcArticle, RcModule, ResourceCenterContent } from "../src/lib/guide-schema";
import type { SdkKbArticle, SdkKbArticleHeader, SdkKbCollection } from "../src/lib/kb";
import { LABEL_STYLES, REACTION_EMOJI, reactionKinds, type ReactionKind, type SdkUpdate, type SdkUpdateHeader, type SdkUpdateList } from "../src/lib/updates";
import { buttonAt, openUrl, renderBlocks } from "./blocks";
import { LAUNCHER_ICONS, plainText, svgIcon } from "../src/lib/format";
import { currentLocale, t, te } from "./i18n";
import { el, escapeHtml, richText, safeUrl, shadow } from "./ui";
import type { Handle, Report } from "./widgets";

// The resource center: a launcher in the corner that opens a panel with
// search and the sections the author set up. Guides and checklists come from
// the guides this user can see; anything they can't see is left out.
// Knowledge base articles load from the server when the panel first opens;
// product updates load right away, for the unread badge on the launcher.

export type RcGuide = { id: string; name: string; completed: boolean };
export type RcChecklist = { content: ChecklistContent; completed: Set<string> };

export type RcHandle = Handle & {
  open(): void;
  close(): void;
  // Progress changed (a tour finished, a checklist item ticked on the server).
  update(): void;
};

const ROW_ICONS = {
  guide: `<path d="M8 5v14l11-7z"/>`,
  article: `<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>`,
  link: `<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`,
  folder: `<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,
  update: `<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>`,
};

type Row = { key: string; icon: keyof typeof ROW_ICONS; label: string; description: string; done?: boolean; text?: string };

type KbModule = Extract<RcModule, { type: "knowledge" }>;
type Kb = { status: "idle" | "loading" | "ready" | "error"; collections: SdkKbCollection[]; articles: SdkKbArticleHeader[] };

type UpdatesModule = Extract<RcModule, { type: "updates" }>;
type Updates = { status: "idle" | "loading" | "ready" | "error"; data: SdkUpdateList | null };
export type RcUser = { id?: string; hash?: string; anonymousId?: string };

type View =
  | null
  | { kind: "update"; id: string; update?: SdkUpdate; error?: boolean; commenting?: boolean }
  | { kind: "article"; article: RcArticle }
  | { kind: "kb"; id: string; article?: SdkKbArticle; error?: boolean }
  | { kind: "collection"; moduleId: string; collectionId: string };

export function runResourceCenter(
  content: ResourceCenterContent,
  opts: {
    report: Report;
    guide: (id: string) => RcGuide | null;
    checklist: (id: string) => RcChecklist | null;
    reportChecklist: (checklistId: string, itemId: string) => void;
    startGuide: (id: string) => void;
    kb: { apiBase: string; key: string };
    user: () => RcUser;
  },
): RcHandle {
  const layer = el("div", { class: "lg" });
  shadow().appendChild(layer);
  // lg-pos-<vertical>-<side> places both the launcher and the panel (see ui.ts).
  const pos = "lg-pos-" + content.launcher.position + (content.launcher.show ? "" : " lg-nolauncher");
  let panel: HTMLElement | null = null;
  let body: HTMLElement | null = null;
  let query = "";
  let view: View = null;
  // The collection an open knowledge base article was opened from, for Back.
  let previousCollection: Extract<View, { kind: "collection" }> | null = null;
  let stopped = false;

  const kbModules = content.modules.filter((m): m is KbModule => m.type === "knowledge");
  const kb: Kb = { status: "idle", collections: [], articles: [] };
  let kbSearch: { q: string; articles: SdkKbArticleHeader[] } | null = null;
  let searchTimer = 0;

  const updatesModules = content.modules.filter((m): m is UpdatesModule => m.type === "updates");
  const updates: Updates = { status: "idle", data: null };
  // Ids unread when the panel opened: they keep their "New" mark until it closes.
  let newThisOpen = new Set<string>();

  const launcher = el("button", {
    class: `lg-launcher lg-rc-launcher ${pos}` + (content.launcher.label ? "" : " lg-round"),
    "aria-expanded": "false",
    "aria-label": content.launcher.label || plainText(content.title) || t("help"),
  });
  launcher.addEventListener("click", () => (panel ? close() : open()));
  if (content.launcher.show) layer.appendChild(launcher);
  renderLauncher();

  // After every helper below is defined.
  queueMicrotask(loadUpdates);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && panel) close();
  };
  document.addEventListener("keydown", onKey);

  // ---------- knowledge base ----------

  // All collections any knowledge section needs; none picked anywhere = all.
  function kbCollectionsParam() {
    if (kbModules.some((m) => !m.collectionIds.length)) return "";
    return [...new Set(kbModules.flatMap((m) => m.collectionIds))].join(",");
  }

  function kbUrl(path: string, params: Record<string, string>) {
    const p = new URLSearchParams({ key: opts.kb.key, locale: currentLocale(), ...params });
    return `${opts.kb.apiBase}/api/sdk/kb${path}?${p}`;
  }

  async function getJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return res.json() as Promise<T>;
  }

  function loadKb() {
    if (!kbModules.length || kb.status === "loading" || kb.status === "ready") return;
    kb.status = "loading";
    const collections = kbCollectionsParam();
    getJson<{ collections: SdkKbCollection[]; articles: SdkKbArticleHeader[] }>(kbUrl("", collections ? { collections } : {}))
      .then((d) => {
        kb.collections = d.collections;
        kb.articles = d.articles;
        kb.status = "ready";
      })
      .catch(() => (kb.status = "error"))
      .finally(() => !stopped && !view && renderBody());
  }

  // Full-text search on the server (bodies, every language), after typing stops.
  function searchKb(q: string) {
    clearTimeout(searchTimer);
    if (!kbModules.length || q.length < 2) return;
    searchTimer = window.setTimeout(() => {
      const collections = kbCollectionsParam();
      getJson<{ articles: SdkKbArticleHeader[] }>(kbUrl("", { q, ...(collections ? { collections } : {}) }))
        .then((d) => {
          if (q !== query) return;
          kbSearch = { q, articles: d.articles };
          if (!view) renderBody();
        })
        .catch(() => {});
    }, 250);
  }

  const inModule = (m: KbModule, collectionId: string | null) =>
    !m.collectionIds.length || (collectionId !== null && m.collectionIds.includes(collectionId));

  const kbRow = (m: KbModule, a: SdkKbArticleHeader): Row => ({ key: `k:${m.id}:${a.id}`, icon: "article", label: a.title, description: a.summary });

  function openKbArticle(id: string) {
    view = { kind: "kb", id };
    renderBody();
    body?.scrollTo?.(0, 0);
    getJson<SdkKbArticle>(kbUrl("/" + encodeURIComponent(id), {}))
      .then((article) => {
        if (view?.kind === "kb" && view.id === id) view = { kind: "kb", id, article };
      })
      .catch(() => {
        if (view?.kind === "kb" && view.id === id) view = { kind: "kb", id, error: true };
      })
      .finally(() => !stopped && view?.kind === "kb" && view.id === id && renderBody());
  }

  // ---------- product updates ----------

  const seenKey = `uo-updates-seen:${opts.kb.key}`;
  function seenIds(): Set<string> {
    try {
      const v = JSON.parse(localStorage.getItem(seenKey) ?? "[]");
      return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
    } catch {
      return new Set();
    }
  }
  function markSeen(ids: string[]) {
    if (!ids.length) return;
    const all = [...new Set([...ids, ...seenIds()])].slice(0, 300);
    try {
      localStorage.setItem(seenKey, JSON.stringify(all));
    } catch {}
  }
  function unreadUpdates() {
    if (!updates.data) return [];
    const seen = seenIds();
    const limit = Math.max(...updatesModules.map((m) => m.limit));
    return updates.data.updates.slice(0, limit).filter((u) => !seen.has(u.id));
  }

  // Opening the panel clears the badge; the posts keep a "New" mark until it closes.
  function markOpenSeen() {
    newThisOpen = new Set(unreadUpdates().map((u) => u.id));
    markSeen([...newThisOpen]);
    renderLauncher();
  }

  function loadUpdates() {
    if (!updatesModules.length || updates.status !== "idle") return;
    updates.status = "loading";
    const limit = String(Math.max(...updatesModules.map((m) => m.limit)));
    getJson<SdkUpdateList>(`${opts.kb.apiBase}/api/sdk/updates?${new URLSearchParams({ key: opts.kb.key, locale: currentLocale(), limit })}`)
      .then((d) => {
        updates.data = d;
        updates.status = "ready";
      })
      .catch(() => (updates.status = "error"))
      .finally(() => {
        if (stopped) return;
        renderLauncher();
        if (panel) {
          markOpenSeen();
          if (!view) renderBody();
        }
      });
  }

  function updateUrl(id: string) {
    const u = opts.user();
    const p = new URLSearchParams({ key: opts.kb.key, locale: currentLocale() });
    if (u.id) p.set("uid", u.id);
    else if (u.anonymousId) p.set("aid", u.anonymousId);
    if (u.hash) p.set("hash", u.hash);
    return `${opts.kb.apiBase}/api/sdk/updates/${encodeURIComponent(id)}?${p}`;
  }

  function openUpdate(id: string) {
    view = { kind: "update", id };
    renderBody();
    body?.scrollTo?.(0, 0);
    getJson<SdkUpdate>(updateUrl(id))
      .then((update) => {
        if (view?.kind === "update" && view.id === id) view = { kind: "update", id, update };
      })
      .catch(() => {
        if (view?.kind === "update" && view.id === id) view = { kind: "update", id, error: true };
      })
      .finally(() => !stopped && view?.kind === "update" && view.id === id && renderBody());
  }

  // reaction null: take it back. A comment is sent on its own after reacting.
  function react(reaction: ReactionKind | null, comment?: string) {
    if (view?.kind !== "update" || !view.update) return;
    view.update = { ...view.update, reaction, ...(comment !== undefined ? { comment } : {}) };
    view.commenting = Boolean(reaction) && comment === undefined;
    renderBody();
    fetch(`${opts.kb.apiBase}/api/sdk/updates/${encodeURIComponent(view.id)}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ key: opts.kb.key, user: opts.user(), reaction, ...(comment !== undefined ? { comment } : {}) }),
    }).catch(() => {});
  }

  function updateDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(currentLocale(), { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return iso.slice(0, 10);
    }
  }

  const labelsHtml = (u: SdkUpdateHeader) =>
    u.labels
      .map((l) => `<span class="lg-label" style="color:${LABEL_STYLES[l.color].fg};background:${LABEL_STYLES[l.color].bg}">${escapeHtml(l.name)}</span>`)
      .join("");

  const updateRowHtml = (m: UpdatesModule, u: SdkUpdateHeader) =>
    `<li class="lg-rc-row lg-rc-update" data-key="u:${escapeHtml(m.id)}:${escapeHtml(u.id)}" tabindex="0" role="button">
      <span class="lg-rc-icon">${svgIcon(ROW_ICONS.update, 16)}</span>
      <span class="lg-rc-text">
        <span class="lg-rc-meta">${newThisOpen.has(u.id) ? `<span class="lg-new">${te("newUpdate")}</span>` : ""}${labelsHtml(u)}<span>${escapeHtml(updateDate(u.publishedAt))}</span></span>
        <span class="lg-title">${richText(u.title)}</span>${u.summary ? `<span class="lg-desc">${richText(u.summary)}</span>` : ""}
      </span>
    </li>`;

  function updatesHtml(m: UpdatesModule) {
    if (updates.status === "loading" || updates.status === "idle") return section(m.title, `<p class="lg-rc-note">${te("loading")}</p>`);
    if (updates.status === "error") return section(m.title, `<p class="lg-rc-note">${te("loadError")}</p>`);
    const shown = updates.data!.updates.slice(0, m.limit);
    if (!shown.length) return "";
    const page = updates.data!.pageUrl ? safeUrl(updates.data!.pageUrl) : "";
    return section(
      m.title,
      `<ul class="lg-rc-list">${shown.map((u) => updateRowHtml(m, u)).join("")}</ul>${
        page ? `<a class="lg-link lg-rc-all" href="${page}" target="_blank" rel="noopener">${te("allUpdates")} →</a>` : ""
      }`,
    );
  }

  function updateViewHtml(u: SdkUpdate, commenting: boolean) {
    const cover = safeUrl(u.coverUrl);
    const reactions = updates.data?.reactions ?? true;
    const buttons = reactionKinds
      .map(
        (k) =>
          `<button class="lg-react-btn${u.reaction === k ? " lg-on" : u.reaction ? " lg-dim" : ""}" data-react="${k}" aria-pressed="${u.reaction === k}" aria-label="${k}">${REACTION_EMOJI[k]}</button>`,
      )
      .join("");
    return `<div class="lg-rc-article lg-rc-post">
        ${backButton}
        ${cover ? `<img class="lg-rc-cover" src="${cover}" alt="">` : ""}
        <div class="lg-rc-meta">${labelsHtml(u)}<span>${escapeHtml(updateDate(u.publishedAt))}</span></div>
        <h3 class="lg-b">${richText(u.title)}</h3>
        ${renderBlocks(u.blocks)}
        ${
          reactions
            ? `<div class="lg-react">
          <p>${te(u.reaction ? "reactThanks" : "reactPrompt")}</p>
          <div class="lg-react-row">${buttons}</div>
          ${
            commenting
              ? `<textarea class="lg-react-comment" maxlength="2000" rows="2" placeholder="${te("reactComment")}"></textarea><button class="lg-btn" data-act="comment">${te("send")}</button>`
              : ""
          }
        </div>`
            : ""
        }
      </div>`;
  }

  // ---------- data ----------

  const articleText = (a: RcArticle) =>
    a.blocks
      .map((b: Block) => (b.type === "heading" || b.type === "text" ? b.text : ""))
      .join(" ")
      .toLowerCase();

  function guideRows(m: Extract<RcModule, { type: "guides" }>): Row[] {
    return m.items.flatMap((it) => {
      const g = opts.guide(it.guideId);
      return g ? [{ key: `g:${m.id}:${it.id}`, icon: "guide" as const, label: it.label || g.name, description: it.description, done: g.completed }] : [];
    });
  }

  const articleRows = (m: Extract<RcModule, { type: "articles" }>): Row[] =>
    m.articles.map((a) => ({ key: `a:${m.id}:${a.id}`, icon: "article", label: a.title, description: a.summary, text: articleText(a) }));

  const linkRows = (m: Extract<RcModule, { type: "links" }>): Row[] =>
    m.links.filter((l) => safeUrl(l.url)).map((l) => ({ key: `l:${m.id}:${l.id}`, icon: "link", label: l.label, description: l.description }));

  function remainingItems() {
    let left = 0;
    for (const m of content.modules) {
      if (m.type !== "checklist") continue;
      const c = opts.checklist(m.guideId);
      if (c) left += c.content.items.filter((i) => !c.completed.has(i.id)).length;
    }
    return left;
  }

  // ---------- rendering ----------

  function renderLauncher() {
    const left = remainingItems() + unreadUpdates().length;
    launcher.innerHTML = `${svgIcon(LAUNCHER_ICONS[content.launcher.icon])}${content.launcher.label ? `<span>${escapeHtml(content.launcher.label)}</span>` : ""}${
      left ? `<span class="lg-badge">${left}</span>` : ""
    }`;
  }

  function open() {
    if (panel) return;
    panel = el("div", { class: `lg-panel lg-rc ${pos}`, role: "dialog", "aria-label": plainText(content.title) || t("help") });
    panel.innerHTML = `<header class="lg-rc-head">
        <button class="lg-close" aria-label="${te("close")}">×</button>
        ${content.title ? `<h3>${richText(content.title)}</h3>` : ""}
        ${content.subtitle ? `<p>${richText(content.subtitle)}</p>` : ""}
        ${content.search ? `<input class="lg-rc-search" type="search" placeholder="${te("search")}" aria-label="${te("searchHelp")}" maxlength="100">` : ""}
      </header>
      <div class="lg-rc-body"></div>`;
    body = panel.querySelector(".lg-rc-body");
    panel.querySelector(".lg-close")!.addEventListener("click", close);
    const search = panel.querySelector<HTMLInputElement>(".lg-rc-search");
    search?.addEventListener("input", () => {
      query = search.value.trim().toLowerCase();
      view = null;
      renderBody();
      searchKb(query);
    });
    body!.addEventListener("click", onBodyClick);
    body!.addEventListener("keydown", (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>("[data-key]");
      if (row && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        row.click();
      }
    });
    layer.appendChild(panel);
    launcher.setAttribute("aria-expanded", "true");
    loadKb();
    if (updates.status === "ready") markOpenSeen();
    renderBody();
    search?.focus();
    opts.report("guide_shown");
  }

  function close() {
    clearTimeout(searchTimer);
    panel?.remove();
    panel = body = null;
    query = "";
    kbSearch = null;
    view = null;
    newThisOpen = new Set();
    launcher.setAttribute("aria-expanded", "false");
  }

  const rowHtml = (r: Row) =>
    `<li class="lg-rc-row${r.done ? " lg-done" : ""}" data-key="${escapeHtml(r.key)}" tabindex="0" role="button">
      <span class="lg-rc-icon">${r.done ? "✓" : svgIcon(ROW_ICONS[r.icon], 16)}</span>
      <span class="lg-rc-text"><span class="lg-title">${richText(r.label)}</span>${r.description ? `<span class="lg-desc">${richText(r.description)}</span>` : ""}</span>
    </li>`;

  const section = (title: string, inner: string) =>
    `<section class="lg-rc-sec">${title ? `<h4>${richText(title)}</h4>` : ""}${inner}</section>`;

  const list = (rows: Row[]) => `<ul class="lg-rc-list">${rows.map(rowHtml).join("")}</ul>`;
  const backButton = `<button class="lg-link lg-rc-back" data-act="back">← ${te("back")}</button>`;

  function renderBody() {
    if (!body) return;
    if (view?.kind === "update") {
      body.innerHTML = view.update
        ? updateViewHtml(view.update, Boolean(view.commenting))
        : `<div class="lg-rc-article">${backButton}<p class="lg-rc-note">${te(view.error ? "loadError" : "loading")}</p></div>`;
      return;
    }
    if (view?.kind === "article" || (view?.kind === "kb" && view.article)) {
      const a = view.kind === "article" ? view.article : view.article!;
      body.innerHTML = `<div class="lg-rc-article">
          ${backButton}
          <h3 class="lg-b">${richText(a.title)}</h3>
          ${renderBlocks(a.blocks)}
        </div>`;
      return;
    }
    if (view?.kind === "kb") {
      body.innerHTML = `<div class="lg-rc-article">${backButton}<p class="lg-rc-note">${te(view.error ? "loadError" : "loading")}</p></div>`;
      return;
    }
    if (view?.kind === "collection") {
      const { moduleId, collectionId } = view;
      const m = kbModules.find((x) => x.id === moduleId);
      const c = kb.collections.find((x) => x.id === collectionId);
      const rows = m && c ? kb.articles.filter((a) => a.collectionId === c.id).map((a) => kbRow(m, a)) : [];
      body.innerHTML = `<div class="lg-rc-article">${backButton}${c ? `<h3 class="lg-b">${escapeHtml(c.name)}</h3>` : ""}${
        c?.description ? `<p class="lg-rc-note" style="margin:0 0 8px">${escapeHtml(c.description)}</p>` : ""
      }</div>${section("", list(rows))}`;
      return;
    }
    if (query) {
      const rows = content.modules.flatMap((m): Row[] =>
        m.type === "guides"
          ? guideRows(m)
          : m.type === "articles"
            ? articleRows(m)
            : m.type === "links"
              ? linkRows(m)
              : m.type === "updates"
                ? (updates.data?.updates ?? []).slice(0, m.limit).map((u) => ({ key: `u:${m.id}:${u.id}`, icon: "update", label: u.title, description: u.summary }))
                : [],
      );
      const hits = rows.filter((r) => plainText(`${r.label} ${r.description} ${r.text ?? ""}`).toLowerCase().includes(query));
      // Knowledge base: titles and summaries we already have, then the server's full-text hits.
      const seen = new Set<string>();
      for (const m of kbModules) {
        const local = kb.articles.filter((a) => inModule(m, a.collectionId) && plainText(`${a.title} ${a.summary}`).toLowerCase().includes(query));
        const remote = kbSearch?.q === query ? kbSearch.articles.filter((a) => inModule(m, a.collectionId)) : [];
        for (const a of [...local, ...remote]) {
          if (seen.has(a.id)) continue;
          seen.add(a.id);
          hits.push(kbRow(m, a));
        }
      }
      const contact = content.modules.find((m) => m.type === "contact");
      body.innerHTML = hits.length
        ? section("", list(hits))
        : `<p class="lg-rc-empty">${te("noResults", { q: query })}</p>${contact ? contactHtml(contact) : ""}`;
      return;
    }
    body.innerHTML = content.modules.map(moduleHtml).join("");
  }

  function contactHtml(m: Extract<RcModule, { type: "contact" }>) {
    return section(
      m.title,
      `${m.text ? `<p class="lg-rc-note">${richText(m.text)}</p>` : ""}<button class="lg-btn" data-contact="${escapeHtml(m.id)}">${escapeHtml(m.buttonLabel)}</button>`,
    );
  }

  function knowledgeHtml(m: KbModule) {
    if (kb.status === "loading" || kb.status === "idle") return section(m.title, `<p class="lg-rc-note">${te("loading")}</p>`);
    if (kb.status === "error") return section(m.title, `<p class="lg-rc-note">${te("loadError")}</p>`);
    const collections = kb.collections.filter((c) => inModule(m, c.id));
    const articles = kb.articles.filter((a) => inModule(m, a.collectionId));
    if (!articles.length) return "";
    // Several collections: browse by collection; loose articles follow.
    if (collections.length > 1) {
      const rows: Row[] = collections.map((c) => ({ key: `kc:${m.id}:${c.id}`, icon: "folder", label: escapeMarkup(c.name), description: escapeMarkup(c.description) }));
      const loose = articles.filter((a) => !a.collectionId || !collections.some((c) => c.id === a.collectionId)).map((a) => kbRow(m, a));
      return section(m.title, list([...rows, ...loose]));
    }
    return section(m.title, list(articles.map((a) => kbRow(m, a))));
  }

  function moduleHtml(m: RcModule) {
    switch (m.type) {
      case "guides": {
        const rows = guideRows(m);
        return rows.length ? section(m.title, list(rows)) : "";
      }
      case "articles":
        return m.articles.length ? section(m.title, list(articleRows(m))) : "";
      case "knowledge":
        return knowledgeHtml(m);
      case "updates":
        return updatesHtml(m);
      case "links": {
        const rows = linkRows(m);
        return rows.length ? section(m.title, list(rows)) : "";
      }
      case "contact":
        return contactHtml(m);
      case "checklist": {
        const c = opts.checklist(m.guideId);
        if (!c || !c.content.items.length) return "";
        const total = c.content.items.length;
        const done = c.content.items.filter((i) => c.completed.has(i.id)).length;
        return section(
          c.content.title,
          `<div class="lg-rc-progress"><div class="lg-progress"><span style="width:${(done / total) * 100}%"></span></div><span>${done}/${total}</span></div>
           <ul class="lg-items lg-rc-checklist">${c.content.items
             .map(
               (i) => `<li class="lg-item${c.completed.has(i.id) ? " lg-done" : ""}" data-key="c:${escapeHtml(m.guideId)}:${escapeHtml(i.id)}" tabindex="0" role="button">
                 <span class="lg-check">${c.completed.has(i.id) ? "✓" : ""}</span>
                 <span><div class="lg-title">${richText(i.title)}</div>${i.description ? `<div class="lg-desc">${richText(i.description)}</div>` : ""}</span>
               </li>`,
             )
             .join("")}</ul>`,
        );
      }
    }
  }

  // ---------- clicks ----------

  function onBodyClick(e: Event) {
    const target = e.target as HTMLElement;
    if (target.closest('[data-act="back"]')) {
      // From an article opened inside a collection, back to the collection.
      view = view?.kind === "kb" && previousCollection ? previousCollection : null;
      previousCollection = null;
      return renderBody();
    }
    if (view?.kind === "update" && view.update) {
      const r = target.closest<HTMLElement>("[data-react]")?.dataset.react as ReactionKind | undefined;
      if (r) return react(view.update.reaction === r ? null : r);
      if (target.closest('[data-act="comment"]')) {
        const text = body?.querySelector<HTMLTextAreaElement>(".lg-react-comment")?.value.trim() ?? "";
        if (text) react(view.update.reaction, text);
        return;
      }
    }
    const blocks =
      view?.kind === "article"
        ? view.article.blocks
        : view?.kind === "kb"
          ? view.article?.blocks
          : view?.kind === "update"
            ? view.update?.blocks
            : undefined;
    if (blocks) {
      const a = buttonAt(blocks, target.closest<HTMLElement>("[data-btn]")?.dataset.btn);
      if (!a) return;
      if (a.type === "url") return openUrl(a.url, a.newTab);
      if (a.type === "close") return close();
      if (a.type === "guide" && a.guideId) {
        close();
        return opts.startGuide(a.guideId);
      }
      view = null;
      return renderBody();
    }
    const contactId = target.closest<HTMLElement>("[data-contact]")?.dataset.contact;
    if (contactId) return contact(contactId);
    const key = target.closest<HTMLElement>("[data-key]")?.dataset.key;
    if (key) activate(key);
  }

  function activate(key: string) {
    const [kind, moduleId, itemId] = key.split(":");
    if (kind === "c") return clickChecklistItem(moduleId, itemId);
    const m = content.modules.find((x) => x.id === moduleId);
    if (!m) return;
    if (kind === "g" && m.type === "guides") {
      const it = m.items.find((x) => x.id === itemId);
      if (!it) return;
      opts.report("resource_clicked", { name: it.id });
      close();
      opts.startGuide(it.guideId);
    } else if (kind === "a" && m.type === "articles") {
      const article = m.articles.find((x) => x.id === itemId);
      if (!article) return;
      view = { kind: "article", article };
      opts.report("resource_clicked", { name: article.id });
      renderBody();
      body?.scrollTo?.(0, 0);
    } else if (kind === "u" && m.type === "updates") {
      opts.report("resource_clicked", { name: itemId });
      openUpdate(itemId);
    } else if (kind === "kc" && m.type === "knowledge") {
      view = { kind: "collection", moduleId, collectionId: itemId };
      renderBody();
      body?.scrollTo?.(0, 0);
    } else if (kind === "k" && m.type === "knowledge") {
      previousCollection = view?.kind === "collection" ? view : null;
      opts.report("resource_clicked", { name: itemId });
      openKbArticle(itemId);
    } else if (kind === "l" && m.type === "links") {
      const l = m.links.find((x) => x.id === itemId);
      if (!l) return;
      opts.report("resource_clicked", { name: l.id });
      openUrl(l.url, l.newTab);
    }
  }

  function clickChecklistItem(checklistId: string, itemId: string) {
    const c = opts.checklist(checklistId);
    const item = c?.content.items.find((i) => i.id === itemId);
    if (!c || !item) return;
    if (item.completeOn.type === "click" && !c.completed.has(itemId)) opts.reportChecklist(checklistId, itemId);
    if (item.action.type === "tour") {
      close();
      opts.startGuide(item.action.guideId);
    } else if (item.action.type === "url" && safeUrl(item.action.url)) {
      location.href = item.action.url.trim();
    } else {
      renderBody();
      renderLauncher();
    }
  }

  function contact(moduleId: string) {
    const m = content.modules.find((x) => x.id === moduleId);
    if (!m || m.type !== "contact") return;
    opts.report("resource_clicked", { name: m.id });
    const value = m.value.trim();
    if (m.action === "event") {
      close();
      window.dispatchEvent(new CustomEvent("user-onboarder:contact", { detail: { value } }));
    } else if (m.action === "email") {
      if (value) location.href = "mailto:" + encodeURIComponent(value).replace(/%40/g, "@");
    } else {
      openUrl(value, true);
    }
  }

  return {
    open,
    close,
    update() {
      renderLauncher();
      // Don't yank an open article or search away from the reader.
      if (!view && !query) renderBody();
    },
    stop() {
      stopped = true;
      close();
      layer.remove();
      document.removeEventListener("keydown", onKey);
    },
  };
}

// Collection names are plain text; rows render labels as rich text.
function escapeMarkup(s: string) {
  return s.replace(/[\\*_~+[\]]/g, "\\$&");
}
