import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      modules: string[];
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    modules: any;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    modules: any;
  }
}
