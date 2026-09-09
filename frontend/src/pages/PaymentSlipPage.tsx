import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Printer, RotateCcw } from "lucide-react";
import { Button } from "../components/ui/Button";
import hamdanIcon from "../assets/hamdan-icon-transparent.png";

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  no: "",
  date: todayIso(),
  receivedFrom: "",
  sumOfRupees: "",
  cnic: "",
  paymentMode: "",
  paymentDated: "",
  drawnOnBank: "",
  onAccountOf: "",
  unitNo: "",
  type: "",
  floor: "",
  projectName: "",
  amount: "",
};

function FieldLine({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-end gap-2 ${className}`}>
      <label className="shrink-0 whitespace-nowrap font-semibold text-[#2d2a6b]">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 border-0 border-b border-[#8683b8] bg-transparent px-1 pb-0.5 text-[#2d2a6b] outline-none focus:border-brand-600 print:border-[#6c69a3]"
      />
    </div>
  );
}

export default function PaymentSlipPage() {
  const [form, setForm] = React.useState(emptyForm);
  const set = (field: keyof typeof emptyForm) => (v: string) => setForm((f) => ({ ...f, [field]: v }));

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        }
      `}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4 print:hidden">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-navy-800 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setForm(emptyForm)}>
            <RotateCcw className="h-4 w-4" />
            Clear Form
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[210mm] border border-slate-300 bg-white p-10 text-sm shadow-sm sm:p-14 print:border-0 print:p-10 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b-2 border-[#2d2a6b] pb-5">
          <div className="flex items-center gap-3">
            <img src={hamdanIcon} alt="Hamdan" className="h-16 w-auto shrink-0" />
            <div>
              <p
                className="text-2xl font-black leading-tight tracking-wide text-[#96690f]"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                HAMDAN ASSOCIATES
              </p>
              <p className="text-[10px] font-semibold tracking-[0.25em] text-[#96690f]">
                BUILDERS &amp; DEVELOPERS
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div
              className="p-[3px]"
              style={{
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 14% 100%, 0 50%)",
                background: "#c9a227",
              }}
            >
              <div
                className="flex items-center bg-navy-950 py-1.5 pl-5 pr-4 text-sm font-bold tracking-wide text-white"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 14% 100%, 0 50%)" }}
              >
                RECEIPT
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-[#2d2a6b]">No.</span>
              <input
                value={form.no}
                onChange={(e) => set("no")(e.target.value)}
                placeholder="0000000"
                className="w-24 border-0 border-b border-[#8683b8] bg-transparent px-1 text-center font-mono tracking-[0.2em] text-[#2d2a6b] outline-none focus:border-brand-600 print:border-[#6c69a3]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-5 pt-6">
          <FieldLine label="Date" value={form.date} onChange={set("date")} className="w-52" />

          <FieldLine
            label="Received with thanks from Mr./Mrs./Miss"
            value={form.receivedFrom}
            onChange={set("receivedFrom")}
          />

          <div className="grid grid-cols-[2fr_1fr] gap-x-8">
            <FieldLine label="A Sum of Rupees" value={form.sumOfRupees} onChange={set("sumOfRupees")} />
            <FieldLine label="CNIC #." value={form.cnic} onChange={set("cnic")} />
          </div>

          <div className="grid grid-cols-[2fr_1fr] gap-x-8">
            <FieldLine
              label="In Cash/Cheque/Pay Order/Bank Draft No."
              value={form.paymentMode}
              onChange={set("paymentMode")}
            />
            <FieldLine label="Dated" value={form.paymentDated} onChange={set("paymentDated")} />
          </div>

          <div className="grid grid-cols-2 gap-x-8">
            <FieldLine label="Drawn on Bank" value={form.drawnOnBank} onChange={set("drawnOnBank")} />
            <FieldLine label="On Account of" value={form.onAccountOf} onChange={set("onAccountOf")} />
          </div>

          <div className="grid grid-cols-[2fr_1fr_1fr] gap-x-8">
            <FieldLine label="Apartment/Plot/Shop #." value={form.unitNo} onChange={set("unitNo")} />
            <FieldLine label="Type" value={form.type} onChange={set("type")} />
            <FieldLine label="Floor" value={form.floor} onChange={set("floor")} />
          </div>

          <FieldLine label="Project Name :" value={form.projectName} onChange={set("projectName")} />

          <div className="flex items-end gap-2 pt-2">
            <span className="text-3xl font-bold text-[#2d2a6b]">Rs.</span>
            <input
              value={form.amount}
              onChange={(e) => set("amount")(e.target.value)}
              className="w-full min-w-0 border-0 border-b border-[#8683b8] bg-transparent px-1 pb-1 text-2xl font-semibold text-[#2d2a6b] outline-none focus:border-brand-600 print:border-[#6c69a3]"
            />
          </div>

          <div className="pt-1 text-[11px] italic text-slate-500">
            <p>(Receipt Valid Subject to realization of cheque)</p>
            <p>All Installments must be paid by 10th of each month.</p>
          </div>
        </div>

        <div className="mt-12 flex justify-start">
          <div className="text-center">
            <div className="w-48 border-t border-[#8683b8]" />
            <p className="mt-1 text-sm text-[#2d2a6b]">
              For <span className="font-semibold">Hamdan Associates</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
