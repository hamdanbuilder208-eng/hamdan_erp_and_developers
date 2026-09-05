import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { AccessDenied } from "../components/ui/AccessDenied";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import type { ModuleInfo, Role, User } from "../types";

type Tab = "users" | "roles";

const emptyUserForm = {
  username: "",
  email: "",
  full_name: "",
  password: "",
  role_id: "",
  is_active: true,
};

const emptyRoleForm = {
  name: "",
  description: "",
  is_admin: false,
  allowed_modules: [] as string[],
};

export default function UsersRolesPage() {
  const isAdmin = useAuthStore((s) => s.user?.role.is_admin);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<Tab>("users");

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => (await api.get<User[]>("/users/")).data,
    enabled: !!isAdmin,
  });

  const { data: roles } = useQuery({
    queryKey: ["staff-roles"],
    queryFn: async () => (await api.get<Role[]>("/users/roles")).data,
    enabled: !!isAdmin,
  });

  const { data: modules } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => (await api.get<ModuleInfo[]>("/users/modules")).data,
    enabled: !!isAdmin,
  });

  // ---- Users ----
  const [userModalOpen, setUserModalOpen] = React.useState(false);
  const [userForm, setUserForm] = React.useState(emptyUserForm);
  const [editingUserId, setEditingUserId] = React.useState<number | null>(null);
  const [userError, setUserError] = React.useState<string | null>(null);

  const openNewUser = () => {
    setEditingUserId(null);
    setUserForm(emptyUserForm);
    setUserError(null);
    setUserModalOpen(true);
  };

  const openEditUser = (u: User) => {
    setEditingUserId(u.id);
    setUserForm({
      username: u.username,
      email: u.email ?? "",
      full_name: u.full_name ?? "",
      password: "",
      role_id: String(u.role_id),
      is_active: u.is_active,
    });
    setUserError(null);
    setUserModalOpen(true);
  };

  const saveUser = useMutation({
    mutationFn: async () => {
      if (editingUserId) {
        return (
          await api.put<User>(`/users/${editingUserId}`, {
            email: userForm.email || null,
            full_name: userForm.full_name || null,
            role_id: Number(userForm.role_id),
            is_active: userForm.is_active,
            ...(userForm.password ? { password: userForm.password } : {}),
          })
        ).data;
      }
      return (
        await api.post<User>("/users/", {
          username: userForm.username,
          email: userForm.email || null,
          full_name: userForm.full_name || null,
          role_id: Number(userForm.role_id),
          is_active: userForm.is_active,
          password: userForm.password,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      setUserModalOpen(false);
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setUserError(detail ?? "Failed to save user.");
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-users"] }),
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete user."));
    },
  });

  // ---- Roles ----
  const [roleModalOpen, setRoleModalOpen] = React.useState(false);
  const [roleForm, setRoleForm] = React.useState(emptyRoleForm);
  const [editingRoleId, setEditingRoleId] = React.useState<number | null>(null);
  const [roleError, setRoleError] = React.useState<string | null>(null);

  const openNewRole = () => {
    setEditingRoleId(null);
    setRoleForm(emptyRoleForm);
    setRoleError(null);
    setRoleModalOpen(true);
  };

  const openEditRole = (r: Role) => {
    setEditingRoleId(r.id);
    setRoleForm({
      name: r.name,
      description: r.description ?? "",
      is_admin: r.is_admin,
      allowed_modules: r.allowed_modules,
    });
    setRoleError(null);
    setRoleModalOpen(true);
  };

  const toggleModule = (key: string) => {
    setRoleForm((f) => ({
      ...f,
      allowed_modules: f.allowed_modules.includes(key)
        ? f.allowed_modules.filter((m) => m !== key)
        : [...f.allowed_modules, key],
    }));
  };

  const saveRole = useMutation({
    mutationFn: async () => {
      const payload = {
        name: roleForm.name,
        description: roleForm.description || null,
        is_admin: roleForm.is_admin,
        allowed_modules: roleForm.allowed_modules,
      };
      if (editingRoleId) {
        return (await api.put<Role>(`/users/roles/${editingRoleId}`, payload)).data;
      }
      return (await api.post<Role>("/users/roles", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-roles"] });
      setRoleModalOpen(false);
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setRoleError(detail ?? "Failed to save role.");
    },
  });

  const deleteRole = useMutation({
    mutationFn: async (id: number) => api.delete(`/users/roles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-roles"] }),
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete role."));
    },
  });

  if (!isAdmin) {
    return <AccessDenied message="Users & Roles is only available to admin accounts." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Users & Roles</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Staff accounts and what each role is allowed to access.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-navy-700">
        {(
          [
            { key: "users", label: "Users" },
            { key: "roles", label: "Roles" },
          ] as { key: Tab; label: string }[]
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

      {tab === "users" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Staff Users</h3>
            <Button size="sm" onClick={openNewUser}>
              <Plus className="h-4 w-4" />
              New User
            </Button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Username</th>
                <th className="px-5 py-3 font-medium">Full Name</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {usersLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                    Loading...
                  </td>
                </tr>
              )}
              {users?.map((u) => (
                <tr key={u.id} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800" onClick={() => openEditUser(u)}>
                  <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{u.username}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{u.full_name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge tone={u.role.is_admin ? "purple" : "info"}>{u.role.name}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={u.is_active ? "success" : "danger"}>
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {u.id !== currentUserId && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm(`Delete user "${u.username}"? This cannot be undone.`, {
                            danger: true,
                            confirmLabel: "Delete",
                          });
                          if (ok) deleteUser.mutate(u.id);
                        }}
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "roles" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Roles</h3>
            <Button size="sm" onClick={openNewRole}>
              <Plus className="h-4 w-4" />
              New Role
            </Button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Access</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {roles?.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                  <td className="px-5 py-3 cursor-pointer text-navy-900 dark:text-slate-100" onClick={() => openEditRole(r)}>
                    {r.name}
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{r.description ?? "—"}</td>
                  <td className="px-5 py-3">
                    {r.is_admin ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Full access (Admin)
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {r.allowed_modules.length} module{r.allowed_modules.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={async () => {
                        const ok = await confirm(`Delete role "${r.name}"?`, { danger: true, confirmLabel: "Delete" });
                        if (ok) deleteRole.mutate(r.id);
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
      )}

      {/* ---- User Modal ---- */}
      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editingUserId ? "Edit User" : "New User"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveUser.mutate();
          }}
          className="space-y-4"
        >
          {userError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{userError}</p>
          )}
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              required
              disabled={!!editingUserId}
              value={userForm.username}
              onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={userForm.full_name}
                onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="password">{editingUserId ? "New Password (leave blank to keep)" : "Password"}</Label>
            <Input
              id="password"
              type="password"
              required={!editingUserId}
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="role_id">Role</Label>
              <Select
                id="role_id"
                required
                value={userForm.role_id}
                onChange={(e) => setUserForm({ ...userForm, role_id: e.target.value })}
              >
                <option value="">Select role</option>
                {roles?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="is_active">Status</Label>
              <Select
                id="is_active"
                value={userForm.is_active ? "active" : "inactive"}
                onChange={(e) => setUserForm({ ...userForm, is_active: e.target.value === "active" })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setUserModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveUser.isPending}>
              {editingUserId ? "Save Changes" : "Create User"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Role Modal ---- */}
      <Modal
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title={editingRoleId ? "Edit Role" : "New Role"}
        description="Choose which modules this role can access."
        className="max-w-lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveRole.mutate();
          }}
          className="space-y-4"
        >
          {roleError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{roleError}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="role_name">Name</Label>
              <Input
                id="role_name"
                required
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                placeholder="e.g. Sales"
              />
            </div>
            <div>
              <Label htmlFor="role_description">Description</Label>
              <Input
                id="role_description"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-navy-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={roleForm.is_admin}
              onChange={(e) => setRoleForm({ ...roleForm, is_admin: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Is Admin (full access to everything, including Users &amp; Admin Utilities)
          </label>

          {!roleForm.is_admin && (
            <div>
              <Label>Modules</Label>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 dark:border-navy-700">
                {modules?.map((m) => (
                  <label
                    key={m.key}
                    className="flex items-center gap-2 text-sm text-navy-800 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={roleForm.allowed_modules.includes(m.key)}
                      onChange={() => toggleModule(m.key)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveRole.isPending}>
              {editingRoleId ? "Save Changes" : "Create Role"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
