import * as React from "react";

interface Series {
  label: string;
  colorVar: string;
  data: number[];
}

const CHART_H = 170;
const CHART_W = 720;
const PAD_L = 56;
const PAD_R = 16;
const PAD_T = 14;
const PAD_B = 26;

function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const rawStep = max / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const niceStepRaw = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = Math.max(niceStepRaw * magnitude, 1);
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax + 1e-9; v += step) ticks.push(Math.round(v));
  return ticks;
}

export function LineChart({
  series,
  xLabels,
  formatValue,
}: {
  series: Series[];
  xLabels: string[];
  formatValue?: (value: number) => string;
}) {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const format = formatValue ?? ((v: number) => String(v));

  const max = Math.max(...series.flatMap((s) => s.data), 1);
  const ticks = niceTicks(max);
  const niceMax = ticks[ticks.length - 1];

  const innerW = CHART_W - PAD_L - PAD_R;
  const innerH = CHART_H - PAD_T - PAD_B;
  const n = xLabels.length;
  const xAt = (i: number) => PAD_L + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => PAD_T + innerH - (v / niceMax) * innerH;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * CHART_W;
    const rawIndex = n <= 1 ? 0 : ((px - PAD_L) / innerW) * (n - 1);
    const idx = Math.min(Math.max(Math.round(rawIndex), 0), n - 1);
    setHoverIndex(idx);
  };

  return (
    <div>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full touch-none"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD_L}
                x2={CHART_W - PAD_R}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="var(--color-slate-100, #f1f5f9)"
                strokeWidth={1}
                className="dark:opacity-10"
              />
              <text
                x={PAD_L - 8}
                y={yAt(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                fill="var(--color-slate-400, #94a3b8)"
              >
                {t >= 1_000_000
                  ? `${+(t / 1_000_000).toFixed(1)}M`
                  : t >= 1000
                    ? `${Math.round(t / 1000)}k`
                    : t}
              </text>
            </g>
          ))}

          {xLabels.map((label, i) => (
            <text
              key={label + i}
              x={xAt(i)}
              y={CHART_H - 6}
              textAnchor="middle"
              fontSize="10"
              fill="var(--color-slate-400, #94a3b8)"
            >
              {label}
            </text>
          ))}

          {hoverIndex !== null && (
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke="var(--color-slate-300, #cbd5e1)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {series.map((s) => (
            <polyline
              key={s.label}
              points={s.data.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ")}
              fill="none"
              stroke={s.colorVar}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {series.map((s) =>
            s.data.map((v, i) => (
              <circle
                key={`${s.label}-${i}`}
                cx={xAt(i)}
                cy={yAt(v)}
                r={hoverIndex === i ? 4 : 2.5}
                fill="var(--color-white, #fff)"
                stroke={s.colorVar}
                strokeWidth={2}
                className="dark:fill-navy-900"
              />
            )),
          )}
        </svg>

        {hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[9rem] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-navy-700 dark:bg-navy-800"
            style={{ left: `${(xAt(hoverIndex) / CHART_W) * 100}%` }}
          >
            <p className="mb-1 font-semibold text-navy-900 dark:text-slate-100">
              {xLabels[hoverIndex]}
            </p>
            {series.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="h-0.5 w-2.5 rounded-full" style={{ backgroundColor: s.colorVar }} />
                  {s.label}
                </span>
                <span className="font-medium tabular-nums text-navy-900 dark:text-slate-100">
                  {format(s.data[hoverIndex])}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <span
            key={s.label}
            className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"
          >
            <span className="h-0.5 w-3.5 rounded-full" style={{ backgroundColor: s.colorVar }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
