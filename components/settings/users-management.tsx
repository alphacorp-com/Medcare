"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUsersStore, SystemUser } from "@/lib/store/useUsersStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Search, Edit2, Activity, Trash2, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const ALL_MODULES = [
  { id: "MODULE_CORE_PATIENT", name: "Patient Management" },
  { id: "MODULE_ADMISSION", name: "Admissions & Bed Flow" },
  { id: "MODULE_PHARMACY", name: "Pharmacy & Inventory" },
  { id: "MODULE_LAB", name: "Laboratory System" },
  { id: "MODULE_SURGERY", name: "Surgical Block" },
  { id: "MODULE_RADIOLOGY", name: "Radiology Unit" },
  { id: "MODULE_BILLING", name: "Financial & PMSI" },
  { id: "MODULE_PLANNING", name: "RH & Staff Planning" }
];

export const SYSTEM_ROLES = [
  "System Administrator",
  "Lead Physician",
  "Head Nurse",
  "Pharmacist",
  "Lab Technician",
  "Billing Manager",
  "HR Director"
];

export function UsersManagement() {
  const router = useRouter();
  const { users, addUser, updateUser, deleteUser } = useUsersStore();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (user: SystemUser) => {
    setEditingUser(user);
    setIsAddOpen(true);
  };

  const handleCreateOrUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as string;
    const status = formData.get("status") as 'active' | 'inactive';
    
    // Parse selected modules
    const selectedModules = ALL_MODULES
        .filter(m => formData.get(`module-${m.id}`) === "on")
        .map(m => m.id);

    // Force core patient module
    if (!selectedModules.includes("MODULE_CORE_PATIENT")) {
        selectedModules.push("MODULE_CORE_PATIENT");
    }

    if (editingUser) {
      updateUser(editingUser.id, { fullName, email, role, status, modules: selectedModules });
    } else {
      addUser({ fullName, email, role, status, modules: selectedModules });
    }
    
    setIsAddOpen(false);
    setEditingUser(null);
  };

  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Personnel & Roles</h2>
          <p className="text-xs text-slate-500">Manage hospital staff, their roles, and system access.</p>
        </div>
        
        <div>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={() => { setEditingUser(null); setIsAddOpen(true); }}>
            <PlusCircle className="w-4 h-4" /> Add Personnel
          </Button>

          <Sheet open={isAddOpen} onOpenChange={(v) => { setIsAddOpen(v); if(!v) setEditingUser(null); }}>
            <SheetContent className="overflow-y-auto sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>{editingUser ? "Edit User" : "Add New User"}</SheetTitle>
              </SheetHeader>
              {/* Force complete unmount and remount when user changes so defaultValue warnings in base-ui vanish */}
              <form key={editingUser ? editingUser.id : 'new-user'} onSubmit={handleCreateOrUpdate} className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input name="fullName" defaultValue={editingUser?.fullName} required placeholder="Dr. John Doe" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input name="email" type="email" defaultValue={editingUser?.email} required placeholder="john.doe@hospital.com" />
                </div>
                <div className="space-y-2">
                  <Label>System Role</Label>
                  <select name="role" defaultValue={editingUser?.role || SYSTEM_ROLES[0]} required className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500">
                    {SYSTEM_ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Account Status</Label>
                  <select name="status" defaultValue={editingUser?.status || 'active'} className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Label className="mb-3 block font-bold text-slate-700">Module Access Scopes</Label>
                <div className="grid grid-cols-2 gap-3">
                  {ALL_MODULES.map((mod) => (
                    <label key={mod.id} className="flex items-center gap-2 text-sm border p-3 rounded-md hover:bg-slate-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        name={`module-${mod.id}`}
                        defaultChecked={editingUser ? editingUser.modules.includes(mod.id) : mod.id === "MODULE_CORE_PATIENT"}
                        disabled={mod.id === "MODULE_CORE_PATIENT"}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={cn("text-slate-700", mod.id === "MODULE_CORE_PATIENT" && "text-slate-400")}>
                        {mod.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">{editingUser ? "Save Changes" : "Create User"}</Button>
              </div>
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
            placeholder="Search users..." 
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
              <TableHead>Personnel</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500 text-sm">No users found.</TableCell>
              </TableRow>
            ) : filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium text-slate-900">{user.fullName}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-slate-700">{user.role}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{user.modules.length} modules accessed</div>
                </TableCell>
                <TableCell>
                  {user.status === 'active' 
                    ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">Active</span>
                    : <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800">Inactive</span>
                  }
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {user.lastActive ? formatDistanceToNow(new Date(user.lastActive), { addSuffix: true }) : 'Never'}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => router.push(`/settings/users/${user.id}/activity`)} title="View Activity">
                    <Activity className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => handleEdit(user)} title="Edit User">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => {
                      if(window.confirm(`Are you sure you want to remove ${user.fullName}?`)) deleteUser(user.id);
                  }} title="Delete User">
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
