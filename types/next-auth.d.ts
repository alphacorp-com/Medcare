import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

export type ModuleAction = "create" | "read" | "update" | "delete";

export interface ModulePermission {
  moduleId: string;
  actions: ModuleAction[];
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      tenantId: string | null;
      modules: ModulePermission[];
      adminRole?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    tenantId: string | null;
    modules: ModulePermission[];
    adminRole?: string;
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    tenantId: string | null;
    modules: ModulePermission[];
    adminRole?: string;
    // Snapshot of the account's sessionVersion at sign-in time — compared against the
    // live DB value on every subsequent request (see callbacks.jwt in lib/auth.ts) to
    // detect a session that should no longer be trusted (password changed elsewhere,
    // account deactivated) without waiting for the token to naturally expire.
    sessionVersion: number;
  }
}
