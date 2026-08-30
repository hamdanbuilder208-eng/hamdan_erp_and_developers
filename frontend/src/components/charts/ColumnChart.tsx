import * as React from "react";

interface ColumnDatum {
  label: string;
  value: number;
  colorVar: string;
}

export function ColumnChart({
  data,
  formatValue,
}: {
  data: ColumnDatum[];
  formatValue?: (value: number) => string;
}) {
  const [active, setActive] = React.useState<number | null>(null);
  const format = formatValue ?? ((v: number) => String(v));

  const max = Math.max(...data.map((d) => d.value), 1);
  // pick a "nice" tick step (1/2/5 x a power of ten), never fractional for
  // small integer counts, so axis labels never collapse into duplicates
  const rawStep = max / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
  const normalized = rawStep / magnitude;
  const niceStepRaw = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const tickStep = Math.max(Math.round(niceStepRaw * magnitude), 1);
  const niceMax = Math.ceil(max / tickStep) * tickStep;
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax; v += tickStep) ticks.push(v);

  return (
    <div className="flex gap-3">
      <div className="flex h-36 flex-col justify-between py-1 text-right text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
        {ticks
          .slice()
          .reverse()
          .map((t) => (
            <span key={t}>{t.toLocaleString()}</span>
          ))}
      </div>

      <div className="relative flex h-36 flex-1 items-stretch">
        <div className="absolute inset-0 flex flex-col justify-between">
          {ticks
            .slice()
            .reverse()
            .map((t) => (
              <div key={t} className="border-t border-slate-100 dark:border-navy-800" />
            ))}
        </div>

        <div className="relative flex flex-1 items-end justify-around gap-4 px-2">
          {data.map((d, i) => {
            const heightPct = niceMax > 0 ? (d.value / niceMax) * 100 : 0;
            const isActive = active === i;
            return (
              <div
                key={d.label}
                className="flex h-full max-w-16 flex-1 flex-col items-center justify-end gap-1.5"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
              >
                <span
                  className={`text-xs font-medium tabular-nums text-navy-900 transition-opacity dark:text-slate-100 ${
                    d.value > 0 ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {format(d.value)}
                </span>
                <div
                  title={`${d.label}: ${format(d.value)}`}
                  className="w-full max-w-10 rounded-t-[4px] transition-[opacity,transform] duration-150"
                  style={{
                    height: `${Math.max(heightPct, d.value > 0 ? 2 : 0)}%`,
                    backgroundColor: d.colorVar,
                    opacity: isActive || active === null ? 1 : 0.55,
                  }}
                />
                <span className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
