// Small user-agent parser for the audience breakdowns. It only needs the
// families people group by (browser, OS, device type), not exact versions.

export type DeviceType = "desktop" | "mobile" | "tablet";
export type ClientInfo = { browser: string; os: string; device: DeviceType };

// Order matters: Edge, Opera and Samsung Internet also say "Chrome", and Chrome says "Safari".
const BROWSERS: [RegExp, string][] = [
  [/EdgA?\/|Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/YaBrowser\//, "Yandex"],
  [/Vivaldi\//, "Vivaldi"],
  [/FxiOS\/|Firefox\//, "Firefox"],
  [/CriOS\/|Chrome\/|Chromium\//, "Chrome"],
  [/MSIE |Trident\//, "Internet Explorer"],
  [/Version\/[\d.]+.*Safari\//, "Safari"],
];

const OSES: [RegExp, string][] = [
  [/Windows/, "Windows"],
  [/iPhone|iPod/, "iOS"],
  [/iPad/, "iPadOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux|X11/, "Linux"],
];

export function parseUserAgent(ua: string, hints: { touch?: boolean; mobile?: boolean } = {}): ClientInfo {
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? "Other";
  let os = OSES.find(([re]) => re.test(ua))?.[1] ?? "Other";

  let device: DeviceType = "desktop";
  if (/iPad|Tablet|PlayBook|Silk/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) device = "tablet";
  else if (/Mobi|iPhone|iPod|Android|Windows Phone/.test(ua) || hints.mobile) device = "mobile";

  // iPadOS 13+ sends a desktop Mac user agent; touch support gives it away.
  if (os === "macOS" && hints.touch) {
    os = "iPadOS";
    device = "tablet";
  }
  return { browser, os, device };
}

// Primary tag of an Accept-Language header, e.g. "en-US,en;q=0.9" → "en-US".
export function primaryLanguage(header: string | null | undefined) {
  const first = header?.split(",")[0]?.split(";")[0]?.trim();
  return first && first !== "*" ? first.slice(0, 35) : null;
}
