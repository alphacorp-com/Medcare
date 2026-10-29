"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit2, Trash2, ShieldCheck, Stethoscope, Users } from "lucide-react";
import { SettingsList, SettingsListItem, SettingsPageHeader, SettingsPill, settingsActionButtonClass } from "@/components/settings/settings-ui";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { ModulePermissionMatrix } from "@/components/settings/module-permission-matrix";
import { useConfirm } from "@/components/providers/confirm-provider";
import { toast } from "sonner";

export type ModuleAction = 'read' | 'create' | 'update' | 'delete' | 'validate';

export type ModulePermission = {
  moduleId: string;
  actions: ModuleAction[];
};

export type SystemRole = {
  id: string;
  name: string;
  isSystemAdmin: boolean;
  isClinicalProvider: boolean;
  defaultModules: ModulePermission[];
  userCount: number;
};

export function RolesManagement() {
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<SystemRole | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdminRole, setIsAdminRole] = useState(false);
  const [isClinicalProviderRole, setIsClinicalProviderRole] = useState(false);
  const [selectedModules, setSelectedModules] = useState<Record<string, ModuleAction[]>>({});

  const t = useTranslations('settings');
  const confirm = useConfirm();
  const tc = useTranslations('common');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/v1/roles");
        if (res.ok && !cancelled) setRoles(await res.json());
      } catch (error) {
        console.error("Failed to fetch roles", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const resetForm = () => {
    setEditingRole(null);
    setFormError(null);
    setIsAdminRole(false);
    setIsClinicalProviderRole(false);
    setSelectedModules({ MODULE_CORE_PATIENT: ['read'] });
  };

  const handleAdd = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleEdit = (role: SystemRole) => {
    setEditingRole(role);
    setFormError(null);
    setIsAdminRole(role.isSystemAdmin);
    setIsClinicalProviderRole(role.isClinicalProvider);
    setSelectedModules(
      role.defaultModules.reduce((acc, m) => {
        acc[m.moduleId] = m.actions;
        return acc;
      }, {} as Record<string, ModuleAction[]>)
    );
    setIsOpen(true);
  };

  const handleDelete = async (role: SystemRole) => {
    if (!(await confirm({ message: `${t('confirm_delete_role')} "${role.name}"?`, tone: "danger" }))) return;
    try {
      const res = await fetch(`/api/v1/roles/${role.id}`, { method: 'DELETE' });
      if (res.ok) {
        setRoles(roles.filter(r => r.id !== role.id));
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || t('save_role_error'));
      }
    } catch (error) {
      console.error("Failed to delete role", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string)?.trim();

    if (!name) {
      setFormError(t('role_name'));
      return;
    }

    const defaultModules: ModulePermission[] = isAdminRole
      ? []
      : Object.entries(selectedModules)
          .filter(([, actions]) => actions.length > 0)
          .map(([moduleId, actions]) => ({ moduleId, actions }));

    const payload = { name, isSystemAdmin: isAdminRole, isClinicalProvider: isClinicalProviderRole, defaultModules };

    setFormError(null);
    setIsSaving(true);
    try {
      const res = await fetch(editingRole ? `/api/v1/roles/${editingRole.id}` : '/api/v1/roles', {
        method: editingRole ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data?.error || t('save_role_error'));
        return;
      }
      if (editingRole) {
        setRoles(roles.map(r => r.id === data.id ? { ...data, userCount: r.userCount } : r));
      } else {
        setRoles([...roles, { ...data, userCount: 0 }]);
      }
      setIsOpen(false);
      resetForm();
    } catch (error) {
      console.error("Failed to save role", error);
      setFormError(t('save_role_error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl md:rounded border border-slate-200 shadow-sm p-4 md:p-6 space-y-6">
      <SettingsPageHeader
        as="h2"
        title={t('roles_management')}
        description={t('roles_management_desc')}
        actions={
          <Button size="sm" className={cn("bg-blue-600 hover:bg-blue-700 text-white gap-2", settingsActionButtonClass)} onClick={handleAdd}>
            <PlusCircle className="w-4 h-4" /> {t('add_role')}
          </Button>
        }
      />

      <Sheet open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) resetForm(); }}>
        <SheetContent className="overflow-y-auto sm:max-w-2xl p-4 sm:p-8">
          <SheetHeader>
            <SheetTitle>{editingRole ? t('edit_role') : t('add_role')}</SheetTitle>
          </SheetHeader>
          <form key={editingRole ? editingRole.id : 'new-role'} onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label>{t('role_name')}</Label>
              <Input name="name" defaultValue={editingRole?.name} required placeholder="Médecin, Infirmier, ..." />
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-blue-200">
              <input
                type="checkbox"
                checked={isAdminRole}
                onChange={(e) => setIsAdminRole(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <ShieldCheck className="h-4 w-4 text-blue-600" /> {t('is_system_admin_label')}
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">{t('is_system_admin_hint')}</span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-blue-200">
              <input
                type="checkbox"
                checked={isClinicalProviderRole}
                onChange={(e) => setIsClinicalProviderRole(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <Stethoscope className="h-4 w-4 text-blue-600" /> {t('is_clinical_provider_label')}
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">{t('is_clinical_provider_hint')}</span>
              </span>
            </label>

            <div className="pt-2 border-t border-slate-100">
              <ModulePermissionMatrix
                title={t('default_module_permissions')}
                description={t('default_module_permissions_desc')}
                value={selectedModules}
                onChange={setSelectedModules}
                isSystemAdmin={isAdminRole}
              />
            </div>

            {formError ? (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{formError}</p>
            ) : null}

            <SheetFooter className="border-t border-slate-100 pt-4">
              <div className="flex justify-end gap-3 w-full">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>{tc('cancel')}</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
                  {isSaving ? tc('saving') : editingRole ? tc('save_changes') : t('create_role')}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Cards while the content area is narrow, table once it fits (container query, no JS). */}
      <div className="@3xl:hidden">
        <SettingsList isLoading={isLoading} isEmpty={roles.length === 0} emptyLabel={tc('no_data')}>
          {roles.map((role) => (
            <SettingsListItem
              key={role.id}
              title={role.name}
              meta={
                <>
                  {role.isSystemAdmin ? (
                    <SettingsPill tone="blue"><ShieldCheck className="h-3 w-3" /> {t('full_system_access')}</SettingsPill>
                  ) : (
                    <SettingsPill>{role.defaultModules.length} modules</SettingsPill>
                  )}
                  {role.isClinicalProvider && (
                    <SettingsPill tone="emerald"><Stethoscope className="h-3 w-3" /> {t('is_clinical_provider_label')}</SettingsPill>
                  )}
                  <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {role.userCount}</span>
                </>
              }
              actions={[
                { label: tc('edit'), icon: Edit2, onClick: () => handleEdit(role) },
                { label: tc('delete'), icon: Trash2, tone: "danger", onClick: () => handleDelete(role) },
              ]}
            />
          ))}
        </SettingsList>
      </div>
      <div className="hidden @3xl:block">
        <div className="border border-slate-200 rounded-md overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>{t('role_name')}</TableHead>
                <TableHead>{tc('status')}</TableHead>
                <TableHead>{t('personnel')}</TableHead>
                <TableHead className="text-right">{tc('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500 text-sm">Loading...</TableCell>
                </TableRow>
              ) : roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500 text-sm">{tc('no_data')}</TableCell>
                </TableRow>
              ) : roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium text-slate-900">{role.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {role.isSystemAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                          <ShieldCheck className="h-3 w-3" /> {t('full_system_access')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800">
                          {role.defaultModules.length} modules
                        </span>
                      )}
                      {role.isClinicalProvider && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                          <Stethoscope className="h-3 w-3" /> {t('is_clinical_provider_label')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{role.userCount}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => handleEdit(role)} title={t('edit_role')}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(role)} title={t('delete_role')}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
