import type { CSSProperties } from "react";
import type { BannerSettings, Block, StepFooter, StepSize, Theme } from "@/lib/guide-schema";
import { CARD_WIDTH, richText, safeUrl, videoEmbed } from "@/lib/format";
import { cx } from "@/components/ui";

// Dashboard rendering of a tour step or announcement, matching sdk/blocks.ts.
// Images with no URL show a placeholder so templates read well before editing.

const FONT_STACK = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

// Same as TONES in sdk/widgets.ts; brand uses the theme gradient.
const BANNER_TONES = {
  brand: null,
  info: { bg: "#2563eb", fg: "#ffffff" },
  success: { bg: "#059669", fg: "#ffffff" },
  warning: { bg: "#f59e0b", fg: "#1c1917" },
} as const;

export function StepPreview({
  blocks,
  theme,
  kind,
  size,
  footer,
  index = 0,
  total = 1,
  hideNext = false,
  skipLink = false,
  banner,
  interactive = false,
}: {
  blocks: Block[];
  theme: Theme;
  // inline: fills the width it is given, like a card inside the host page.
  kind: "modal" | "tooltip" | "banner" | "inline";
  size: StepSize;
  footer?: StepFooter;
  index?: number;
  total?: number;
  // The step waits for the user (click, typing, an element), so there is no Next button.
  hideNext?: boolean;
  // ...and it is optional, so a Skip link shows instead.
  skipLink?: boolean;
  banner?: BannerSettings;
  // Live preview: videos play. Thumbnails: everything static.
  interactive?: boolean;
}) {
  const font = theme.fontFamily === "inherit" ? FONT_STACK : theme.fontFamily;
  const btn = (style: "primary" | "secondary" | "link"): CSSProperties =>
    style === "primary"
      ? {
          background: `linear-gradient(135deg, color-mix(in srgb, ${theme.primaryColor} 72%, #fff), ${theme.primaryColor})`,
          boxShadow: `0 6px 16px color-mix(in srgb, ${theme.primaryColor} 32%, transparent)`,
          color: "#fff",
          borderRadius: theme.radius * 0.7,
          padding: "7px 14px",
          fontWeight: 650,
          fontSize: 14,
        }
      : style === "secondary"
        ? { color: theme.textColor, opacity: 0.75, padding: "7px 14px", fontWeight: 600, fontSize: 14, borderRadius: theme.radius * 0.7 }
        : { color: theme.primaryColor, textDecoration: "underline", padding: "7px 4px", fontWeight: 600, fontSize: 14 };

  if (kind === "banner") {
    const buttons = blocks.find((b) => b.type === "buttons");
    const tone = banner ? BANNER_TONES[banner.tone] : null;
    const bg = banner?.background || tone?.bg || `linear-gradient(135deg, color-mix(in srgb, ${theme.primaryColor} 72%, #fff), ${theme.primaryColor})`;
    const fg = banner?.textColor || (banner?.background ? "#fff" : (tone?.fg ?? "#fff"));
    const solid = banner?.background || tone?.bg || theme.primaryColor;
    return (
      <div
        className={cx("relative flex flex-wrap items-center justify-center gap-3 py-2.5 pl-4 text-sm", banner?.dismissible === false ? "pr-4" : "pr-10")}
        style={{ background: bg, color: fg, fontFamily: font }}
      >
        <span
          className={cx(banner?.link.url && "underline underline-offset-2")}
          dangerouslySetInnerHTML={{
            __html: blocks
              .map((b) => (b.type === "heading" && b.text ? `<strong>${richText(b.text)}</strong>` : b.type === "text" ? richText(b.text) : ""))
              .filter(Boolean)
              .join(" "),
          }}
        />
        {buttons?.type === "buttons" &&
          buttons.buttons.map((b) => (
            <span
              key={b.id}
              className="rounded px-3 py-1 font-semibold"
              style={b.style === "primary" ? { background: fg, color: solid } : { boxShadow: "inset 0 0 0 1px currentColor" }}
            >
              {b.label}
            </span>
          ))}
        {banner?.dismissible !== false && <span className="absolute top-1/2 right-3 -translate-y-1/2 text-lg leading-none opacity-80">×</span>}
      </div>
    );
  }

  const pad = kind === "modal" ? 24 : 18;
  const last = index === total - 1;
  const f = footer;
  const showNext = !hideNext;
  const showFooter = (f && f.show && (showNext || (f.showBack && index > 0) || (f.showProgress && total > 1))) || skipLink;

  return (
    <div
      className="relative"
      style={{
        width: kind === "inline" ? "100%" : CARD_WIDTH[kind][size],
        maxWidth: "100%",
        background: theme.backgroundColor,
        color: theme.textColor,
        borderRadius: theme.radius,
        padding: pad,
        paddingBottom: 14 + (kind === "modal" ? 6 : 0),
        fontFamily: font,
        fontSize: 14,
        lineHeight: 1.5,
        boxShadow:
          kind === "inline"
            ? "0 1px 3px rgba(20,21,43,.08), 0 0 0 1px rgba(20,21,43,.07)"
            : "0 20px 50px rgba(20,21,43,.22), 0 4px 12px rgba(20,21,43,.06), 0 0 0 1px rgba(20,21,43,.05)",
        overflow: "hidden",
      }}
    >
      <span className="absolute top-2.5 right-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-white/80 text-lg leading-none opacity-60">
        ×
      </span>
      {blocks.map((b, i) => {
        const first = i === 0;
        switch (b.type) {
          case "heading":
            return b.text ? (
              <h3
                key={b.id}
                style={{ margin: first ? "0 26px 6px 0" : "0 0 6px", fontSize: 16, fontWeight: 650, lineHeight: 1.3, textAlign: b.align }}
                dangerouslySetInnerHTML={{ __html: richText(b.text) }}
              />
            ) : (
              <div key={b.id} className="mb-1.5 h-4 w-2/3 rounded bg-gray-200/80" />
            );
          case "text":
            return b.text ? (
              <div
                key={b.id}
                style={{ margin: "0 0 12px", textAlign: b.align, overflowWrap: "break-word" }}
                className="[&_a]:underline"
                dangerouslySetInnerHTML={{ __html: richText(b.text) }}
              />
            ) : (
              <div key={b.id} className="mb-3 space-y-1.5">
                <div className="h-3 rounded bg-gray-200/70" />
                <div className="h-3 w-4/5 rounded bg-gray-200/70" />
              </div>
            );
          case "image": {
            const src = safeUrl(b.url);
            return (
              <div
                key={b.id}
                className="relative overflow-hidden"
                style={{
                  height: b.height,
                  margin: b.edge ? `${first ? -pad : 0}px ${-pad}px 12px` : "0 0 12px",
                  borderRadius: b.edge ? (first ? `${theme.radius}px ${theme.radius}px 0 0` : 0) : theme.radius * 0.6,
                  background: src ? undefined : "#f3f4f6",
                }}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={b.alt} className="block h-full w-full" style={{ objectFit: b.fit }} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-gray-400">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    Add an image
                  </div>
                )}
                {b.overlay && (
                  <div
                    className="absolute inset-0 flex items-center justify-center p-4 text-center"
                    style={{ color: "#fff", fontSize: 24, fontWeight: 750, lineHeight: 1.2, textShadow: "0 2px 12px rgba(0,0,0,.35)" }}
                    dangerouslySetInnerHTML={{ __html: richText(b.overlay) }}
                  />
                )}
              </div>
            );
          }
          case "video": {
            const v = videoEmbed(b.url, b);
            return (
              <div
                key={b.id}
                className="relative mb-3 overflow-hidden bg-black"
                style={{ aspectRatio: "16/9", borderRadius: theme.radius * 0.6 }}
              >
                {v && interactive ? (
                  v.kind === "iframe" ? (
                    <iframe src={v.src} className="absolute inset-0 h-full w-full" allow="autoplay; fullscreen; picture-in-picture" title="Video" />
                  ) : (
                    <video
                      src={v.src}
                      controls={b.controls}
                      autoPlay={b.autoplay}
                      muted={b.autoplay}
                      loop={b.loop}
                      playsInline
                      className="absolute inset-0 h-full w-full"
                    />
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white">▶</span>
                    {!v && <span className="absolute bottom-2">{b.url ? "Unsupported video link" : "Add a video link"}</span>}
                  </div>
                )}
              </div>
            );
          }
          case "audio": {
            const src = interactive ? safeUrl(b.url) : "";
            return (
              <div key={b.id} className="mb-3 rounded-md px-2.5 py-2" style={{ background: "rgba(0,0,0,.04)", borderRadius: theme.radius * 0.6 }}>
                {src ? (
                  <audio src={src} controls className="h-8 w-full" />
                ) : (
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs text-white"
                      style={{ background: theme.primaryColor }}
                    >
                      ▶
                    </span>
                    <div className="min-w-0 flex-1">
                      {b.label && <div className="mb-1 truncate text-xs font-semibold">{b.label}</div>}
                      <div className="h-1.5 rounded bg-black/10" />
                    </div>
                    {!b.url && <span className="text-xs opacity-60">Add audio</span>}
                  </div>
                )}
              </div>
            );
          }
          case "buttons":
            return (
              <div
                key={b.id}
                className="mb-3 flex flex-wrap gap-2"
                style={{ justifyContent: b.align === "left" ? "flex-start" : b.align === "center" ? "center" : "flex-end" }}
              >
                {b.buttons.map((x) => (
                  <span key={x.id} style={btn(x.style)}>
                    {x.label || "Button"}
                  </span>
                ))}
              </div>
            );
          case "divider":
            return <hr key={b.id} className="mb-3 border-0 border-t" style={{ borderColor: "rgba(0,0,0,.1)" }} />;
          case "spacer":
            return <div key={b.id} style={{ height: b.size }} />;
        }
      })}
      {showFooter && (
        <div className="flex items-center gap-2">
          <span className="mr-auto text-xs opacity-60">{f?.show && f.showProgress && total > 1 ? `${index + 1} of ${total}` : ""}</span>
          {skipLink && <span className="text-xs underline opacity-60">Skip</span>}
          {f?.show && f.showBack && index > 0 && <span style={btn("secondary")}>{f.backLabel}</span>}
          {f?.show && showNext && <span style={btn("primary")}>{last ? f.doneLabel : f.nextLabel}</span>}
        </div>
      )}
    </div>
  );
}
