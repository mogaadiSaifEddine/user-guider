// Text the SDK draws itself, around the author's content: close buttons,
// "2 of 5", the resource center's search. The server picks the user's
// language (built-in translations in ui-strings-builtin.ts, then the
// workspace's own overrides) and sends the result with init.

export const UI_STRINGS_EN = {
  close: "Close",
  minimize: "Minimize",
  back: "Back",
  skip: "Skip",
  stepCount: "{n} of {total}",
  hint: "Hint",
  survey: "Survey",
  guide: "Guide",
  video: "Video",
  help: "Help",
  search: "Search",
  searchHelp: "Search help",
  noResults: "No results for “{q}”.",
  loading: "Loading…",
  loadError: "Couldn't load this. Try again later.",
  dismissChecklist: "Dismiss checklist",
  closeChecklist: "Close checklist",
  reactPrompt: "How do you feel about this update?",
  reactThanks: "Thanks for your feedback!",
  reactComment: "Anything to add? (optional)",
  send: "Send",
  allUpdates: "See all updates",
  newUpdate: "New",
};

export type UiStringKey = keyof typeof UI_STRINGS_EN;
export type UiStrings = Record<UiStringKey, string>;
export const UI_STRING_KEYS = Object.keys(UI_STRINGS_EN) as UiStringKey[];

// Where each string shows, for the settings page.
export const UI_STRING_HINTS: Record<UiStringKey, string> = {
  close: "Close button (screen readers)",
  minimize: "Minimize a checklist (screen readers)",
  back: "Back link in a help article",
  skip: "Skip an optional survey question",
  stepCount: "Progress in tours and surveys; keep {n} and {total}",
  hint: "Hotspot beacon without a title (screen readers)",
  survey: "Survey card (screen readers)",
  guide: "Guide without a heading (screen readers)",
  video: "Embedded video (screen readers)",
  help: "Resource center launcher without a label",
  search: "Search box placeholder",
  searchHelp: "Search box (screen readers)",
  noResults: "Search found nothing; keep {q}",
  loading: "Knowledge base loading",
  loadError: "Knowledge base failed to load",
  dismissChecklist: "Hide a checklist for good",
  closeChecklist: "Hide a finished checklist",
  reactPrompt: "Reactions under a product update",
  reactThanks: "After someone reacts to a product update",
  reactComment: "Comment box after reacting",
  send: "Sends a comment on a product update",
  allUpdates: "Link from What's new to the updates page",
  newUpdate: "Unread product update",
};

export function formatUi(s: string, vars: Record<string, string | number> = {}) {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
