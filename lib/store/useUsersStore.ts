import { create } from 'zustand';

export type UserActivity = {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  details: string;
};

const INITIAL_ACTIVITIES: UserActivity[] = [
  { id: '1', userId: 'admin-1', action: 'Login', timestamp: new Date(Date.now() - 86400000).toISOString(), details: 'Logged in from 192.168.1.1' },
  { id: '2', userId: 'doctor-1', action: 'Discharged Patient', timestamp: new Date(Date.now() - 3600000).toISOString(), details: 'Discharged patient #10294' },
];

interface UsersState {
  activities: UserActivity[];
  logActivity: (userId: string, action: string, details: string) => void;
}

export const useUsersStore = create<UsersState>((set) => ({
  activities: INITIAL_ACTIVITIES,

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
