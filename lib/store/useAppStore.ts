import { create } from 'zustand';

export type ModuleAction = "create" | "read" | "update" | "delete";

export interface ModulePermission {
  moduleId: string;
  actions: ModuleAction[];
}

export type CurrentUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
} | null;

interface AppState {
  currentTenantId: string | null;
  tenantIsActive: boolean;
  tenantAccessReason: string | null;
  currentUser: CurrentUser;
  activeModules: ModulePermission[];
  setTenantId: (id: string) => void;
  setTenantAccess: (isActive: boolean, reason?: string | null) => void;
  setUser: (user: CurrentUser) => void;
  setActiveModules: (modules: ModulePermission[]) => void;
  hasModule: (moduleCode: string) => boolean;
  hasPermission: (moduleCode: string, action: ModuleAction) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentTenantId: 'mock-tenant-1',
  tenantIsActive: true,
  tenantAccessReason: null,
  currentUser: null,
  activeModules: [],
  setTenantId: (id) => set({ currentTenantId: id }),
  setTenantAccess: (isActive, reason = null) => set({ tenantIsActive: isActive, tenantAccessReason: reason }),
  setUser: (user) => set({ currentUser: user }),
  setActiveModules: (modules) => set({ activeModules: modules }),
  hasModule: (moduleCode) => {
    const state = get();
    if (!state.tenantIsActive) return false;
    return state.activeModules.some(m => m.moduleId === moduleCode && m.actions.includes("read"));
  },
  hasPermission: (moduleCode, action) => {
    const state = get();
    if (!state.tenantIsActive) return false;
    return state.activeModules.some(m => m.moduleId === moduleCode && m.actions.includes(action));
  },
}));
