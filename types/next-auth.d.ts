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
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    tenantId: string | null;
    modules: ModulePermission[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    tenantId: string | null;
    modules: ModulePermission[];
  }
}
