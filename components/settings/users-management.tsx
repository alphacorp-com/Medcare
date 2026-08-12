"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Search, Edit2, Activity, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { LastLoginBadge } from "@/components/settings/activity/last-login-badge";

export type ModuleAction = 'read' | 'create' | 'update' | 'delete';

export type ModulePermission = {
  moduleId: string;
  actions: ModuleAction[];
};

export type SystemUser = {
  id: string;
  role: string;
  email: string;
  fullName: string;
  modules: ModulePermission[];
  lastActive?: string;
  status: 'active' | 'inactive';
};

export function UsersManagement() {
  const router = useRouter();
  
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const tp = useTranslations('patients');
  const tadm = useTranslations('admissions');
  const tph = useTranslations('pharmacy');
  const tlab = useTranslations('lab');
  const trad = useTranslations('radiology');
  const tsurg = useTranslations('surgery');
  const tbill = useTranslations('billing');
  const tplan = useTranslations('planning');
  const tmat = useTranslations('maternity');
  const tdp = useTranslations('diseasePrograms');
  const tr = useTranslations('roles');

  const ALL_MODULES = [
    { id: "MODULE_CORE_PATIENT", name: tp('module_title') },
    { id: "MODULE_ADMISSION", name: tadm('title') },
    { id: "MODULE_PHARMACY", name: tph('title') },
    { id: "MODULE_LAB", name: tlab('title') },
    { id: "MODULE_SURGERY", name: tsurg('title') },
    { id: "MODULE_RADIOLOGY", name: trad('title') },
    { id: "MODULE_BILLING", name: tbill('title') },
    { id: "MODULE_PLANNING", name: tplan('title') },
    { id: "MODULE_MATERNITY", name: tmat('title') },
    { id: "MODULE_DISEASE_PROGRAMS", name: tdp('module_title') }
  ];

  const SYSTEM_ROLES = [
    { id: "tenant_admin", name: tr('admin') },
    { id: "doctor", name: tr('physician') },
    { id: "nurse", name: tr('nurse') },
    { id: "pharmacist", name: tr('pharmacist') },
    { id: "lab_tech", name: tr('lab') },
    { id: "radiologist", name: tr('radiologist') },
    { id: "billing", name: tr('billing') },
    { id: "hr", name: tr('hr') },
    { id: "viewer", name: tr('viewer') }
  ];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/v1/users");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (error) {
        console.error("Failed to fetch users", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredUsers = users.filter(u => 
    u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  const [selectedRole, setSelectedRole] = useState<string>(SYSTEM_ROLES[0].id);
  const [selectedModules, setSelectedModules] = useState<Record<string, ModuleAction[]>>({
    MODULE_CORE_PATIENT: ['read'],
  });

  const handleEdit = (user: SystemUser) => {
    setEditingUser(user);
    setFormError(null);
    setSelectedRole(user.role);
    setSelectedModules(
      user.modules?.reduce((acc, module) => {
        acc[module.moduleId] = module.actions;
        return acc;
      }, {} as Record<string, ModuleAction[]>)
    );
    setIsAddOpen(true);
  };

  const toggleModuleAction = (moduleId: string, action: ModuleAction) => {
    setSelectedModules((prev) => {
      const next = { ...prev };
      const current = new Set(next[moduleId] || []);

      if (current.has(action)) {
        current.delete(action);
      } else {
        current.add(action);
      }

      if (moduleId === 'MODULE_CORE_PATIENT') {
        current.add('read');
      }

      if (current.size > 0) {
        next[moduleId] = Array.from(current);
      } else {
        delete next[moduleId];
      }

      return next;
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if(!window.confirm(`${t('confirm_remove')} ${name}?`)) return;

    try {
      const res = await fetch(`/api/v1/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete user", error);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as string;
    const status = formData.get("status") as 'active' | 'inactive';

    const modulePayload: ModulePermission[] = Object.entries(selectedModules)
      .filter(([moduleId, actions]) => actions.length > 0 || moduleId === 'MODULE_CORE_PATIENT')
      .map(([moduleId, actions]) => ({ moduleId, actions }));

    if (!modulePayload.some((m) => m.moduleId === 'MODULE_CORE_PATIENT')) {
      modulePayload.push({ moduleId: 'MODULE_CORE_PATIENT', actions: ['read'] });
    }

    const payload: { fullName: string; email: string; role: string; status: 'active' | 'inactive'; modules?: ModulePermission[] } =
      { fullName, email, role, status };
    if (role !== 'tenant_admin') {
      payload.modules = modulePayload;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      if (editingUser) {
        const res = await fetch(`/api/v1/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data?.error || t('save_user_error'));
          return;
        }
        setUsers(users.map(u => u.id === data.id ? data : u));
      } else {
        const res = await fetch('/api/v1/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data?.error || t('save_user_error'));
          return;
        }
        setUsers([data, ...users]);
      }
      setIsAddOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Failed to save user", error);
      setFormError(t('save_user_error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{t('users_roles')}</h2>
          <p className="text-xs text-slate-500">{t('users_roles_desc')}</p>
        </div>
        
        <div>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={() => {
            setEditingUser(null);
            setFormError(null);
            setSelectedRole(SYSTEM_ROLES[0].id);
            setSelectedModules({ MODULE_CORE_PATIENT: ['read'] });
            setIsAddOpen(true);
          }}>
            <PlusCircle className="w-4 h-4" /> {t('add_personnel')}
          </Button>

          <Sheet open={isAddOpen} onOpenChange={(v) => {
            setIsAddOpen(v);
            if(!v) {
              setEditingUser(null);
              setFormError(null);
              setSelectedModules({ MODULE_CORE_PATIENT: ['read'] });
              setSelectedRole(SYSTEM_ROLES[0].id);
            }
          }}>
            <SheetContent className="overflow-y-auto sm:max-w-2xl p-6 sm:p-8">
              <SheetHeader>
                <SheetTitle>{editingUser ? t('edit_user') : t('add_new_user')}</SheetTitle>
              </SheetHeader>
              <form key={editingUser ? editingUser.id : 'new-user'} onSubmit={handleCreateOrUpdate} className="space-y-6 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>{tc('name')}</Label>
                  <Input name="fullName" defaultValue={editingUser?.fullName} required placeholder="Dr. John Doe" />
                </div>
                <div className="space-y-2">
                  <Label>{tc('email')}</Label>
                  <Input name="email" type="email" defaultValue={editingUser?.email} required placeholder="john.doe@hospital.com" />
                </div>
                <div className="space-y-2">
                  <Label>{tc('role')}</Label>
                  <select name="role" value={selectedRole} onChange={(e) => {
                    const role = e.target.value;
                    setSelectedRole(role);
                    if (role === 'tenant_admin') {
                      setSelectedModules({});
                    } else if (!editingUser) {
                      setSelectedModules({ MODULE_CORE_PATIENT: ['read'] });
                    }
                  }} required className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500">
                    {SYSTEM_ROLES.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{tc('status')}</Label>
                  <select name="status" defaultValue={editingUser?.status || 'active'} className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500">
                    <option value="active">{tc('active')}</option>
                    <option value="inactive">{tc('disabled')}</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Label className="mb-3 block font-bold text-slate-700">{t('module_access_scopes')}</Label>
                {selectedRole === 'tenant_admin' ? (
                  <div className="bg-blue-50 p-4 rounded-md border border-blue-100 text-center">
                    <p className="text-sm font-semibold text-blue-700">Full System Access</p>
                    <p className="text-xs text-blue-600 mt-1">Tenant Administrators have implicit access to all modules and actions.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ALL_MODULES.map((mod) => {
                      const currentActions = selectedModules[mod.id] ?? (mod.id === 'MODULE_CORE_PATIENT' ? ['read'] : []);
                      const hasRead = currentActions.includes('read');
                      const hasCreate = currentActions.includes('create');
                      const hasUpdate = currentActions.includes('update');
                      const hasDelete = currentActions.includes('delete');

                      return (
                        <div key={mod.id} className="flex flex-col gap-3 text-sm border border-slate-200 rounded-xl p-4 hover:border-blue-200 transition-colors">
                          <div className="font-semibold text-slate-700 flex items-center justify-between">
                            <span>{mod.name}</span>
                            <span className="text-[11px] text-slate-500 uppercase tracking-[0.15em]">Actions</span>
                          </div>
                          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer text-xs text-slate-600 hover:border-blue-300">
                              <input
                                type="checkbox"
                                checked={hasRead}
                                disabled={mod.id === 'MODULE_CORE_PATIENT'}
                                onChange={() => toggleModuleAction(mod.id, 'read')}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              Read
                            </label>
                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer text-xs text-slate-600 hover:border-blue-300">
                              <input
                                type="checkbox"
                                checked={hasCreate}
                                onChange={() => toggleModuleAction(mod.id, 'create')}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              Create
                            </label>
                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer text-xs text-slate-600 hover:border-blue-300">
                              <input
                                type="checkbox"
                                checked={hasUpdate}
                                onChange={() => toggleModuleAction(mod.id, 'update')}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              Update
                            </label>
                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer text-xs text-slate-600 hover:border-blue-300">
                              <input
                                type="checkbox"
                                checked={hasDelete}
                                onChange={() => toggleModuleAction(mod.id, 'delete')}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              Delete
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {formError ? (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{formError}</p>
              ) : null}

              <SheetFooter className="border-t border-slate-100 pt-4">
                <div className="flex justify-end gap-3 w-full">
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>{tc('cancel')}</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
                    {isSaving ? tc('saving') : editingUser ? tc('save_changes') : t('create_user')}
                  </Button>
                </div>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input 
            type="search" 
            placeholder={tc('search')} 
            className="pl-9 h-9" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border border-slate-200 rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>{t('personnel')}</TableHead>
              <TableHead>{tc('role')}</TableHead>
              <TableHead>{tc('status')}</TableHead>
              <TableHead>{t('last_active')}</TableHead>
              <TableHead className="text-right">{tc('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500 text-sm">Loading...</TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500 text-sm">{tc('no_data')}</TableCell>
              </TableRow>
            ) : filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium text-slate-900">{user.fullName}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-slate-700">{SYSTEM_ROLES.find(r => r.id === user.role)?.name || user.role}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{user.modules?.length || 0} modules accessed</div>
                </TableCell>
                <TableCell>
                  {user.status === 'active' 
                    ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">{tc('active')}</span>
                    : <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800">{tc('inactive')}</span>
                  }
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  <LastLoginBadge lastActive={user.lastActive} neverLabel={t('never')} />
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => router.push(`/settings/users/${user.id}/activity`)} title={t('view_activity')}>
                    <Activity className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => handleEdit(user)} title={t('edit_user')}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(user.id, user.fullName)} title={t('delete_user')}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
