import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { ModulePermission } from "./store/useAppStore";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            id: "credentials",
            name: "Tenant Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Missing credentials");
                }

                const user = await prisma.tenantUser.findUnique({
                    where: { email: credentials.email },
                });

                if (!user || !user.isActive) {
                    throw new Error("User not found or inactive");
                }

                const isValidPassword = await bcrypt.compare(
                    credentials.password,
                    user.passwordHash
                );

                if (!isValidPassword) {
                    throw new Error("Invalid password");
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.fullName,
                    role: user.role as string,
                    tenantId: (user as any).tenantId,
                    modules: ((user as any).modules ?? []) as unknown as ModulePermission[],
                };
            },
        }),
        CredentialsProvider({
            id: "admin-credentials",
            name: "Admin Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Missing credentials");
                }

                const adminUser = await prisma.adminUser.findUnique({
                    where: { email: credentials.email },
                });

                if (!adminUser || !adminUser.isActive) {
                    throw new Error("Admin user not found or inactive");
                }

                const isValidPassword = await bcrypt.compare(
                    credentials.password,
                    adminUser.passwordHash
                );

                if (!isValidPassword) {
                    throw new Error("Invalid password");
                }

                return {
                    id: adminUser.id,
                    email: adminUser.email,
                    name: adminUser.fullName,
                    role: "admin",
                    adminRole: adminUser.role as string,
                    tenantId: null,
                    modules: [],
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.tenantId = (user as any).tenantId;
                token.modules = user.modules;
                token.adminRole = (user as any).adminRole;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.tenantId = token.tenantId as string;
                session.user.modules = token.modules as any;
                session.user.adminRole = token.adminRole as string;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET || "super-secret-key-for-development",
};