import { Building2, Mail, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Maps TenantUserRole enum values to the shared `roles` translation namespace keys,
// mirroring the pairing already used by SYSTEM_ROLES in components/settings/users-management.tsx.
const ROLE_LABEL_KEY: Record<string, string> = {
  tenant_admin: "admin",
  doctor: "physician",
  nurse: "nurse",
  pharmacist: "pharmacist",
  lab_tech: "lab",
  radiologist: "radiologist",
  billing: "billing",
  hr: "hr",
  viewer: "viewer",
};

export interface ActivityUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  modules?: { moduleId: string }[];
  status: "active" | "inactive";
}

interface UserIdentityCardProps {
  user: ActivityUser;
  t: (key: string) => string;
  tc: (key: string) => string;
  tr: (key: string) => string;
}

export function UserIdentityCard({ user, t, tc, tr }: UserIdentityCardProps) {
  const roleKey = ROLE_LABEL_KEY[user.role];
  const roleLabel = roleKey ? tr(roleKey) : user.role;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 md:items-center items-start">
      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-bold shrink-0">
        {user.fullName.charAt(0)}
      </div>
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-slate-900">{user.fullName}</h1>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-sm text-slate-500">
          <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-slate-400" /> {roleLabel}</span>
          <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-slate-400" /> {user.email}</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-slate-400" /> {user.modules?.length || 0} {t('authorized')}</span>
        </div>
      </div>
      <div className="shrink-0 right-0 top-0 mt-4 md:mt-0 text-right">
        <span className={cn(
          "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest",
          user.status === 'active' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
        )}>
          {tc(user.status)}
        </span>
        <p className="text-xs text-slate-400 mt-2">
          ID: <span className="font-mono">{user.id}</span>
        </p>
      </div>
    </div>
  );
}
