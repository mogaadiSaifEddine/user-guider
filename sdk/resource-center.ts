import type { Block, ChecklistContent, RcArticle, RcModule, ResourceCenterContent } from "../src/lib/guide-schema";
import { buttonAt, openUrl, renderBlocks } from "./blocks";
import { LAUNCHER_ICONS, plainText, svgIcon } from "../src/lib/format";
import { el, escapeHtml, richText, safeUrl, shadow } from "./ui";
import type { Handle, Report } from "./widgets";

// The resource center: a launcher in the corner that opens a panel with
// search and the sections the author set up. Guides and checklists come from
// the guides this user can see; anything they can't see is left out.

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
};

type Row = { key: string; icon: keyof typeof ROW_ICONS; label: string; description: string; done?: boolean; text?: string };

export function runResourceCenter(
  content: ResourceCenterContent,
  opts: {
    report: Report;
    guide: (id: string) => RcGuide | null;
    checklist: (id: string) => RcChecklist | null;
    reportChecklist: (checklistId: string, itemId: string) => void;
    startGuide: (id: string) => void;
  },
): RcHandle {
  const layer = el("div", { class: "lg" });
  shadow().appendChild(layer);
  // lg-pos-<vertical>-<side> places both the launcher and the panel (see ui.ts).
  const pos = "lg-pos-" + content.launcher.position + (content.launcher.show ? "" : " lg-nolauncher");
  let panel: HTMLElement | null = null;
  let body: HTMLElement | null = null;
  let query = "";
  let article: RcArticle | null = null;

  const launcher = el("button", {
    class: `lg-launcher lg-rc-launcher ${pos}` + (content.launcher.label ? "" : " lg-round"),
    "aria-expanded": "false",
    "aria-label": content.launcher.label || plainText(content.title) || "Help",
  });
  launcher.addEventListener("click", () => (panel ? close() : open()));
  if (content.launcher.show) layer.appendChild(launcher);
  renderLauncher();

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && panel) close();
  };
  document.addEventListener("keydown", onKey);

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
    const left = remainingItems();
    launcher.innerHTML = `${svgIcon(LAUNCHER_ICONS[content.launcher.icon])}${content.launcher.label ? `<span>${escapeHtml(content.launcher.label)}</span>` : ""}${
      left ? `<span class="lg-badge">${left}</span>` : ""
    }`;
  }

  function open() {
    if (panel) return;
    panel = el("div", { class: `lg-panel lg-rc ${pos}`, role: "dialog", "aria-label": plainText(content.title) || "Help" });
    panel.innerHTML = `<header class="lg-rc-head">
        <button class="lg-close" aria-label="Close">×</button>
        ${content.title ? `<h3>${richText(content.title)}</h3>` : ""}
        ${content.subtitle ? `<p>${richText(content.subtitle)}</p>` : ""}
        ${content.search ? `<input class="lg-rc-search" type="search" placeholder="Search" aria-label="Search help" maxlength="100">` : ""}
      </header>
      <div class="lg-rc-body"></div>`;
    body = panel.querySelector(".lg-rc-body");
    panel.querySelector(".lg-close")!.addEventListener("click", close);
    const search = panel.querySelector<HTMLInputElement>(".lg-rc-search");
    search?.addEventListener("input", () => {
      query = search.value.trim().toLowerCase();
      article = null;
      renderBody();
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
    renderBody();
    search?.focus();
    opts.report("guide_shown");
  }

  function close() {
    panel?.remove();
    panel = body = null;
    query = "";
    article = null;
    launcher.setAttribute("aria-expanded", "false");
  }

  const rowHtml = (r: Row) =>
    `<li class="lg-rc-row${r.done ? " lg-done" : ""}" data-key="${escapeHtml(r.key)}" tabindex="0" role="button">
      <span class="lg-rc-icon">${r.done ? "✓" : svgIcon(ROW_ICONS[r.icon], 16)}</span>
      <span class="lg-rc-text"><span class="lg-title">${richText(r.label)}</span>${r.description ? `<span class="lg-desc">${richText(r.description)}</span>` : ""}</span>
    </li>`;

  const section = (title: string, inner: string) =>
    `<section class="lg-rc-sec">${title ? `<h4>${richText(title)}</h4>` : ""}${inner}</section>`;

  function renderBody() {
    if (!body) return;
    if (article) {
      body.innerHTML = `<div class="lg-rc-article">
          <button class="lg-link lg-rc-back" data-act="back">← Back</button>
          <h3 class="lg-b">${richText(article.title)}</h3>
          ${renderBlocks(article.blocks)}
        </div>`;
      return;
    }
    if (query) {
      const rows = content.modules.flatMap((m) =>
        m.type === "guides" ? guideRows(m) : m.type === "articles" ? articleRows(m) : m.type === "links" ? linkRows(m) : [],
      );
      const hits = rows.filter((r) => plainText(`${r.label} ${r.description} ${r.text ?? ""}`).toLowerCase().includes(query));
      const contact = content.modules.find((m) => m.type === "contact");
      body.innerHTML = hits.length
        ? section("", `<ul class="lg-rc-list">${hits.map(rowHtml).join("")}</ul>`)
        : `<p class="lg-rc-empty">No results for “${escapeHtml(query)}”.</p>${contact ? contactHtml(contact) : ""}`;
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

  function moduleHtml(m: RcModule) {
    switch (m.type) {
      case "guides": {
        const rows = guideRows(m);
        return rows.length ? section(m.title, `<ul class="lg-rc-list">${rows.map(rowHtml).join("")}</ul>`) : "";
      }
      case "articles":
        return m.articles.length ? section(m.title, `<ul class="lg-rc-list">${articleRows(m).map(rowHtml).join("")}</ul>`) : "";
      case "links": {
        const rows = linkRows(m);
        return rows.length ? section(m.title, `<ul class="lg-rc-list">${rows.map(rowHtml).join("")}</ul>`) : "";
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
      article = null;
      return renderBody();
    }
    if (article) {
      const a = buttonAt(article.blocks, target.closest<HTMLElement>("[data-btn]")?.dataset.btn);
      if (!a) return;
      if (a.type === "url") return openUrl(a.url, a.newTab);
      if (a.type === "close") return close();
      if (a.type === "guide" && a.guideId) {
        close();
        return opts.startGuide(a.guideId);
      }
      article = null;
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
      article = m.articles.find((x) => x.id === itemId) ?? null;
      if (!article) return;
      opts.report("resource_clicked", { name: article.id });
      renderBody();
      body?.scrollTo?.(0, 0);
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
      window.dispatchEvent(new CustomEvent("locatify-guides:contact", { detail: { value } }));
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
      if (!article && !query) renderBody();
    },
    stop() {
      close();
      layer.remove();
      document.removeEventListener("keydown", onKey);
    },
  };
}
