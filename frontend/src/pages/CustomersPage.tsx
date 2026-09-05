import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Phone, Plus, Search, Trash2, UserRound } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { TableRowsSkeleton } from "../components/ui/Skeleton";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import type { Allottee } from "../types";

const API_ORIGIN = new URL(api.defaults.baseURL ?? "", window.location.origin).origin;
const photoUrl = (path: string | null) => (path ? `${API_ORIGIN}${path}` : null);

const emptyForm = {
  name: "",
  father_name: "",
  address: "",
  mobile: "",
  tel_res: "",
  office_phone: "",
  cnic: "",
  email: "",
  referred_by: "",
  picture_url: "" as string | null,
  nominee_name: "",
  nominee_relation: "",
  nominee_cnic: "",
  nominee_picture_url: "" as string | null,
};

function PhotoPicker({
  label,
  url,
  onChange,
}: {
  label: string;
  url: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<{ url: string }>("/uploads/image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.url;
    },
    onSuccess: (uploadedUrl) => onChange(uploadedUrl),
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to upload photo."));
    },
  });

  return (
    <div>
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-brand-400 hover:text-brand-500 dark:border-navy-700 dark:bg-navy-800"
      >
        {upload.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : url ? (
          <img src={photoUrl(url) ?? undefined} alt={label} className="h-full w-full object-cover" />
        ) : (
          <Camera className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [form, setForm] = React.useState(emptyForm);

  const { data: allottees, isLoading } = useQuery({
    queryKey: ["allottees", search],
    queryFn: async () =>
      (await api.get<Allottee[]>("/allottees/", { params: { search: search || undefined } })).data,
  });

  const createAllottee = useMutation({
    mutationFn: async () =>
      (
        await api.post<Allottee>("/allottees/", {
          name: form.name,
          father_name: form.father_name || null,
          address: form.address || null,
          mobile: form.mobile || null,
          tel_res: form.tel_res || null,
          office_phone: form.office_phone || null,
          cnic: form.cnic || null,
          email: form.email || null,
          referred_by: form.referred_by || null,
          picture_url: form.picture_url || null,
          nominee_name: form.nominee_name || null,
          nominee_relation: form.nominee_relation || null,
          nominee_cnic: form.nominee_cnic || null,
          nominee_picture_url: form.nominee_picture_url || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allottees"] });
      setModalOpen(false);
      setForm(emptyForm);
    },
  });

  const deleteAllottee = useMutation({
    mutationFn: async (id: number) => api.delete(`/allottees/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allottees"] }),
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete allottee."));
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Customers &amp; Allottees</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Buyer and nominee records, linked to bookings across projects.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Allottee
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, CNIC, mobile, code..."
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Code</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Father's Name</th>
              <th className="px-5 py-3 font-medium">Contact</th>
              <th className="px-5 py-3 font-medium">CNIC</th>
              <th className="px-5 py-3 font-medium">Referred By</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {isLoading && <TableRowsSkeleton rows={4} cols={7} />}
            {!isLoading && allottees?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                  No allottees yet. Click "New Allottee" to register a customer.
                </td>
              </tr>
            )}
            {allottees?.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{a.allottee_code}</td>
                <td className="px-5 py-3 font-medium text-navy-900 dark:text-slate-100">
                  <span className="inline-flex items-center gap-2">
                    {a.picture_url ? (
                      <img
                        src={photoUrl(a.picture_url) ?? undefined}
                        alt={a.name}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <UserRound className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    )}
                    {a.name}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{a.father_name || "—"}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {a.mobile ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      {a.mobile}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{a.cnic || "—"}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{a.referred_by || "—"}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={async () => {
                      const ok = await confirm(`Delete allottee "${a.name}"?`, {
                        danger: true,
                        confirmLabel: "Delete",
                      });
                      if (ok) deleteAllottee.mutate(a.id);
                    }}
                    className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Allottee"
        description="Register a customer / allottee and their nominee."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createAllottee.mutate();
          }}
          className="space-y-4"
        >
          <div className="flex gap-4">
            <PhotoPicker
              label="Photo"
              url={form.picture_url}
              onChange={(url) => setForm({ ...form, picture_url: url })}
            />
            <div className="grid flex-1 grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="father_name">Father's Name</Label>
                <Input
                  id="father_name"
                  value={form.father_name}
                  onChange={(e) => setForm({ ...form, father_name: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mobile">Mobile No.</Label>
              <Input
                id="mobile"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                placeholder="03xx-xxxxxxx"
              />
            </div>
            <div>
              <Label htmlFor="cnic">CNIC / NIC No.</Label>
              <Input
                id="cnic"
                value={form.cnic}
                onChange={(e) => setForm({ ...form, cnic: e.target.value })}
                placeholder="xxxxx-xxxxxxx-x"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tel_res">Tel (Res.)</Label>
              <Input
                id="tel_res"
                value={form.tel_res}
                onChange={(e) => setForm({ ...form, tel_res: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="office_phone">Office</Label>
              <Input
                id="office_phone"
                value={form.office_phone}
                onChange={(e) => setForm({ ...form, office_phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="referred_by">Referred By</Label>
              <Input
                id="referred_by"
                value={form.referred_by}
                onChange={(e) => setForm({ ...form, referred_by: e.target.value })}
                placeholder="Booking agent, if any"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-navy-800 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Nominee Details
            </p>
            <div className="flex gap-4">
              <PhotoPicker
                label="Nominee Photo"
                url={form.nominee_picture_url}
                onChange={(url) => setForm({ ...form, nominee_picture_url: url })}
              />
              <div className="grid flex-1 grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="nominee_name">Nominee Name</Label>
                  <Input
                    id="nominee_name"
                    value={form.nominee_name}
                    onChange={(e) => setForm({ ...form, nominee_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="nominee_relation">Relation</Label>
                  <Input
                    id="nominee_relation"
                    value={form.nominee_relation}
                    onChange={(e) => setForm({ ...form, nominee_relation: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="nominee_cnic">Nominee CNIC</Label>
                  <Input
                    id="nominee_cnic"
                    value={form.nominee_cnic}
                    onChange={(e) => setForm({ ...form, nominee_cnic: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAllottee.isPending}>
              Save Allottee
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
