import { richText } from "./format";

// A small WYSIWYG editor for guide text, with no framework so the dashboard
// (src/components/rich-text-input.tsx) and the builder inside the SDK's shadow
// root (sdk/builder.ts) share it. What people see is richText(value); what is
// stored is the light markup described in format.ts, so the SDK, the AI and
// the UserGuiding import keep reading plain strings.

export type RichEditorOptions = {
  value: string;
  onChange: (value: string) => void;
  // Line breaks and lists. Off for titles and labels: Enter does nothing.
  multiline?: boolean;
  // Visible height of a multiline editor, in lines.
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  label?: string;
};

export type RichEditor = { setValue(value: string): void; focus(): void; destroy(): void };

type Command = "bold" | "italic" | "underline" | "strikeThrough" | "insertUnorderedList" | "insertOrderedList";

const ICON = (d: string) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const TOOLS: { id: Command | "link" | "clear"; title: string; html: string; multiline?: boolean }[] = [
  { id: "bold", title: "Bold (Ctrl+B)", html: "<b>B</b>" },
  { id: "italic", title: "Italic (Ctrl+I)", html: '<i style="font-family:Georgia,serif">I</i>' },
  { id: "underline", title: "Underline (Ctrl+U)", html: "<u>U</u>" },
  { id: "strikeThrough", title: "Strikethrough (Ctrl+Shift+X)", html: "<s>S</s>" },
  { id: "link", title: "Link (Ctrl+K)", html: ICON('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>') },
  {
    id: "insertUnorderedList",
    title: "Bulleted list",
    multiline: true,
    html: ICON('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>'),
  },
  {
    id: "insertOrderedList",
    title: "Numbered list",
    multiline: true,
    html: ICON('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 4.5h1.2V9M3.8 9h2.6M3.8 14.2c.3-.6.9-.9 1.5-.8.7.1 1.1.7.9 1.3-.2.6-1.2 1.2-2.4 2.3h2.6"/>'),
  },
  { id: "clear", title: "Clear formatting", html: ICON('<path d="M6 5h12M12 5l-3 14M4 20l16-16"/>') },
];

export function mountRichEditor(host: HTMLElement, opts: RichEditorOptions): RichEditor {
  ensureCss(host);
  const multiline = opts.multiline ?? false;
  let current = opts.value;
  let savedRange: Range | null = null;

  const wrap = document.createElement("div");
  wrap.className = "rte" + (multiline ? "" : " rte-inline");
  wrap.innerHTML = `<div class="rte-bar" role="toolbar" aria-label="Formatting">${TOOLS.filter((t) => multiline || !t.multiline)
    .map((t) =>
      t.id === "clear" || t.id === "link"
        ? `${t.id === "link" ? "" : '<span class="rte-sep"></span>'}<button type="button" class="rte-btn" data-cmd="${t.id}" title="${t.title}" aria-label="${t.title}">${t.html}</button>`
        : `<button type="button" class="rte-btn" data-cmd="${t.id}" title="${t.title}" aria-label="${t.title}" aria-pressed="false">${t.html}</button>`,
    )
    .join("")}</div>
    <div class="rte-link" hidden>
      <input type="url" placeholder="https://… or /page" aria-label="Link address">
      <button type="button" class="rte-small rte-primary" data-link="apply">Apply</button>
      <button type="button" class="rte-small" data-link="remove">Remove</button>
      <button type="button" class="rte-small" data-link="cancel">Cancel</button>
    </div>
    <div class="rte-area" contenteditable="true" role="textbox" spellcheck="true"></div>
    <div class="rte-count" hidden></div>`;
  host.replaceChildren(wrap);

  const bar = wrap.querySelector<HTMLElement>(".rte-bar")!;
  const area = wrap.querySelector<HTMLElement>(".rte-area")!;
  const linkRow = wrap.querySelector<HTMLElement>(".rte-link")!;
  const linkInput = linkRow.querySelector("input")!;
  const count = wrap.querySelector<HTMLElement>(".rte-count")!;
  area.setAttribute("aria-multiline", String(multiline));
  if (opts.label) area.setAttribute("aria-label", opts.label);
  if (opts.placeholder) area.dataset.placeholder = opts.placeholder;
  if (multiline) area.style.minHeight = `calc(${opts.rows ?? 3} * 1.5em + 12px)`;

  const selection = () => {
    const root = area.getRootNode() as Document | (ShadowRoot & { getSelection?: () => Selection | null });
    return root.getSelection?.() ?? document.getSelection();
  };
  const exec = (cmd: string, arg?: string) => document.execCommand(cmd, false, arg);

  function render(value: string) {
    area.innerHTML = richText(value);
    refresh();
  }

  function refresh() {
    area.classList.toggle("rte-empty", current === "");
    if (opts.maxLength) {
      const near = current.length > opts.maxLength * 0.8;
      count.hidden = !near;
      count.textContent = current.length > opts.maxLength ? `Too long: ${current.length} / ${opts.maxLength}` : `${current.length} / ${opts.maxLength}`;
      count.classList.toggle("rte-over", current.length > opts.maxLength);
    }
  }

  function emit() {
    const next = htmlToRichText(area, multiline);
    if (next === current) return refresh();
    current = next;
    refresh();
    opts.onChange(next);
  }

  // Which buttons light up for the text at the caret.
  function updateState() {
    const sel = selection();
    const node = sel?.anchorNode;
    if (!node || !area.contains(node)) return;
    const on = new Set<string>();
    for (let n: Node | null = node; n && n !== area; n = n.parentNode) {
      if (!(n instanceof HTMLElement)) continue;
      const m = marksOf(n);
      if (m.b) on.add("bold");
      if (m.i) on.add("italic");
      if (m.u) on.add("underline");
      if (m.s) on.add("strikeThrough");
      if (m.href) on.add("link");
      if (n.tagName === "UL") on.add("insertUnorderedList");
      if (n.tagName === "OL") on.add("insertOrderedList");
    }
    for (const b of bar.querySelectorAll<HTMLElement>("[aria-pressed]")) b.setAttribute("aria-pressed", String(on.has(b.dataset.cmd!)));
    bar.querySelector('[data-cmd="link"]')?.classList.toggle("rte-on", on.has("link"));
  }

  function saveRange() {
    const sel = selection();
    savedRange = sel && sel.rangeCount && area.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  }

  function restoreRange() {
    area.focus();
    const sel = selection();
    if (sel && savedRange) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  }

  function linkAtCaret() {
    const sel = selection();
    for (let n: Node | null | undefined = sel?.anchorNode; n && n !== area; n = n.parentNode) {
      if (n instanceof HTMLAnchorElement) return n;
    }
    return null;
  }

  function openLink() {
    saveRange();
    linkInput.value = linkAtCaret()?.getAttribute("href") ?? "";
    linkRow.hidden = false;
    linkInput.focus();
    linkInput.select();
  }

  function closeLink() {
    linkRow.hidden = true;
    restoreRange();
  }

  function applyLink() {
    const url = linkInput.value.trim();
    if (url && !/^(https?:\/\/|\/(?!\/)|mailto:)/i.test(url)) {
      linkInput.setCustomValidity("Use an address starting with https://, / or mailto:");
      linkInput.reportValidity();
      return;
    }
    linkRow.hidden = true;
    restoreRange();
    if (!url) exec("unlink");
    else if (savedRange?.collapsed && !linkAtCaret()) exec("insertHTML", `<a href="${escapeAttr(url)}">${escapeAttr(url)}</a>`);
    else exec("createLink", url);
    emit();
  }

  const onBarDown = (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-cmd]");
    if (!btn) return;
    // Keep the selection in the text while clicking the toolbar.
    e.preventDefault();
    const cmd = btn.dataset.cmd!;
    if (cmd === "link") return openLink();
    if (!area.contains(selection()?.anchorNode ?? null)) area.focus();
    if (cmd === "clear") {
      exec("removeFormat");
      exec("unlink");
    } else exec(cmd);
    emit();
    updateState();
  };

  const onKey = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "Enter" && !multiline) return e.preventDefault();
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openLink();
    } else if (mod && e.shiftKey && e.key.toLowerCase() === "x") {
      e.preventDefault();
      exec("strikeThrough");
      emit();
    }
  };

  // Pasted HTML keeps only what the stored format can hold; everything else becomes text.
  const onPaste = (e: ClipboardEvent) => {
    const data = e.clipboardData;
    if (!data) return;
    e.preventDefault();
    const html = data.getData("text/html");
    if (html) {
      const body = new DOMParser().parseFromString(html, "text/html").body;
      let text = htmlToRichText(body, multiline);
      if (!multiline) text = text.replace(/\s*\n\s*/g, " ");
      exec("insertHTML", richText(text));
    } else {
      const text = data.getData("text/plain");
      exec("insertText", multiline ? text : text.replace(/\s*\n\s*/g, " "));
    }
    emit();
  };

  const onLinkKey = (e: KeyboardEvent) => {
    linkInput.setCustomValidity("");
    if (e.key === "Enter") {
      e.preventDefault();
      applyLink();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeLink();
    }
  };

  const onLinkClick = (e: MouseEvent) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>("[data-link]")?.dataset.link;
    if (act === "apply") applyLink();
    else if (act === "cancel") closeLink();
    else if (act === "remove") {
      linkRow.hidden = true;
      restoreRange();
      exec("unlink");
      emit();
    }
  };

  // Links inside the editor are for editing, not following.
  const onAreaClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) e.preventDefault();
  };

  const onSelection = () => updateState();

  bar.addEventListener("mousedown", onBarDown);
  area.addEventListener("input", emit);
  area.addEventListener("keydown", onKey);
  area.addEventListener("paste", onPaste);
  area.addEventListener("click", onAreaClick);
  area.addEventListener("keyup", onSelection);
  area.addEventListener("mouseup", onSelection);
  linkInput.addEventListener("keydown", onLinkKey);
  linkRow.addEventListener("click", onLinkClick);
  document.addEventListener("selectionchange", onSelection);
  render(current);

  return {
    setValue(value) {
      if (value === current) return;
      current = value;
      render(value);
    },
    focus() {
      area.focus();
      // Caret at the end.
      const sel = selection();
      if (sel) {
        sel.selectAllChildren(area);
        sel.collapseToEnd();
      }
    },
    destroy() {
      document.removeEventListener("selectionchange", onSelection);
      wrap.remove();
    },
  };
}

// ---------- HTML → stored text ----------

type Marks = { b: boolean; i: boolean; u: boolean; s: boolean; href: string | null };
type Seg = { text: string; marks: Marks };
type Line = { kind: "p" | "ul" | "ol"; segs: Seg[] };

const BLOCKS = new Set(["DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "SECTION", "ARTICLE", "HEADER", "FOOTER", "TABLE", "TR"]);
const SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "HEAD", "TITLE", "META"]);

function marksOf(el: HTMLElement): Partial<Marks> {
  const t = el.tagName;
  const st = el.style;
  const weight = st.fontWeight;
  const deco = `${st.textDecoration} ${st.textDecorationLine}`;
  const m: Partial<Marks> = {};
  if (t === "B" || t === "STRONG" || weight === "bold" || weight === "bolder" || Number(weight) >= 600) m.b = true;
  if (weight === "normal" || (weight && Number(weight) > 0 && Number(weight) < 600)) m.b = false;
  if (t === "I" || t === "EM" || st.fontStyle === "italic") m.i = true;
  if (t === "U" || t === "INS" || deco.includes("underline")) m.u = true;
  if (t === "S" || t === "STRIKE" || t === "DEL" || deco.includes("line-through")) m.s = true;
  if (t === "A" && el.getAttribute("href")) m.href = el.getAttribute("href")!.trim();
  return m;
}

export function htmlToRichText(root: Node, multiline = true): string {
  const lines: Line[] = [{ kind: "p", segs: [] }];
  const cur = () => lines[lines.length - 1];
  const empty = () => cur().segs.every((s) => !s.text.trim());
  const newLine = (kind: Line["kind"] = "p") => {
    if (empty() && cur().kind === "p" && kind !== "p") cur().kind = kind;
    else lines.push({ kind, segs: [] });
  };
  const hasContent = (n: Node) => (n.textContent ?? "").replace(/\u00a0/g, " ").trim() !== "";

  const walk = (node: Node, marks: Marks) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.nodeValue ?? "").replace(/\u00a0/g, " ").replace(/[\r\n\t]+/g, " ");
      if (text) cur().segs.push({ text, marks });
      return;
    }
    if (!(node instanceof Element) || SKIP.has(node.tagName)) return;
    const tag = node.tagName;
    if (tag === "BR") {
      // A trailing <br> only keeps an otherwise empty block open.
      const parent = node.parentNode;
      if (!node.nextSibling && parent && parent !== root && hasContent(parent)) return;
      if (!node.nextSibling && parent === root && hasContent(root)) return;
      if (cur().kind !== "p") cur().segs.push({ text: " ", marks });
      else newLine();
      return;
    }
    const m = node instanceof HTMLElement ? { ...marks, ...marksOf(node) } : marks;
    if (tag === "UL" || tag === "OL") {
      for (const li of node.childNodes) {
        if (li instanceof Element && li.tagName === "LI") {
          newLine(tag === "UL" ? "ul" : "ol");
          for (const c of li.childNodes) walk(c, m);
        } else walk(li, m);
      }
      newLine();
      return;
    }
    const block = BLOCKS.has(tag) || tag === "LI";
    if (block && !empty()) newLine();
    if (tag === "LI") cur().kind = "ul";
    for (const c of node.childNodes) walk(c, m);
    if (block && !empty()) newLine();
  };

  for (const c of root.childNodes) walk(c, { b: false, i: false, u: false, s: false, href: null });

  let ol = 0;
  const out = lines.flatMap((line) => {
    const text = lineText(line.segs).trim();
    if (line.kind !== "p" && !text) return [];
    if (line.kind === "ul") {
      ol = 0;
      return multiline ? `- ${text}` : text;
    }
    if (line.kind === "ol") return multiline ? `${++ol}. ${text}` : text;
    ol = 0;
    // A paragraph that would read as a list item keeps its dash or number.
    return [text.replace(/^([-•])( )/, "\\$1$2").replace(/^(\d{1,3})\.( )/, "$1\\.$2")];
  });
  while (out.length && out[out.length - 1] === "") out.pop();
  while (out.length && out[0] === "") out.shift();
  return multiline ? out.join("\n") : out.join(" ").replace(/\s+/g, " ").trim();
}

const sameMarks = (a: Marks, b: Marks) => a.b === b.b && a.i === b.i && a.u === b.u && a.s === b.s && a.href === b.href;
const isWord = (c: string | undefined) => Boolean(c && /[\p{L}\p{N}]/u.test(c));

function escapeText(t: string) {
  return t
    .replace(/[\\*[\]]/g, "\\$&")
    .replace(/\+\+/g, "\\+\\+")
    .replace(/~~/g, "\\~\\~")
    .replace(/_/g, (_, off: number, s: string) => (isWord(s[off - 1]) && isWord(s[off + 1]) ? "_" : "\\_"));
}

function lineText(segs: Seg[]) {
  const merged: Seg[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && sameMarks(last.marks, s.marks)) last.text += s.text;
    else merged.push({ ...s });
  }
  return merged
    .map(({ text, marks }) => {
      // Markers hug the words: "**bold** " rather than "**bold **".
      const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
      if (!core) return text;
      let out = escapeText(core);
      if (marks.b) out = `**${out}**`;
      if (marks.u) out = `++${out}++`;
      if (marks.s) out = `~~${out}~~`;
      // _x_ around bold keeps ***x*** from being ambiguous; *x* works next to letters.
      if (marks.i) out = marks.b ? `_${out}_` : `*${out}*`;
      if (marks.href && /^(https?:\/\/|\/(?!\/)|mailto:)/i.test(marks.href)) out = `[${out}](${marks.href.replace(/[()\s]/g, encodeURIComponent)})`;
      return lead + out + trail;
    })
    .join("")
    .replace(/ {2,}/g, " ");
}

function escapeAttr(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// ---------- Styles ----------

function ensureCss(host: HTMLElement) {
  const root = host.getRootNode();
  const target = root instanceof ShadowRoot ? root : document.head;
  if (target.querySelector("style[data-rte]")) return;
  const style = document.createElement("style");
  style.dataset.rte = "";
  style.textContent = RICH_EDITOR_CSS;
  target.appendChild(style);
}

const RICH_EDITOR_CSS = `
.rte { position:relative; display:block; width:100%; border:1px solid #d1d5db; border-radius:6px; background:#fff; color:#111827;
  font:14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; text-align:left; }
.rte:focus-within { border-color:#7c5cff; box-shadow:0 0 0 1px #7c5cff; }
.rte-bar { display:flex; flex-wrap:wrap; align-items:center; gap:1px; padding:3px 4px; border-bottom:1px solid #f1f5f9; background:#fafafa;
  border-radius:6px 6px 0 0; }
.rte-inline:not(:focus-within) .rte-bar { display:none; }
.rte-inline .rte-bar { position:absolute; bottom:calc(100% + 4px); left:-1px; z-index:20; border:1px solid #e5e7eb; border-radius:6px;
  box-shadow:0 4px 12px rgba(0,0,0,.08); background:#fff; }
.rte-btn { display:inline-flex; align-items:center; justify-content:center; width:28px; height:26px; padding:0; border:0; border-radius:4px;
  background:transparent; color:#4b5563; font:600 14px/1 system-ui, sans-serif; cursor:pointer; }
.rte-btn:hover { background:#eef0f3; color:#111827; }
.rte-btn[aria-pressed="true"], .rte-btn.rte-on { background:#e0e7ff; color:#3730a3; }
.rte-sep { width:1px; height:18px; margin:0 3px; background:#e5e7eb; }
.rte-link { display:flex; flex-wrap:wrap; gap:4px; padding:6px; border-bottom:1px solid #f1f5f9; background:#f8fafc; }
.rte-link[hidden] { display:none; }
.rte-link input { flex:1 1 160px; min-width:0; padding:4px 8px; border:1px solid #d1d5db; border-radius:4px; font:inherit; font-size:13px; color:#111827; background:#fff; }
.rte-link input:focus { outline:2px solid #7c5cff; outline-offset:-1px; }
.rte-small { padding:3px 8px; border:1px solid #d1d5db; border-radius:4px; background:#fff; color:#374151; font:600 12px/1.4 system-ui, sans-serif; cursor:pointer; }
.rte-small:hover { background:#f3f4f6; }
.rte-primary { background:#6847f5; border-color:#6847f5; color:#fff; }
.rte-primary:hover { background:#4338ca; }
.rte-area { position:relative; padding:6px 10px; outline:none; overflow-wrap:anywhere; cursor:text; }
.rte-inline .rte-area { min-height:calc(1.5em + 12px); }
.rte-area.rte-empty::before { content:attr(data-placeholder); position:absolute; left:10px; top:6px; color:#9ca3af; pointer-events:none; }
.rte-area ul, .rte-area ol { margin:2px 0; padding-left:22px; }
.rte-area ul { list-style:disc; }
.rte-area ol { list-style:decimal; }
.rte-area a { color:#6847f5; text-decoration:underline; }
.rte-area b, .rte-area strong { font-weight:700; }
.rte-count { padding:0 8px 4px; font-size:11px; color:#6b7280; text-align:right; }
.rte-count[hidden] { display:none; }
.rte-count.rte-over { color:#dc2626; font-weight:600; }
`;
