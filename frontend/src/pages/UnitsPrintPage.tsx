import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import type { CompanySettings, ProjectDetail, ProjectFloor, Unit } from "../types";

function floorSortKey(f: ProjectFloor): number {
  const s = f.floor_no.toLowerCase();
  if (s.includes("lower ground")) return -1;
  if (s.includes("ground")) return 0;
  if (s.includes("mezzanine")) return 0.5;
  const match = s.match(/\d+/);
  return match ? parseInt(match[0], 10) : -2;
}

const byUnitNumber = (a: Unit, b: Unit) =>
  a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true });

export default function UnitsPrintPage() {
  const { id } = useParams();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", Number(id)],
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${id}`)).data,
  });

  const { data: units } = useQuery({
    queryKey: ["units", Number(id)],
    queryFn: async () => (await api.get<Unit[]>("/units/", { params: { project_id: id } })).data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

  if (isLoading || !project || !units) {
    return <div className="p-10 text-sm text-slate-400">Loading units...</div>;
  }

  const floors = [...project.floors].sort((a, b) => floorSortKey(a) - floorSortKey(b));
  const groups: { label: string; units: Unit[] }[] = floors
    .map((f) => ({
      label: `${f.block ? `${f.block} · ` : ""}${f.floor_no}`,
      units: units.filter((u) => u.floor_id === f.id).sort(byUnitNumber),
    }))
    .filter((g) => g.units.length > 0);
  const unassigned = units.filter((u) => !u.floor_id).sort(byUnitNumber);
  if (unassigned.length > 0) groups.push({ label: "Unassigned", units: unassigned });

  const countBy = (key: (u: Unit) => string) =>
    Object.entries(
      units.reduce<Record<string, number>>((acc, u) => {
        acc[key(u)] = (acc[key(u)] ?? 0) + 1;
        return acc;
      }, {}),
    );
  const statusCounts = countBy((u) => u.status);
  const categoryCounts = countBy((u) => u.unit_category?.name ?? "No category");
  const totalValue = units.reduce((s, u) => s + Number(u.total_price), 0);

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="mx-auto w-full max-w-[210mm] bg-white p-10 shadow-sm print:shadow-none print:p-6">
        <div className="flex items-start justify-between border-b border-slate-200 pb-5">
          <div>
            <p className="text-lg font-bold text-navy-950">
              {companySettings?.company_name ?? "Hamdan Builders and Developers"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide text-navy-950">Units List</p>
            <p className="mt-1 text-sm font-medium text-navy-900">{project.project_name}</p>
            <p className="font-mono text-xs text-slate-500">{project.project_code}</p>
            <p className="text-xs text-slate-400">As of {new Date().toISOString().slice(0, 10)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 py-5 text-sm">
          <div>
            <p className="text-xs text-slate-500">Total Units</p>
            <p className="mt-0.5 font-semibold text-navy-900">{units.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">By Status</p>
            {statusCounts.map(([k, n]) => (
              <p key={k} className="text-navy-900">
                {k}: <span className="font-semibold">{n}</span>
              </p>
            ))}
          </div>
          <div>
            <p className="text-xs text-slate-500">By Category</p>
            {categoryCounts.map(([k, n]) => (
              <p key={k} className="text-navy-900">
                {k}: <span className="font-semibold">{n}</span>
              </p>
            ))}
          </div>
        </div>

        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50">
              <th className="px-2 py-2 font-semibold text-slate-600">#</th>
              <th className="px-2 py-2 font-semibold text-slate-600">Unit #</th>
              <th className="px-2 py-2 font-semibold text-slate-600">Ref No.</th>
              <th className="px-2 py-2 font-semibold text-slate-600">Category</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-600">Base Price</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-600">Extra</th>
              <th className="px-2 py-2 text-right font-semibold text-slate-600">Total (PKR)</th>
              <th className="px-2 py-2 font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          {groups.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={8} className="px-2 py-6 text-center text-slate-400">
                  No units generated for this project yet.
                </td>
              </tr>
            </tbody>
          )}
          {(() => {
            let serial = 0;
            return groups.map((g) => (
              <tbody key={g.label} className="break-inside-avoid">
                <tr className="border-b border-slate-200 bg-slate-100/70">
                  <td colSpan={8} className="px-2 py-1.5 font-semibold text-navy-900">
                    {g.label} <span className="font-normal text-slate-500">({g.units.length} units)</span>
                  </td>
                </tr>
                {g.units.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="px-2 py-1.5 tabular-nums text-slate-500">{++serial}</td>
                    <td className="px-2 py-1.5 font-medium text-navy-900">{u.unit_number}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-500">{u.unit_ref_no}</td>
                    <td className="px-2 py-1.5 text-navy-900">{u.unit_category?.name ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{Number(u.base_price).toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{Number(u.extra_charges).toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                      {Number(u.total_price).toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5 text-navy-900">{u.status}</td>
                  </tr>
                ))}
              </tbody>
            ));
          })()}
          {groups.length > 0 && (
            <tfoot>
              <tr className="border-y border-slate-300 bg-slate-50 font-semibold">
                <td colSpan={6} className="px-2 py-2 text-navy-900">
                  Total Value
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-navy-900">{totalValue.toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
