import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Database, PenLine, XCircle } from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input, Label } from "../components/ui/Input";
import { AccessDenied } from "../components/ui/AccessDenied";
import type { CompanySettings, DataIntegrityReport } from "../types";

type AdminTab = "signature" | "backup" | "integrity";

export default function AdminPage() {
  const isAdmin = useAuthStore((s) => s.user?.role.is_admin);
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<AdminTab>("signature");

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
    enabled: !!isAdmin,
  });

  const [form, setForm] = React.useState({
    company_name: "",
    accountant_name: "",
    accountant_designation: "",
    signature_image_url: "",
  });

  React.useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name,
        accountant_name: settings.accountant_name ?? "",
        accountant_designation: settings.accountant_designation ?? "",
        signature_image_url: settings.signature_image_url ?? "",
      });
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () =>
      (
        await api.put<CompanySettings>("/admin/settings", {
          company_name: form.company_name,
          accountant_name: form.accountant_name || null,
          accountant_designation: form.accountant_designation || null,
          signature_image_url: form.signature_image_url || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      window.alert("Signature settings saved.");
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(detail ?? "Failed to save settings.");
    },
  });

  const [downloading, setDownloading] = React.useState(false);
  const downloadBackup = async () => {
    setDownloading(true);
    try {
      const response = await api.get("/admin/backup", { responseType: "blob" });
      const disposition = response.headers["content-disposition"] as string | undefined;
      const match = disposition?.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? "hamdan_erp_backup.sql";

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(detail ?? "Failed to download backup.");
    } finally {
      setDownloading(false);
    }
  };

  const [integrityReport, setIntegrityReport] = React.useState<DataIntegrityReport | null>(null);
  const runIntegrityCheck = useMutation({
    mutationFn: async () => (await api.get<DataIntegrityReport>("/admin/data-integrity")).data,
    onSuccess: (report) => setIntegrityReport(report),
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(detail ?? "Failed to run data integrity check.");
    },
  });

  if (!isAdmin) {
    return (
      <AccessDenied message="Admin Utilities is only available to admin accounts." />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Admin Utilities</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Signature setup for printed documents, database backup, and data integrity checks.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-navy-700">
        {(
          [
            { key: "signature", label: "Signature Setup" },
            { key: "backup", label: "Backup" },
            { key: "integrity", label: "Data Integrity" },
          ] as { key: AdminTab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-slate-500 dark:text-slate-400 hover:text-navy-800 dark:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "signature" && (
        <Card>
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <PenLine className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">
              Print Signature Setup
            </h3>
          </div>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This appears in the "Accountant" slot on every printed voucher, receipt, refund,
              expense and report.
            </p>
            <div>
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="accountant_name">Accountant Name</Label>
                <Input
                  id="accountant_name"
                  value={form.accountant_name}
                  onChange={(e) => setForm({ ...form, accountant_name: e.target.value })}
                  placeholder="e.g. Muhammad Hamdan"
                />
              </div>
              <div>
                <Label htmlFor="accountant_designation">Designation</Label>
                <Input
                  id="accountant_designation"
                  value={form.accountant_designation}
                  onChange={(e) => setForm({ ...form, accountant_designation: e.target.value })}
                  placeholder="e.g. Chief Accountant"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="signature_image_url">Signature Image URL (optional)</Label>
              <Input
                id="signature_image_url"
                value={form.signature_image_url}
                onChange={(e) => setForm({ ...form, signature_image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "backup" && (
        <Card>
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <Database className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">
              Database Backup
            </h3>
          </div>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Downloads a full SQL dump of the live database (<code>mysqldump</code>) — keep it
              somewhere safe.
            </p>
            <Button onClick={downloadBackup} disabled={downloading}>
              <Database className="h-4 w-4" />
              {downloading ? "Preparing backup..." : "Download Backup"}
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "integrity" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">
              Data Integrity Check
            </h3>
            <Button size="sm" onClick={() => runIntegrityCheck.mutate()} disabled={runIntegrityCheck.isPending}>
              {runIntegrityCheck.isPending ? "Running..." : "Run Check"}
            </Button>
          </div>
          <CardContent>
            {!integrityReport ? (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                Click "Run Check" to scan for data inconsistencies.
              </p>
            ) : (
              <div className="space-y-3">
                {integrityReport.results.map((r) => (
                  <div
                    key={r.name}
                    className="rounded-lg border border-slate-100 dark:border-navy-800 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-navy-900 dark:text-slate-100">
                        {r.ok ? (
                          <CheckCircle2 className="h-4 w-4 text-success-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-danger-600" />
                        )}
                        {r.name}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          r.ok ? "text-success-700" : "text-danger-600"
                        }`}
                      >
                        {r.ok ? "OK" : `${r.issue_count} issue${r.issue_count === 1 ? "" : "s"}`}
                      </span>
                    </div>
                    {!r.ok && (
                      <ul className="mt-2 space-y-1 pl-6 text-xs text-slate-500 dark:text-slate-400">
                        {r.details.map((d, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-danger-400" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
