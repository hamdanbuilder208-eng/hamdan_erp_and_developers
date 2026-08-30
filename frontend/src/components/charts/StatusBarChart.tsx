interface BarDatum {
  label: string;
  value: number;
  colorVar: string;
}

export function StatusBarChart({
  data,
  total,
  formatValue,
  labelWidth = "w-20",
}: {
  data: BarDatum[];
  total: number;
  formatValue?: (value: number) => string;
  labelWidth?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const format = formatValue ?? ((v: number) => String(v));

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        const widthPct = (d.value / max) * 100;
        return (
          <div key={d.label} className="flex items-center gap-3">
            <span className={`${labelWidth} shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400`}>{d.label}</span>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${widthPct}%`, backgroundColor: d.colorVar }}
              />
            </div>
            <span className="w-28 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {format(d.value)} <span className="text-slate-400 dark:text-slate-500">({pct}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
