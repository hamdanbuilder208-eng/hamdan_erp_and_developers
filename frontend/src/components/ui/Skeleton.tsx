import type { CSSProperties } from "react";
import { cn } from "../../lib/utils";

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200/70 dark:bg-navy-700/60", className)}
      style={style}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-navy-800 dark:bg-navy-900">
      <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex items-center justify-center py-6">
      <Skeleton className="h-48 w-48 rounded-full" />
    </div>
  );
}

export function BarsSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {[80, 60, 45, 30].map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-3 w-20 shrink-0" />
          <Skeleton className="h-3 flex-1" style={{ maxWidth: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-5 py-3.5">
              <Skeleton className="h-3.5 w-full max-w-[10rem]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
