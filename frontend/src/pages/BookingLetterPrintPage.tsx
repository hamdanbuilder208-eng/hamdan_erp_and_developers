import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { Booking, BookingTransfer, CompanySettings } from "../types";

const todayIso = () => new Date().toISOString().slice(0, 10);

function LetterShell({
  title,
  refNo,
  date,
  children,
}: {
  title: string;
  refNo: string;
  date: string;
  children: React.ReactNode;
}) {
  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

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
            <p className="text-xs text-slate-500">Real Estate Builder &amp; Developer</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide text-navy-950">{title}</p>
            <p className="mt-1 font-mono text-sm text-slate-500">{refNo}</p>
            <p className="text-xs text-slate-400">{date}</p>
          </div>
        </div>

        <div className="space-y-4 py-6 text-sm leading-relaxed text-navy-900">{children}</div>

        <div className="mt-10 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Prepared By</div>
          <AccountantSignature settings={companySettings} />
          <div className="border-t border-slate-300 pt-2">Recipient's Signature</div>
        </div>
      </div>
    </div>
  );
}

function AllotmentLetter({ booking }: { booking: Booking }) {
  return (
    <LetterShell title="Allotment Letter" refNo={booking.booking_ref_no} date={booking.booking_date}>
      <p>To,</p>
      <p className="font-medium">
        {booking.allottee.name}
        {booking.allottee.father_name ? ` S/O, D/O, W/O ${booking.allottee.father_name}` : ""}
        <br />
        {booking.allottee.current_address || "—"}
        {booking.allottee.cnic ? (
          <>
            <br />
            CNIC: {booking.allottee.cnic}
          </>
        ) : null}
      </p>
      <p>
        <span className="font-semibold">Subject: Allotment of Unit {booking.unit.unit_number}</span>
      </p>
      <p>Dear Sir/Madam,</p>
      <p>
        We are pleased to confirm that Unit <strong>{booking.unit.unit_number}</strong> in project{" "}
        <strong>{booking.project.project_name}</strong> has been allotted to you against Booking Ref{" "}
        <strong>{booking.booking_ref_no}</strong> dated {booking.booking_date}, at a total price of{" "}
        <strong>PKR {Number(booking.total_price).toLocaleString()}</strong>.
      </p>
      <p>
        This allotment is subject to the terms and conditions of the Booking/Allotment Agreement
        executed between you and the company, including timely payment of all installments as per
        the agreed payment schedule.
      </p>
      <p>
        Please retain this letter for your records and produce it, along with your payment receipts,
        whenever required.
      </p>
      <p className="pt-4">Yours truly,</p>
    </LetterShell>
  );
}

function TransferLetter({ booking, transfer }: { booking: Booking; transfer: BookingTransfer }) {
  return (
    <LetterShell title="Transfer Letter" refNo={transfer.transfer_no} date={transfer.transfer_date}>
      <p>To Whom It May Concern,</p>
      <p>
        <span className="font-semibold">
          Subject: Transfer of Unit {booking.unit.unit_number}, Booking Ref {booking.booking_ref_no}
        </span>
      </p>
      <p>
        This is to certify that ownership of Unit <strong>{booking.unit.unit_number}</strong> in project{" "}
        <strong>{booking.project.project_name}</strong>, booked under Ref{" "}
        <strong>{booking.booking_ref_no}</strong>, has been transferred as follows:
      </p>
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 p-4">
        <div>
          <p className="text-xs text-slate-500">Transferred From</p>
          <p className="font-medium text-navy-950">{transfer.from_allottee.name}</p>
          {transfer.from_allottee.cnic && (
            <p className="text-xs text-slate-500">CNIC: {transfer.from_allottee.cnic}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500">Transferred To</p>
          <p className="font-medium text-navy-950">{transfer.to_allottee.name}</p>
          {transfer.to_allottee.cnic && (
            <p className="text-xs text-slate-500">CNIC: {transfer.to_allottee.cnic}</p>
          )}
        </div>
      </div>
      <p>
        Effective <strong>{transfer.transfer_date}</strong>, all rights, obligations and outstanding
        dues relating to this booking stand transferred to the new allottee named above, who shall be
        bound by the original Booking/Allotment Agreement's terms and conditions.
      </p>
      {transfer.narration && <p className="text-slate-600">Remarks: {transfer.narration}</p>}
      <p className="pt-4">Yours truly,</p>
    </LetterShell>
  );
}

function PossessionLetter({ booking }: { booking: Booking }) {
  return (
    <LetterShell
      title="Possession Letter"
      refNo={`POS-${booking.booking_ref_no}`}
      date={todayIso()}
    >
      <p>To,</p>
      <p className="font-medium">
        {booking.allottee.name}
        <br />
        {booking.allottee.current_address || "—"}
      </p>
      <p>
        <span className="font-semibold">Subject: Handing Over of Possession — Unit {booking.unit.unit_number}</span>
      </p>
      <p>Dear Sir/Madam,</p>
      <p>
        We are pleased to inform you that you have cleared all outstanding dues against Unit{" "}
        <strong>{booking.unit.unit_number}</strong> in project <strong>{booking.project.project_name}</strong>,
        booked under Ref <strong>{booking.booking_ref_no}</strong>, amounting in total to{" "}
        <strong>PKR {Number(booking.total_price).toLocaleString()}</strong>.
      </p>
      <p>
        Accordingly, physical possession of the above unit is hereby handed over to you with effect
        from <strong>{todayIso()}</strong>. You are now authorized to occupy, use and, subject to the
        applicable society/authority regulations, further transfer the said unit.
      </p>
      <p>
        Kindly retain this letter along with your payment records as proof of full payment and
        possession.
      </p>
      <p className="pt-4">Yours truly,</p>
    </LetterShell>
  );
}

function CustomLetter({ booking }: { booking: Booking }) {
  const draft = JSON.parse(
    localStorage.getItem(`custom-letter-${booking.id}`) ?? "{}",
  ) as { subject?: string; body?: string };

  return (
    <LetterShell title="Letter" refNo={booking.booking_ref_no} date={todayIso()}>
      {draft.subject && (
        <p>
          <span className="font-semibold">Subject: {draft.subject}</span>
        </p>
      )}
      {(draft.body ?? "").split("\n").map((line, i) => (
        <p key={i}>{line || " "}</p>
      ))}
      <p className="pt-4">Yours truly,</p>
    </LetterShell>
  );
}

export default function BookingLetterPrintPage() {
  const { bookingId, type } = useParams();

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: async () => (await api.get<Booking>(`/bookings/${bookingId}`)).data,
  });
  const { data: transfers } = useQuery({
    queryKey: ["booking-transfers", bookingId],
    queryFn: async () => (await api.get<BookingTransfer[]>(`/bookings/${bookingId}/transfers`)).data,
    enabled: type === "transfer",
  });

  if (isLoading || !booking) {
    return <div className="p-10 text-sm text-slate-400">Loading...</div>;
  }

  if (type === "allotment") return <AllotmentLetter booking={booking} />;

  if (type === "transfer") {
    const latest = transfers?.[0];
    if (!latest) {
      return <div className="p-10 text-sm text-danger-600">This booking has never been transferred.</div>;
    }
    return <TransferLetter booking={booking} transfer={latest} />;
  }

  if (type === "possession") {
    const fullyPaid = booking.schedule_lines.every(
      (l) => Number(l.paid_amount) >= Number(l.amount),
    );
    if (!fullyPaid) {
      return (
        <div className="p-10 text-sm text-danger-600">
          This booking still has outstanding installments — a possession letter cannot be issued yet.
        </div>
      );
    }
    return <PossessionLetter booking={booking} />;
  }

  if (type === "custom") return <CustomLetter booking={booking} />;

  return <p className="p-10 text-sm text-slate-400">Unknown letter type.</p>;
}
