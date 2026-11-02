// Input helpers for CNIC and phone fields, shared by every form that takes them.

// Phone fields: digits plus the usual separators — letters are dropped as typed.
export const onlyPhoneChars = (v: string) => v.replace(/[^0-9+\-() ]/g, "");

// CNIC: digits only, auto-dashed as xxxxx-xxxxxxx-x (13 digits max).
export function formatCnic(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

export const cnicDigits = (v: string) => v.replace(/\D/g, "");

/** A filled-in CNIC must have all 13 digits; blank is allowed. */
export const isCompleteCnic = (v: string) => !v || cnicDigits(v).length === 13;

/** A filled-in mobile number needs at least 10 digits (e.g. 0300-1234567); blank is allowed. */
export const isCompletePhone = (v: string) => !v || v.replace(/\D/g, "").length >= 10;
