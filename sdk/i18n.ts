import { escapeHtml } from "../src/lib/format";
import { formatUi, UI_STRINGS_EN, type UiStringKey, type UiStrings } from "../src/lib/ui-strings";

// Interface text in the user's language, sent by the server with init.
let strings: UiStrings = { ...UI_STRINGS_EN };
let locale = "en";

export function setUi(next: Partial<UiStrings> | undefined, nextLocale: string | undefined) {
  strings = { ...UI_STRINGS_EN, ...next };
  locale = nextLocale || "en";
}

export function t(key: UiStringKey, vars?: Record<string, string | number>) {
  return formatUi(strings[key] ?? UI_STRINGS_EN[key], vars);
}

export const currentLocale = () => locale;

// For inside HTML templates.
export const te = (key: UiStringKey, vars?: Record<string, string | number>) => escapeHtml(t(key, vars));
