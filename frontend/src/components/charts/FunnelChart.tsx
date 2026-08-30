import * as React from "react";

interface FunnelStage {
  label: string;
  value: number;
  colorVar: string;
}

const CHART_W = 420;
const CHART_H = 150;
const PAD_L = 14;
const PAD_R = 14;
const PAD_T = 30;
const PAD_B = 34;

export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(...stages.map((s) => s.value), 1);

  const innerW = CHART_W - PAD_L - PAD_R;
  const innerH = CHART_H - PAD_T - PAD_B;
  const n = stages.length;
  const xAt = (i: number) => PAD_L + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => PAD_T + innerH - (v / max) * innerH;

  const points = stages.map((s, i) => ({ x: xAt(i), y: yAt(s.value), ...s }));

  // Smooth cubic-bezier path through the points (control points at the
  // horizontal midpoint of each segment) — gives the gentle "trend line" curve.
  const linePath = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1];
      const midX = (prev.x + p.x) / 2;
      return `C ${midX} ${prev.y}, ${midX} ${p.y}, ${p.x} ${p.y}`;
    })
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD_T + innerH} L ${points[0].x} ${PAD_T + innerH} Z`;

  const gradientId = React.useId();

  return (
    <div>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke="var(--color-brand-500)" strokeWidth="2" strokeLinecap="round" />

        {points.map((p, i) => {
          const edgeAnchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
          return (
          <g key={p.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {i > 0 && (
              <rect
                x={(points[i - 1].x + p.x) / 2 - 20}
                y={PAD_T}
                width="40"
                height={innerH}
                fill="transparent"
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={hover === i ? 5 : 3.5}
              fill="var(--color-white, #fff)"
              stroke={p.colorVar}
              strokeWidth={2.5}
              className="dark:fill-navy-900 transition-[r] duration-150"
            />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor={edgeAnchor}
              fontSize="12"
              fontWeight={600}
              className="fill-navy-950 dark:fill-white"
            >
              {p.value.toLocaleString()}
            </text>
            <text
              x={p.x}
              y={CHART_H - 12}
              textAnchor={edgeAnchor}
              fontSize="10"
              className="fill-slate-500 dark:fill-slate-400"
            >
              {p.label}
            </text>
            {i > 0 && (
              <text
                x={(points[i - 1].x + p.x) / 2}
                y={Math.min(points[i - 1].y, p.y) - 2}
                textAnchor="middle"
                fontSize="9"
                className="fill-slate-400 dark:fill-slate-500"
              >
                {points[i - 1].value > 0 ? `${Math.round((p.value / points[i - 1].value) * 100)}%` : ""}
              </text>
            )}
          </g>
          );
        })}
      </svg>
    </div>
  );
}
