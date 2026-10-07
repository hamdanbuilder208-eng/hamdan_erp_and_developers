import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer, UserRound } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import type { Allottee, CompanySettings } from "../types";

const API_ORIGIN = new URL(api.defaults.baseURL ?? "", window.location.origin).origin;
const photoUrl = (path: string | null) => (path ? `${API_ORIGIN}${path}` : null);

function Field({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 min-h-[1.25rem] border-b border-slate-200 pb-1 font-medium text-navy-900">
        {value || "—"}
      </p>
    </div>
  );
}

function Photo({ path, alt }: { path: string | null; alt: string }) {
  const src = photoUrl(path);
  return (
    <div className="flex h-32 w-28 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-300 bg-slate-50">
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <UserRound className="h-8 w-8 text-slate-300" />
      )}
    </div>
  );
}

export default function AllotteePrintPage() {
  const { id } = useParams();

  const { data: allottee, isLoading } = useQuery({
    queryKey: ["allottee", id],
    queryFn: async () => (await api.get<Allottee>(`/allottees/${id}`)).data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

  if (isLoading || !allottee) {
    return <div className="p-10 text-sm text-slate-400">Loading allottee...</div>;
  }

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
            <p className="text-xl font-bold uppercase tracking-wide text-navy-950">Application Form</p>
            <p className="mt-1 font-mono text-sm text-slate-500">{allottee.allottee_code}</p>
          </div>
        </div>

        <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Allottee Details
        </p>
        <div className="flex gap-6 text-sm">
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Full Name" value={allottee.name} />
            <Field label="Father's Name" value={allottee.father_name} />
            <Field label="CNIC / NIC No." value={allottee.cnic} />
            <Field label="Mobile No." value={allottee.mobile} />
            <Field label="Tel (Res.)" value={allottee.tel_res} />
            <Field label="Office" value={allottee.office_phone} />
            <Field label="Email" value={allottee.email} />
            <Field label="Referred By" value={allottee.referred_by} />
            <Field label="Current Address" value={allottee.current_address} wide />
            <Field label="CNIC Address" value={allottee.cnic_address} wide />
          </div>
          <Photo path={allottee.picture_url} alt={allottee.name} />
        </div>

        <p className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Nominee Details
        </p>
        <div className="flex gap-6 text-sm">
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Nominee Name" value={allottee.nominee_name} />
            <Field label="Relation" value={allottee.nominee_relation} />
            <Field label="Nominee CNIC" value={allottee.nominee_cnic} />
            <div />
            <Field label="Nominee Current Address" value={allottee.nominee_current_address} wide />
            <Field label="Nominee CNIC Address" value={allottee.nominee_cnic_address} wide />
          </div>
          <Photo path={allottee.nominee_picture_url} alt={allottee.nominee_name ?? "Nominee"} />
        </div>

        <div className="mt-16 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Allottee Signature</div>
          <div className="border-t border-slate-300 pt-2">Nominee Signature</div>
          <div className="border-t border-slate-300 pt-2">Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
}
