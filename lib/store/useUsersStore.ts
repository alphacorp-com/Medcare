import { create } from 'zustand';

export type SystemUser = {
  id: string;
  role: string;
  email: string;
  fullName: string;
  modules: string[];
  lastActive?: string;
  status: 'active' | 'inactive';
};

export type UserActivity = {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  details: string;
};

// Initial Mock data
export const INITIAL_USERS: SystemUser[] = [
  {
    id: "admin-1",
    role: "System Administrator",
    email: "admin@hospital.com",
    fullName: "Jane Admin",
    status: "active",
    lastActive: new Date().toISOString(),
    modules: [
      "MODULE_CORE_PATIENT",
      "MODULE_ADMISSION",
      "MODULE_PHARMACY",
      "MODULE_LAB",
      "MODULE_SURGERY",
      "MODULE_RADIOLOGY",
      "MODULE_BILLING",
      "MODULE_PLANNING",
    ],
  },
  {
    id: "doctor-1",
    role: "Lead Physician",
    email: "doctor@hospital.com",
    fullName: "Dr. Gregory House",
    status: "active",
    lastActive: new Date(Date.now() - 3600000).toISOString(),
    modules: [
      "MODULE_CORE_PATIENT",
      "MODULE_ADMISSION",
      "MODULE_LAB",
      "MODULE_SURGERY",
      "MODULE_RADIOLOGY",
      "MODULE_PHARMACY",
    ],
  },
  {
    id: "nurse-1",
    role: "Head Nurse",
    email: "nurse@hospital.com",
    fullName: "Carla Espinosa",
    status: "active",
    modules: [
      "MODULE_CORE_PATIENT",
      "MODULE_ADMISSION",
      "MODULE_PHARMACY",
      "MODULE_LAB",
    ],
  },
  {
    id: "pharm-1",
    role: "Pharmacist",
    email: "pharmacy@hospital.com",
    fullName: "John Mortar",
    status: "active",
    modules: ["MODULE_CORE_PATIENT", "MODULE_PHARMACY"],
  },
  {
    id: "lab-1",
    role: "Lab Technician",
    email: "lab@hospital.com",
    fullName: "Sarah Microscope",
    status: "active",
    modules: ["MODULE_CORE_PATIENT", "MODULE_LAB"],
  },
  {
    id: "bill-1",
    role: "Billing Manager",
    email: "billing@hospital.com",
    fullName: "Amanda Ledger",
    status: "active",
    modules: ["MODULE_CORE_PATIENT", "MODULE_BILLING"],
  },
  {
    id: "hr-1",
    role: "HR Director",
    email: "hr@hospital.com",
    fullName: "David Resources",
    status: "active",
    modules: ["MODULE_PLANNING"],
  },
];

const INITIAL_ACTIVITIES: UserActivity[] = [
  { id: '1', userId: 'admin-1', action: 'Login', timestamp: new Date(Date.now() - 86400000).toISOString(), details: 'Logged in from 192.168.1.1' },
  { id: '2', userId: 'doctor-1', action: 'Discharged Patient', timestamp: new Date(Date.now() - 3600000).toISOString(), details: 'Discharged patient #10294' },
];

interface UsersState {
  users: SystemUser[];
  activities: UserActivity[];
  
  addUser: (user: Omit<SystemUser, 'id'>) => void;
  updateUser: (id: string, user: Partial<SystemUser>) => void;
  deleteUser: (id: string) => void;
  
  logActivity: (userId: string, action: string, details: string) => void;
}

export const useUsersStore = create<UsersState>((set) => ({
  users: INITIAL_USERS,
  activities: INITIAL_ACTIVITIES,

  addUser: (user) => set((state) => {
    const newUser = { ...user, id: `user-${Math.random().toString(36).substring(2, 9)}` };
    return { users: [...state.users, newUser] };
  }),

  updateUser: (id, updatedFields) => set((state) => ({
    users: state.users.map(u => u.id === id ? { ...u, ...updatedFields } : u)
  })),

  deleteUser: (id) => set((state) => ({
    users: state.users.filter(u => u.id !== id),
    // Also remove their activities to keep clean
    activities: state.activities.filter(a => a.userId !== id)
  })),

  logActivity: (userId, action, details) => set((state) => ({
    activities: [
      {
        id: `act-${Math.random().toString(36).substring(2, 9)}`,
        userId,
        action,
        timestamp: new Date().toISOString(),
        details
      },
      ...state.activities
    ]
  }))
}));
