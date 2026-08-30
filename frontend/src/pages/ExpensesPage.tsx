import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, Trash2, UserPlus } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import type {
  Account,
  Employee,
  OfficeExpense,
  OwnerPersonalExpense,
  Project,
  WagePayment,
  WageType,
} from "../types";

const errorMessage = (err: unknown, fallback: string) => {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).join(", ");
  return typeof detail === "string" ? detail : fallback;
};

type ExpenseKind = "office" | "wages" | "owner";

const kindLabel: Record<ExpenseKind, string> = {
  office: "Office",
  wages: "Wages",
  owner: "Owner",
};
const kindBadgeClass: Record<ExpenseKind, string> = {
  office: "bg-info-50 text-info-700",
  wages: "bg-warning-50 text-warning-700",
  owner: "bg-onhold-50 text-onhold-700",
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const wageTypes: WageType[] = ["Monthly", "Daily"];

export default function ExpensesPage() {
  const queryClient = useQueryClient();

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
  });
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects/")).data,
  });

  const cashAccounts = accounts?.filter((a) => a.nature === "Asset" && !a.is_control) ?? [];
  const expenseAccounts = accounts?.filter((a) => a.nature === "Expense" && !a.is_control) ?? [];
  const capitalAccounts = accounts?.filter((a) => a.nature === "Capital" && !a.is_control) ?? [];

  // ---- Office Expenses ----
  const [officeModalOpen, setOfficeModalOpen] = React.useState(false);
  const [officeForm, setOfficeForm] = React.useState({
    expense_head_id: "",
    project_id: "",
    paid_from_id: "",
    amount: "",
    narration: "",
  });

  const { data: officeExpenses, isLoading: officeLoading } = useQuery({
    queryKey: ["office-expenses"],
    queryFn: async () => (await api.get<OfficeExpense[]>("/expenses/office")).data,
  });

  const [officeError, setOfficeError] = React.useState<string | null>(null);

  const createOfficeExpense = useMutation({
    mutationFn: async () =>
      (
        await api.post<OfficeExpense>("/expenses/office", {
          expense_date: todayIso(),
          expense_head_id: Number(officeForm.expense_head_id),
          project_id: officeForm.project_id ? Number(officeForm.project_id) : null,
          paid_from_id: Number(officeForm.paid_from_id),
          amount: Number(officeForm.amount),
          narration: officeForm.narration || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setOfficeModalOpen(false);
      setOfficeForm({ expense_head_id: "", project_id: "", paid_from_id: "", amount: "", narration: "" });
      setOfficeError(null);
    },
    onError: (err: unknown) => setOfficeError(errorMessage(err, "Failed to save office expense")),
  });

  const deleteOfficeExpense = useMutation({
    mutationFn: async (id: number) => api.delete(`/expenses/office/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  // ---- Employees & Wages ----
  const [employeeModalOpen, setEmployeeModalOpen] = React.useState(false);
  const [employeeForm, setEmployeeForm] = React.useState({
    name: "",
    designation: "",
    site_department: "",
    wage_type: "Monthly" as WageType,
    rate: "",
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<Employee[]>("/expenses/employees")).data,
  });

  const [employeeError, setEmployeeError] = React.useState<string | null>(null);

  const createEmployee = useMutation({
    mutationFn: async () =>
      (
        await api.post<Employee>("/expenses/employees", {
          name: employeeForm.name,
          designation: employeeForm.designation || null,
          site_department: employeeForm.site_department || null,
          wage_type: employeeForm.wage_type,
          rate: employeeForm.rate ? Number(employeeForm.rate) : 0,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setEmployeeForm({ name: "", designation: "", site_department: "", wage_type: "Monthly", rate: "" });
      setEmployeeError(null);
    },
    onError: (err: unknown) => setEmployeeError(errorMessage(err, "Failed to add employee.")),
  });

  const [wageModalOpen, setWageModalOpen] = React.useState(false);
  const [wageForm, setWageForm] = React.useState({
    employee_id: "",
    period_from: "",
    period_to: "",
    gross_amount: "",
    advances_deductions: "",
    paid_from_id: "",
    narration: "",
  });
  const [wageError, setWageError] = React.useState<string | null>(null);

  const { data: wagePayments, isLoading: wagesLoading } = useQuery({
    queryKey: ["wage-payments"],
    queryFn: async () => (await api.get<WagePayment[]>("/expenses/wages")).data,
  });

  const netPreview =
    (Number(wageForm.gross_amount) || 0) - (Number(wageForm.advances_deductions) || 0);

  const selectEmployee = (employeeId: string) => {
    const emp = employees?.find((e) => e.id === Number(employeeId));
    setWageForm((f) => ({
      ...f,
      employee_id: employeeId,
      gross_amount: emp ? String(emp.rate) : f.gross_amount,
    }));
  };

  const createWagePayment = useMutation({
    mutationFn: async () =>
      (
        await api.post<WagePayment>("/expenses/wages", {
          payment_date: todayIso(),
          employee_id: Number(wageForm.employee_id),
          period_from: wageForm.period_from,
          period_to: wageForm.period_to,
          gross_amount: Number(wageForm.gross_amount),
          advances_deductions: wageForm.advances_deductions ? Number(wageForm.advances_deductions) : 0,
          paid_from_id: Number(wageForm.paid_from_id),
          narration: wageForm.narration || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wage-payments"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setWageModalOpen(false);
      setWageForm({
        employee_id: "",
        period_from: "",
        period_to: "",
        gross_amount: "",
        advances_deductions: "",
        paid_from_id: "",
        narration: "",
      });
      setWageError(null);
    },
    onError: (err: unknown) => setWageError(errorMessage(err, "Failed to record wage payment")),
  });

  const deleteWagePayment = useMutation({
    mutationFn: async (id: number) => api.delete(`/expenses/wages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wage-payments"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  // ---- Owner Personal Expenses ----
  const [ownerModalOpen, setOwnerModalOpen] = React.useState(false);
  const [ownerForm, setOwnerForm] = React.useState({
    category: "",
    source_account_id: "",
    amount: "",
    remarks: "",
  });

  const { data: ownerExpenses, isLoading: ownerLoading } = useQuery({
    queryKey: ["owner-expenses"],
    queryFn: async () => (await api.get<OwnerPersonalExpense[]>("/expenses/owner-personal")).data,
  });

  const [ownerError, setOwnerError] = React.useState<string | null>(null);

  const createOwnerExpense = useMutation({
    mutationFn: async () =>
      (
        await api.post<OwnerPersonalExpense>("/expenses/owner-personal", {
          expense_date: todayIso(),
          category: ownerForm.category,
          source_account_id: Number(ownerForm.source_account_id),
          amount: Number(ownerForm.amount),
          remarks: ownerForm.remarks || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setOwnerModalOpen(false);
      setOwnerForm({ category: "", source_account_id: "", amount: "", remarks: "" });
      setOwnerError(null);
    },
    onError: (err: unknown) => setOwnerError(errorMessage(err, "Failed to save owner expense")),
  });

  const deleteOwnerExpense = useMutation({
    mutationFn: async (id: number) => api.delete(`/expenses/owner-personal/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  // ---- Unified list across all three expense types ----
  type UnifiedRow = {
    key: string;
    kind: ExpenseKind;
    id: number;
    expense_no: string;
    date: string;
    description: string;
    amount: number;
  };

  const unifiedRows: UnifiedRow[] = [
    ...(officeExpenses ?? []).map((e) => ({
      key: `office-${e.id}`,
      kind: "office" as const,
      id: e.id,
      expense_no: e.expense_no,
      date: e.expense_date,
      description: e.expense_head.name + (e.project ? ` · ${e.project.project_name}` : ""),
      amount: Number(e.amount),
    })),
    ...(wagePayments ?? []).map((w) => ({
      key: `wages-${w.id}`,
      kind: "wages" as const,
      id: w.id,
      expense_no: w.payment_no,
      date: w.payment_date,
      description: `Salary / Wages — ${w.employee.name}`,
      amount: Number(w.net_paid),
    })),
    ...(ownerExpenses ?? []).map((e) => ({
      key: `owner-${e.id}`,
      kind: "owner" as const,
      id: e.id,
      expense_no: e.expense_no,
      date: e.expense_date,
      description: e.category,
      amount: Number(e.amount),
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));

  const unifiedLoading = officeLoading || wagesLoading || ownerLoading;

  const printUrl = (row: UnifiedRow) =>
    row.kind === "wages" ? `/expenses/wages/${row.id}/print` : `/expenses/${row.kind === "office" ? "office" : "owner-personal"}/${row.id}/print`;

  const deleteRow = (row: UnifiedRow) => {
    if (!window.confirm(`Delete expense "${row.expense_no}"?`)) return;
    if (row.kind === "office") deleteOfficeExpense.mutate(row.id);
    else if (row.kind === "wages") deleteWagePayment.mutate(row.id);
    else deleteOwnerExpense.mutate(row.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Expense Management</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Office expenses, staff wages, and the owner's personal expenses — all in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEmployeeModalOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Employees
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setOwnerModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Owner Expense
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setWageModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Wage Payment
          </Button>
          <Button size="sm" onClick={() => setOfficeModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Office Expense
          </Button>
        </div>
      </div>

      <Card>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Expense #</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Description</th>
              <th className="px-5 py-3 text-right font-medium">Amount</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {unifiedLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                  Loading...
                </td>
              </tr>
            )}
            {!unifiedLoading && unifiedRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                  No expenses recorded yet.
                </td>
              </tr>
            )}
            {unifiedRows.map((row) => (
              <tr key={row.key}>
                <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{row.expense_no}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{row.date}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${kindBadgeClass[row.kind]}`}>
                    {kindLabel[row.kind]}
                  </span>
                </td>
                <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{row.description}</td>
                <td className="px-5 py-3 text-right font-medium text-navy-900 dark:text-slate-100">
                  PKR {row.amount.toLocaleString()}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => window.open(printUrl(row), "_blank")}
                      className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteRow(row)}
                      className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Office Expense Modal */}
      <Modal
        open={officeModalOpen}
        onClose={() => {
          setOfficeModalOpen(false);
          setOfficeError(null);
        }}
        title="New Office Expense"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createOfficeExpense.mutate();
          }}
          className="space-y-4"
        >
          {officeError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{officeError}</p>
          )}
          <div>
            <Label htmlFor="oe_head">Expense Head</Label>
            <Select
              id="oe_head"
              required
              value={officeForm.expense_head_id}
              onChange={(e) => setOfficeForm({ ...officeForm, expense_head_id: e.target.value })}
            >
              <option value="">Select account</option>
              {expenseAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="oe_project">Project (optional)</Label>
              <Select
                id="oe_project"
                value={officeForm.project_id}
                onChange={(e) => setOfficeForm({ ...officeForm, project_id: e.target.value })}
              >
                <option value="">— General —</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="oe_paid_from">Paid From</Label>
              <Select
                id="oe_paid_from"
                required
                value={officeForm.paid_from_id}
                onChange={(e) => setOfficeForm({ ...officeForm, paid_from_id: e.target.value })}
              >
                <option value="">Select account</option>
                {cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="oe_amount">Amount</Label>
            <Input
              id="oe_amount"
              type="number"
              required
              value={officeForm.amount}
              onChange={(e) => setOfficeForm({ ...officeForm, amount: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="oe_narration">Narration</Label>
            <Input
              id="oe_narration"
              value={officeForm.narration}
              onChange={(e) => setOfficeForm({ ...officeForm, narration: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOfficeModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createOfficeExpense.isPending}>
              Save Expense
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Employees Modal */}
      <Modal
        open={employeeModalOpen}
        onClose={() => {
          setEmployeeModalOpen(false);
          setEmployeeError(null);
        }}
        title="Employees"
        description="Add staff for wage/salary tracking."
      >
        <div className="space-y-4">
          {employeeError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{employeeError}</p>
          )}
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {employees?.length === 0 && <li className="text-sm text-slate-400 dark:text-slate-500">No employees yet.</li>}
            {employees?.map((emp) => (
              <li
                key={emp.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-navy-800 px-3 py-2 text-sm"
              >
                <span className="font-medium text-navy-900 dark:text-slate-100">
                  {emp.name} <span className="text-slate-400 dark:text-slate-500">({emp.employee_code})</span>
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  PKR {Number(emp.rate).toLocaleString()} / {emp.wage_type}
                </span>
              </li>
            ))}
          </ul>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createEmployee.mutate();
            }}
            className="space-y-3 border-t border-slate-100 dark:border-navy-800 pt-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="emp_name">Name</Label>
                <Input
                  id="emp_name"
                  required
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="emp_designation">Designation</Label>
                <Input
                  id="emp_designation"
                  value={employeeForm.designation}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="emp_dept">Site / Department</Label>
                <Input
                  id="emp_dept"
                  value={employeeForm.site_department}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, site_department: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="emp_wage_type">Wage Type</Label>
                <Select
                  id="emp_wage_type"
                  value={employeeForm.wage_type}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, wage_type: e.target.value as WageType })
                  }
                >
                  {wageTypes.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="emp_rate">Rate</Label>
                <Input
                  id="emp_rate"
                  type="number"
                  value={employeeForm.rate}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, rate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={createEmployee.isPending}>
                Add Employee
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Wage Payment Modal */}
      <Modal
        open={wageModalOpen}
        onClose={() => {
          setWageModalOpen(false);
          setWageError(null);
        }}
        title="New Wage / Salary Payment"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setWageError(null);
            createWagePayment.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="wp_employee">Employee</Label>
            <Select
              id="wp_employee"
              required
              value={wageForm.employee_id}
              onChange={(e) => selectEmployee(e.target.value)}
            >
              <option value="">Select employee</option>
              {employees?.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="wp_from">Period From</Label>
              <Input
                id="wp_from"
                type="date"
                required
                value={wageForm.period_from}
                onChange={(e) => setWageForm({ ...wageForm, period_from: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="wp_to">Period To</Label>
              <Input
                id="wp_to"
                type="date"
                required
                value={wageForm.period_to}
                onChange={(e) => setWageForm({ ...wageForm, period_to: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="wp_gross">Gross Amount</Label>
              <Input
                id="wp_gross"
                type="number"
                required
                value={wageForm.gross_amount}
                onChange={(e) => setWageForm({ ...wageForm, gross_amount: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="wp_deductions">Advances / Deductions</Label>
              <Input
                id="wp_deductions"
                type="number"
                value={wageForm.advances_deductions}
                onChange={(e) => setWageForm({ ...wageForm, advances_deductions: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="wp_paid_from">Paid From</Label>
            <Select
              id="wp_paid_from"
              required
              value={wageForm.paid_from_id}
              onChange={(e) => setWageForm({ ...wageForm, paid_from_id: e.target.value })}
            >
              <option value="">Select account</option>
              {cashAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          {netPreview > 0 && (
            <div className="rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
              Net Paid: <span className="font-semibold">PKR {netPreview.toLocaleString()}</span>
            </div>
          )}
          <div>
            <Label htmlFor="wp_narration">Narration</Label>
            <Input
              id="wp_narration"
              value={wageForm.narration}
              onChange={(e) => setWageForm({ ...wageForm, narration: e.target.value })}
            />
          </div>
          {wageError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{wageError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setWageModalOpen(false);
                setWageError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createWagePayment.isPending || netPreview <= 0}>
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Owner Personal Expense Modal */}
      <Modal
        open={ownerModalOpen}
        onClose={() => {
          setOwnerModalOpen(false);
          setOwnerError(null);
        }}
        title="New Owner Personal Expense"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createOwnerExpense.mutate();
          }}
          className="space-y-4"
        >
          {ownerError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{ownerError}</p>
          )}
          <div>
            <Label htmlFor="ope_category">Category</Label>
            <Input
              id="ope_category"
              required
              value={ownerForm.category}
              onChange={(e) => setOwnerForm({ ...ownerForm, category: e.target.value })}
              placeholder="e.g. Family Medical, Travel, Personal Shopping"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ope_source">Source Account</Label>
              <Select
                id="ope_source"
                required
                value={ownerForm.source_account_id}
                onChange={(e) => setOwnerForm({ ...ownerForm, source_account_id: e.target.value })}
              >
                <option value="">Select account</option>
                {[...capitalAccounts, ...cashAccounts].map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ope_amount">Amount</Label>
              <Input
                id="ope_amount"
                type="number"
                required
                value={ownerForm.amount}
                onChange={(e) => setOwnerForm({ ...ownerForm, amount: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ope_remarks">Remarks</Label>
            <Input
              id="ope_remarks"
              value={ownerForm.remarks}
              onChange={(e) => setOwnerForm({ ...ownerForm, remarks: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOwnerModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createOwnerExpense.isPending}>
              Save Expense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
