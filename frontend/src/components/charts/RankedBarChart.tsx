interface BarDatum {
  label: string;
  value: number;
  colorVar: string;
}

export function RankedBarChart({
  data,
  formatValue,
}: {
  data: BarDatum[];
  formatValue?: (value: number) => string;
}) {
  const format = formatValue ?? ((v: number) => String(v));
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map((d) => d.value), 1);

  return (
    <div className="space-y-2.5">
      {sorted.map((d) => {
        const widthPct = Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0);
        return (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
              {d.label}
            </span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-[4px] bg-slate-100 dark:bg-navy-800">
              <div
                className="h-full rounded-r-[4px] transition-[width] duration-500"
                style={{ width: `${widthPct}%`, backgroundColor: d.colorVar }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums text-navy-900 dark:text-slate-100">
              {format(d.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
