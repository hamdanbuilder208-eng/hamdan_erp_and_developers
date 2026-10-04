// The Reports page filter: "" = whole company, a project id, or one of the
// non-project scopes below (sent to the backend as ?scope=…).
export const REPORT_SCOPES = {
  office: "Office / General",
  land: "Land & Plots",
} as const;
export type ReportScope = keyof typeof REPORT_SCOPES;

export const isReportScope = (filter: string): filter is ReportScope => filter in REPORT_SCOPES;

/** Query params for a report request. */
export function reportFilterParams(filter: string | null) {
  if (!filter) return undefined;
  return isReportScope(filter) ? { scope: filter } : { project_id: Number(filter) };
}

/** "?project_id=…" / "?scope=…" appended to a print page URL. */
export function withReportFilter(path: string, filter: string) {
  if (!filter) return path;
  const key = isReportScope(filter) ? "scope" : "project_id";
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${filter}`;
}

/** Reads the filter back from a print page's URL. */
export const reportFilterFromSearch = (searchParams: URLSearchParams) =>
  searchParams.get("scope") ?? searchParams.get("project_id") ?? "";
