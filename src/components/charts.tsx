"use client";

import { useMemo, useRef, useState } from "react";

// Colors follow the reference categorical order (slot 1 blue, slot 2 orange, slot 3 aqua).
export const CATEGORICAL = ["#6847f5", "#eb6834", "#1baf7a"] as const;

export type Series = { key: string; label: string; color: string };

const GUIDE_SERIES: Series[] = [
  { key: "seen", label: "Saw a guide", color: CATEGORICAL[0] },
  { key: "completed", label: "Completed", color: CATEGORICAL[1] },
];

type Point = { date: string } & Record<string, number | string>;

const W = 720;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 36 };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function shortDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function TrendChart({
  data,
  title,
  series: SERIES = GUIDE_SERIES,
  description = "daily users who saw and completed guides",
}: {
  data: Point[];
  title: string;
  series?: Series[];
  description?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const { max, x, y, paths } = useMemo(() => {
    const max = niceMax(Math.max(1, ...data.flatMap((d) => SERIES.map((s) => Number(d[s.key]) || 0))));
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * iw : iw / 2);
    const y = (v: number) => PAD.top + ih - (v / max) * ih;
    const paths = SERIES.map((s) => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(Number(d[s.key]) || 0).toFixed(1)}`).join(""));
    return { max, x, y, paths };
  }, [data, SERIES]);

  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / 6);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || !data.length) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  const h = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <div className="flex items-center gap-4 text-xs text-gray-600">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
          <button className="text-gray-500 underline hover:text-gray-800" onClick={() => setShowTable((v) => !v)}>
            {showTable ? "Chart" : "Table"}
          </button>
        </div>
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-auto rounded-md ring-1 ring-gray-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((d) => (
                <tr key={d.date}>
                  <td className="px-3 py-1.5">{shortDate(d.date)}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">
                      {d[s.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full touch-none select-none"
            role="img"
            aria-label={`${title}: ${description}`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#6b7280">
                  {t}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % labelEvery === 0 ? (
                <text key={d.date} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="#6b7280">
                  {shortDate(d.date)}
                </text>
              ) : null,
            )}
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="#9ca3af" strokeWidth={1} />
            )}
            {SERIES.map((s, si) => (
              <path key={s.key} d={paths[si]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {h &&
              SERIES.map((s) => (
                <circle key={s.key} cx={x(hover!)} cy={y(Number(h[s.key]) || 0)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
              ))}
          </svg>
          {h && (
            <div
              className="pointer-events-none absolute top-0 rounded-md bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-gray-200"
              style={{
                left: `${(x(hover!) / W) * 100}%`,
                transform: hover! > data.length / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
              }}
            >
              <div className="mb-1 font-medium text-gray-500">{shortDate(h.date)}</div>
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center gap-2 whitespace-nowrap">
                  <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
                  <strong className="tabular-nums text-gray-900">{h[s.key]}</strong>
                  <span className="text-gray-500">{s.label.toLowerCase()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Horizontal bars, one per step/item, scaled to the first row (users who reached step 1).
export function FunnelBars({ rows, base }: { rows: { label: string; value: number }[]; base: number }) {
  const max = Math.max(1, base, ...rows.map((r) => r.value));
  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => {
        const share = base ? Math.round((r.value / base) * 100) : 0;
        return (
          <li key={i} className="group" title={`${r.label}: ${r.value} users (${share}%)`}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-gray-700">
                <span className="mr-2 text-xs text-gray-400 tabular-nums">{i + 1}</span>
                {r.label}
              </span>
              <span className="shrink-0 tabular-nums text-gray-900">
                {r.value} <span className="text-xs text-gray-500">· {share}%</span>
              </span>
            </div>
            <div className="h-2 rounded bg-gray-100">
              <div
                className="h-2 rounded bg-[#6847f5] transition-opacity group-hover:opacity-80"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// Share of users per value (browser, OS, …): one bar each, scaled to the total.
// Single hue; the value and percentage are always written out.
export function ShareBars({ rows, total }: { rows: { label: string; value: number; href?: string }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const share = total ? Math.round((r.value / total) * 100) : 0;
        const label = r.href ? (
          <a href={r.href} className="truncate text-gray-700 hover:text-brand-600 hover:underline">
            {r.label}
          </a>
        ) : (
          <span className="truncate text-gray-700">{r.label}</span>
        );
        return (
          <li key={r.label} className="group" title={`${r.label}: ${r.value} users (${share}%)`}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              {label}
              <span className="shrink-0 tabular-nums text-gray-900">
                {r.value} <span className="text-xs text-gray-500">· {share}%</span>
              </span>
            </div>
            <div className="h-2 rounded bg-gray-100">
              <div className="h-2 rounded bg-[#6847f5] transition-opacity group-hover:opacity-80" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
