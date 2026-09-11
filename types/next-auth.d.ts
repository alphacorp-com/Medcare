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
      roleId: string;
      // Grants full, unconditional access — see Role.isSystemAdmin and
      // isAdminOrTenantAdmin in lib/permissions.ts. The sole source of
      // "is this an administrator" now that roles are admin-defined names,
      // not a fixed enum with a magic "tenant_admin" value.
      isSystemAdmin: boolean;
      tenantId: string | null;
      modules: ModulePermission[];
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    roleId: string;
    isSystemAdmin: boolean;
    tenantId: string | null;
    modules: ModulePermission[];
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    roleId: string;
    isSystemAdmin: boolean;
    tenantId: string | null;
    modules: ModulePermission[];
    // Snapshot of the account's sessionVersion at sign-in time — compared against the
    // live DB value on every subsequent request (see callbacks.jwt in lib/auth.ts) to
    // detect a session that should no longer be trusted (password changed elsewhere,
    // account deactivated) without waiting for the token to naturally expire.
    sessionVersion: number;
  }
}
