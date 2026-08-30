import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";
import type { ProjectFloor, Unit, UnitStatus } from "../../types";

const boxVariants = cva(
  "flex h-10 min-w-[3rem] items-center justify-center rounded-md border px-1.5 text-xs font-semibold shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md",
  {
    variants: {
      status: {
        Available: "border-success-500 bg-success-100 text-success-700",
        Booked: "border-warning-500 bg-warning-100 text-warning-700",
        Sold: "border-info-500 bg-info-100 text-info-700",
        "On-Hold": "border-onhold-500 bg-onhold-100 text-onhold-700",
        Cancelled: "border-danger-500 bg-danger-100 text-danger-600 line-through opacity-80",
      } satisfies Record<UnitStatus, string>,
    },
  },
);

const legendItems: { status: UnitStatus; label: string }[] = [
  { status: "Available", label: "Available" },
  { status: "Booked", label: "Booked" },
  { status: "Sold", label: "Sold" },
  { status: "On-Hold", label: "On-Hold" },
  { status: "Cancelled", label: "Cancelled" },
];

function floorSortKey(f: ProjectFloor): number {
  const s = f.floor_no.toLowerCase();
  if (s.includes("ground")) return 0;
  const match = s.match(/\d+/);
  if (match) return parseInt(match[0], 10);
  return -1;
}

export function UnitAvailabilityGrid({
  floors,
  units,
  onSelectUnit,
}: {
  floors: ProjectFloor[];
  units: Unit[];
  onSelectUnit: (unit: Unit) => void;
}) {
  const sortedFloors = [...floors].sort((a, b) => floorSortKey(b) - floorSortKey(a));
  const unitsWithoutFloor = units.filter((u) => !u.floor_id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-slate-50 dark:bg-navy-800/60 px-4 py-2.5">
        {legendItems.map((item) => (
          <div key={item.status} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className={cn("h-2.5 w-2.5 rounded-sm border", boxVariants({ status: item.status }))} />
            {item.label}
          </div>
        ))}
      </div>

      {sortedFloors.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
          No floors defined yet. Add a floor under "Floors / Blocks" first.
        </p>
      )}

      <div className="space-y-3">
        {sortedFloors.map((floor) => {
          const floorUnits = units
            .filter((u) => u.floor_id === floor.id)
            .sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }));

          return (
            <div key={floor.id} className="flex items-start gap-4 border-b border-slate-100 dark:border-navy-800 pb-3 last:border-0">
              <div className="w-24 shrink-0 pt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {floor.block ? `${floor.block} · ` : ""}
                {floor.floor_no}
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
                {floorUnits.length === 0 && (
                  <span className="pt-2 text-xs text-slate-400 dark:text-slate-500">No units generated for this floor.</span>
                )}
                {floorUnits.map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => onSelectUnit(unit)}
                    title={`${unit.unit_number} · ${unit.status} · PKR ${Number(unit.total_price).toLocaleString()}`}
                    className={boxVariants({ status: unit.status })}
                  >
                    {unit.unit_number}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {unitsWithoutFloor.length > 0 && (
        <div className="flex items-start gap-4 pt-1">
          <div className="w-24 shrink-0 pt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Unassigned</div>
          <div className="flex flex-1 flex-wrap gap-2">
            {unitsWithoutFloor.map((unit) => (
              <button
                key={unit.id}
                onClick={() => onSelectUnit(unit)}
                title={`${unit.unit_number} · ${unit.status}`}
                className={boxVariants({ status: unit.status })}
              >
                {unit.unit_number}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
