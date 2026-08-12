import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { ModulePermission } from "./store/useAppStore";
import { syncTenantStatus } from "./tenant-licensing";
import { recordAuditEvent, extractAuthRequestMeta, SYSTEM_ACTOR_ID } from "./audit";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            id: "credentials",
            name: "Tenant Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, req) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Missing credentials");
                }

                const { ipAddress, userAgent } = extractAuthRequestMeta(req?.headers);

                const user = await prisma.tenantUser.findUnique({
                    where: { email: credentials.email },
                });

                if (!user || !user.isActive) {
                    await recordAuditEvent({
                        actorId: SYSTEM_ACTOR_ID,
                        actorType: "system",
                        action: "user.login_failed",
                        payload: { email: credentials.email },
                        ipAddress,
                        userAgent,
                    });
                    throw new Error("User not found or inactive");
                }

                const isValidPassword = await bcrypt.compare(
                    credentials.password,
                    user.passwordHash
                );

                if (!isValidPassword) {
                    await recordAuditEvent({
                        tenantId: user.tenantId,
                        actorId: SYSTEM_ACTOR_ID,
                        actorType: "system",
                        action: "user.login_failed",
                        payload: { email: credentials.email },
                        ipAddress,
                        userAgent,
                    });
                    throw new Error("Invalid password");
                }

                if (user.tenantId) {
                    await syncTenantStatus(user.tenantId);
                }

                try {
                    await prisma.tenantUser.update({
                        where: { id: user.id },
                        data: { lastLoginAt: new Date() },
                    });
                } catch (error) {
                    console.error("[auth] failed to update lastLoginAt", error);
                }

                await recordAuditEvent({
                    tenantId: user.tenantId,
                    actorId: user.id,
                    actorType: "tenant_user",
                    action: "user.login",
                    resourceType: "tenant_user",
                    resourceId: user.id,
                    ipAddress,
                    userAgent,
                });

                return {
                    id: user.id,
                    email: user.email,
                    name: user.fullName,
                    role: user.role as string,
                    tenantId: user.tenantId,
                    modules: (user.modules ?? []) as unknown as ModulePermission[],
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
            async authorize(credentials, req) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Missing credentials");
                }

                const { ipAddress, userAgent } = extractAuthRequestMeta(req?.headers);

                const adminUser = await prisma.adminUser.findUnique({
                    where: { email: credentials.email },
                });

                if (!adminUser || !adminUser.isActive) {
                    await recordAuditEvent({
                        actorId: SYSTEM_ACTOR_ID,
                        actorType: "system",
                        action: "admin.login_failed",
                        payload: { email: credentials.email },
                        ipAddress,
                        userAgent,
                    });
                    throw new Error("Admin user not found or inactive");
                }

                const isValidPassword = await bcrypt.compare(
                    credentials.password,
                    adminUser.passwordHash
                );

                if (!isValidPassword) {
                    await recordAuditEvent({
                        actorId: SYSTEM_ACTOR_ID,
                        actorType: "system",
                        action: "admin.login_failed",
                        payload: { email: credentials.email },
                        ipAddress,
                        userAgent,
                    });
                    throw new Error("Invalid password");
                }

                try {
                    await prisma.adminUser.update({
                        where: { id: adminUser.id },
                        data: { lastLoginAt: new Date() },
                    });
                } catch (error) {
                    console.error("[auth] failed to update admin lastLoginAt", error);
                }

                await recordAuditEvent({
                    actorId: adminUser.id,
                    actorType: "admin",
                    action: "admin.login",
                    resourceType: "admin_user",
                    resourceId: adminUser.id,
                    ipAddress,
                    userAgent,
                });

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
                token.tenantId = user.tenantId;
                token.modules = user.modules;
                token.adminRole = user.adminRole;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id;
                session.user.role = token.role;
                session.user.tenantId = token.tenantId;
                session.user.modules = token.modules;
                session.user.adminRole = token.adminRole;
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