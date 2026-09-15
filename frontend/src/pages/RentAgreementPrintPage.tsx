import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { CompanySettings, RentAgreement } from "../types";

function targetDescription(a: RentAgreement) {
  if (a.unit) return `Unit ${a.unit.unit_number} (Ref: ${a.unit.unit_ref_no})`;
  if (a.land_property) return `${a.land_property.area_location} (Ref: ${a.land_property.property_ref_no})`;
  return "—";
}

function monthlyDueDay(a: RentAgreement) {
  const day = new Date(a.start_date).getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
  return `${day}${suffix}`;
}

function endDateLabel(a: RentAgreement) {
  const end = new Date(a.start_date);
  end.setMonth(end.getMonth() + a.duration_months);
  return end.toISOString().slice(0, 10);
}

export default function RentAgreementPrintPage() {
  const { agreementId } = useParams();

  const { data: agreement, isLoading } = useQuery({
    queryKey: ["rentals", "agreement", agreementId],
    queryFn: async () => (await api.get<RentAgreement>(`/rentals/agreements/${agreementId}`)).data,
  });
  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

  if (isLoading || !agreement) {
    return <div className="p-10 text-sm text-slate-400">Loading...</div>;
  }

  const companyName = companySettings?.company_name || "Hamdan Builders and Developers";

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="mx-auto w-full max-w-[210mm] bg-white p-10 text-[13px] leading-relaxed text-navy-900 shadow-sm print:shadow-none print:p-8">
        <div className="flex items-start justify-between border-b border-slate-200 pb-5">
          <div>
            <p className="text-lg font-bold text-navy-950">{companyName}</p>
            <p className="text-xs text-slate-500">Real Estate Builder &amp; Developer</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide text-navy-950">Rent Agreement</p>
            <p className="mt-1 font-mono text-sm text-slate-500">{agreement.agreement_no}</p>
            <p className="text-xs text-slate-400">{agreement.agreement_date}</p>
          </div>
        </div>

        <div className="space-y-4 py-6">
          <p>
            This Rent Agreement ("Agreement") is made and executed on{" "}
            <strong>{agreement.agreement_date}</strong>, between:
          </p>

          <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Landlord (First Party)
              </p>
              <p className="mt-1 font-medium text-navy-950">{companyName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tenant (Second Party)
              </p>
              <p className="mt-1 font-medium text-navy-950">{agreement.tenant.name}</p>
              {agreement.tenant.cnic && <p className="text-xs text-slate-500">CNIC: {agreement.tenant.cnic}</p>}
              {agreement.tenant.mobile && <p className="text-xs text-slate-500">Mobile: {agreement.tenant.mobile}</p>}
              {agreement.tenant.address && (
                <p className="text-xs text-slate-500">Address: {agreement.tenant.address}</p>
              )}
            </div>
          </div>

          <p>
            Whereby the Landlord agrees to rent out, and the Tenant agrees to take on rent, the
            property described below, on the terms and conditions set out in this Agreement.
          </p>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Property / Premises
            </p>
            <p className="font-medium text-navy-950">{targetDescription(agreement)}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-2 rounded-lg border border-slate-200 p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">Monthly Rent</p>
              <p className="font-semibold text-navy-950">
                PKR {Number(agreement.monthly_rent).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Security Deposit</p>
              <p className="font-semibold text-navy-950">
                PKR {Number(agreement.security_deposit).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Term Start</p>
              <p className="font-semibold text-navy-950">{agreement.start_date}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Term Length</p>
              <p className="font-semibold text-navy-950">
                {agreement.duration_months} month{agreement.duration_months === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Terms &amp; Conditions
          </p>
          <ol className="list-decimal space-y-0.5 pl-4 text-[10px] leading-relaxed text-slate-500">
            <li>
              This Agreement is valid for a period of <strong>{agreement.duration_months} month(s)</strong>,
              commencing on <strong>{agreement.start_date}</strong> and ending on{" "}
              <strong>{endDateLabel(agreement)}</strong>, unless terminated earlier as per Clause 8 or
              renewed by mutual written consent of both parties.
            </li>
            <li>
              The Tenant shall pay a monthly rent of{" "}
              <strong>PKR {Number(agreement.monthly_rent).toLocaleString()}</strong>, in advance, on or
              before the <strong>{monthlyDueDay(agreement)}</strong> of each calendar month, to the
              Landlord or its authorized representative.
            </li>
            <li>
              A security deposit of{" "}
              <strong>PKR {Number(agreement.security_deposit).toLocaleString()}</strong> has been paid by
              the Tenant to the Landlord, refundable at the end of the tenancy after deduction of any
              outstanding dues, unpaid utility bills, or cost of damages to the premises beyond normal
              wear and tear.
            </li>
            <li>
              The premises shall be used by the Tenant strictly for the purpose agreed upon at the time
              of renting, and shall not be used for any illegal, hazardous, or unauthorized activity.
            </li>
            <li>
              The Tenant shall be responsible for payment of all utility bills (electricity, gas, water,
              and any applicable service charges) pertaining to the premises for the duration of this
              Agreement, unless otherwise agreed in writing.
            </li>
            <li>
              The Tenant shall maintain the premises in good and tenantable condition and shall be
              responsible for minor repairs arising from normal use. Major structural repairs shall
              remain the responsibility of the Landlord.
            </li>
            <li>
              The Tenant shall not sublet, assign, or transfer possession of the premises, in whole or
              in part, to any third party without the prior written consent of the Landlord. No
              structural alteration or addition shall be made to the premises without the Landlord's
              written approval.
            </li>
            <li>
              Either party may terminate this Agreement before expiry by giving the other party not less
              than <strong>thirty (30) days'</strong> written notice. In case of non-payment of rent for
              two (2) consecutive months, the Landlord reserves the right to terminate this Agreement
              immediately and recover possession of the premises.
            </li>
            <li>
              Upon termination or expiry of this Agreement, the Tenant shall vacate and hand over
              peaceful possession of the premises to the Landlord in the same condition as received,
              normal wear and tear excepted, and settle all outstanding dues before the security deposit
              is refunded.
            </li>
            <li>
              Any dispute arising out of or in connection with this Agreement shall be resolved amicably
              between the parties, failing which it shall be subject to the jurisdiction of the
              competent courts.
            </li>
          </ol>
        </div>

        {agreement.narration && (
          <p className="mt-4 text-slate-600">
            <span className="font-semibold">Additional Remarks: </span>
            {agreement.narration}
          </p>
        )}

        <div className="mt-10 grid grid-cols-2 gap-6 text-center text-xs text-slate-500">
          <AccountantSignature settings={companySettings} />
          <div className="border-t border-slate-300 pt-2">
            {agreement.tenant.name}
            <p className="text-[10px] text-slate-400">Tenant's Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
