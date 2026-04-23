import { create } from 'zustand';

interface AppState {
  currentTenantId: string | null;
  currentUser: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  activeModules: string[];
  setTenantId: (id: string) => void;
  setUser: (user: any) => void;
  setActiveModules: (modules: string[]) => void;
  hasModule: (moduleCode: string) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentTenantId: 'mock-tenant-1',
  currentUser: null,
  activeModules: [],
  setTenantId: (id) => set({ currentTenantId: id }),
  setUser: (user) => set({ currentUser: user }),
  setActiveModules: (modules) => set({ activeModules: modules }),
  hasModule: (moduleCode) => get().activeModules.includes(moduleCode),
}));
