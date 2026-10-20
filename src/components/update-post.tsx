import type { Block } from "@/lib/guide-schema";
import { richText, safeUrl, videoEmbed } from "@/lib/format";
import { LABEL_STYLES, type LabelColor } from "@/lib/updates";

// A product update as readers see it on the public page; the dashboard
// editor uses the same components for its preview. Buttons that start a guide
// only work inside the app (resource center), so the page leaves them out.

export function LabelChip({ name, color }: { name: string; color: LabelColor }) {
  const s = LABEL_STYLES[color];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ color: s.fg, background: s.bg }}>
      {name}
    </span>
  );
}

export function formatUpdateDate(iso: string | Date, locale = "en") {
  try {
    return new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  } catch {
    return new Date(iso).toDateString();
  }
}

export function UpdateBody({ blocks, accent }: { blocks: Block[]; accent: string }) {
  return (
    <div className="update-body space-y-4 text-[15px] leading-relaxed text-gray-700 [&_a]:font-medium [&_a]:underline [&_.rt-list]:my-1 [&_.rt-list]:pl-5 [&_ol.rt-list]:list-decimal [&_ul.rt-list]:list-disc">
      {blocks.map((b) => {
        switch (b.type) {
          case "heading":
            return b.text ? (
              <h3
                key={b.id}
                className="pt-1 text-lg font-bold text-gray-900"
                style={{ textAlign: b.align }}
                dangerouslySetInnerHTML={{ __html: richText(b.text) }}
              />
            ) : null;
          case "text":
            return b.text ? (
              <div key={b.id} style={{ textAlign: b.align, overflowWrap: "break-word" }} dangerouslySetInnerHTML={{ __html: richText(b.text) }} />
            ) : null;
          case "image": {
            const src = safeUrl(b.url);
            if (!src) return null;
            return (
              <figure key={b.id} className="relative overflow-hidden rounded-xl bg-gray-50 ring-1 ring-gray-200/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={b.alt} className="block max-h-[520px] w-full" style={{ objectFit: b.fit === "cover" ? "cover" : "contain", height: b.fit === "cover" ? b.height : "auto" }} />
                {b.overlay && (
                  <figcaption
                    className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 px-4 pt-8 pb-3 text-sm text-white"
                    dangerouslySetInnerHTML={{ __html: richText(b.overlay) }}
                  />
                )}
              </figure>
            );
          }
          case "video": {
            const v = videoEmbed(b.url);
            if (!v) return null;
            return (
              <div key={b.id} className="aspect-video overflow-hidden rounded-xl bg-black">
                {v.kind === "iframe" ? (
                  <iframe src={v.src} title="Video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" className="h-full w-full" />
                ) : (
                  <video src={v.src} controls playsInline preload="metadata" className="h-full w-full" />
                )}
              </div>
            );
          }
          case "buttons": {
            const links = b.buttons.filter((x) => x.action.type === "url" && safeUrl(x.action.url));
            if (!links.length) return null;
            return (
              <div key={b.id} className="flex flex-wrap gap-2" style={{ justifyContent: b.align === "left" ? "flex-start" : b.align === "center" ? "center" : "flex-end" }}>
                {links.map((x) => {
                  const a = x.action as Extract<typeof x.action, { type: "url" }>;
                  return (
                    <a
                      key={x.id}
                      href={safeUrl(a.url)}
                      target={a.newTab ? "_blank" : undefined}
                      rel="noopener"
                      className="rounded-lg px-4 py-2 text-sm font-semibold no-underline!"
                      style={x.style === "primary" ? { background: accent, color: "#fff" } : { color: accent, boxShadow: `inset 0 0 0 1px ${accent}55` }}
                    >
                      {x.label}
                    </a>
                  );
                })}
              </div>
            );
          }
          case "divider":
            return <hr key={b.id} className="border-gray-200" />;
          case "spacer":
            return <div key={b.id} style={{ height: b.size }} />;
        }
      })}
    </div>
  );
}
