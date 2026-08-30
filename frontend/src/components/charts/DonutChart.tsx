import * as React from "react";

interface DonutDatum {
  label: string;
  value: number;
  colorVar: string;
}

const RADIUS = 15.9155; // r such that circumference (2*pi*r) = 100, so stroke-dasharray maps to percent
const GAP = 1.5; // percent-of-circumference gap rendered between adjacent segments

export function DonutChart({
  data,
  total,
  formatValue,
  centerLabel,
}: {
  data: DonutDatum[];
  total: number;
  formatValue?: (value: number) => string;
  centerLabel?: string;
}) {
  const [active, setActive] = React.useState<number | null>(null);
  const format = formatValue ?? ((v: number) => String(v));

  const segments = React.useMemo(() => {
    let cumulative = 0;
    return data
      .filter((d) => d.value > 0)
      .map((d) => {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        const seg = { ...d, pct, offset: cumulative };
        cumulative += pct;
        return seg;
      });
  }, [data, total]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-28 w-28 shrink-0 sm:mx-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle
            cx="21"
            cy="21"
            r={RADIUS}
            fill="transparent"
            stroke="var(--color-slate-100, #f1f5f9)"
            strokeWidth="5"
            className="dark:opacity-10"
          />
          {segments.map((seg, i) => {
            const drawn = Math.max(seg.pct - GAP, seg.pct > 0 ? 0.6 : 0);
            const isActive = active === i;
            return (
              <circle
                key={seg.label}
                cx="21"
                cy="21"
                r={RADIUS}
                fill="transparent"
                stroke={seg.colorVar}
                strokeWidth={isActive ? 6.5 : 5}
                strokeDasharray={`${drawn} ${100 - drawn}`}
                strokeDashoffset={-seg.offset}
                strokeLinecap="butt"
                className="cursor-pointer transition-[stroke-width] duration-150"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
              >
                <title>
                  {seg.label}: {format(seg.value)} ({Math.round(seg.pct)}%)
                </title>
              </circle>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {active !== null ? (
            <>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {segments[active].label}
              </p>
              <p className="text-xs font-semibold text-navy-950 dark:text-white">
                {format(segments[active].value)}
              </p>
              <p className="text-[9px] text-slate-400 dark:text-slate-500">
                {Math.round(segments[active].pct)}%
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-navy-950 dark:text-white">{format(total)}</p>
              {centerLabel && (
                <p className="text-[9px] text-slate-400 dark:text-slate-500">{centerLabel}</p>
              )}
            </>
          )}
        </div>
      </div>

      <ul className="flex-1 space-y-1.5">
        {segments.map((seg, i) => (
          <li
            key={seg.label}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
            className={`flex cursor-default items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors ${
              active === i ? "bg-slate-50 dark:bg-navy-800/60" : ""
            }`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: seg.colorVar }}
            />
            <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{seg.label}</span>
            <span className="tabular-nums font-medium text-navy-900 dark:text-slate-100">
              {format(seg.value)}
            </span>
            <span className="w-9 shrink-0 text-right tabular-nums text-slate-400 dark:text-slate-500">
              {Math.round(seg.pct)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
