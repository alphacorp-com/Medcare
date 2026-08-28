import { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { ModulePermission } from "./store/useAppStore";
import { syncTenantStatus } from "./tenant-licensing";
import { recordAuditEvent, extractAuthRequestMeta, SYSTEM_ACTOR_ID } from "./audit";
import { getNextAuthSecret } from "./auth-secret";
import { checkRateLimit } from "./rate-limit";

// Login is the system's main attack surface, so it's throttled on two axes: per email
// (stops guessing many passwords against one victim account) and per IP (stops a
// single script rotating through many target emails). Limits are generous enough that
// normal use — the occasional mistyped password — never trips them; a scripted
// brute-force attempt hits the wall almost immediately. Reuses the same in-memory
// limiter already protecting license activation (lib/rate-limit.ts).
const LOGIN_MAX_ATTEMPTS_PER_EMAIL = 10;
const LOGIN_MAX_ATTEMPTS_PER_IP = 30;
const LOGIN_WINDOW_MS = 15 * 60_000;

interface LoginRateLimitOptions {
    provider: "tenant" | "admin";
    email: string;
    ipAddress: string | null;
}

// Returns null when the attempt is allowed, or the message to throw when it isn't.
function checkLoginRateLimit({ provider, email, ipAddress }: LoginRateLimitOptions): string | null {
    const normalizedEmail = email.trim().toLowerCase();
    const emailLimit = checkRateLimit(
        `login:${provider}:email:${normalizedEmail}`,
        LOGIN_MAX_ATTEMPTS_PER_EMAIL,
        LOGIN_WINDOW_MS
    );
    const ipLimit = ipAddress
        ? checkRateLimit(`login:${provider}:ip:${ipAddress}`, LOGIN_MAX_ATTEMPTS_PER_IP, LOGIN_WINDOW_MS)
        : { allowed: true, remaining: 0, resetAt: 0 };

    if (!emailLimit.allowed || !ipLimit.allowed) {
        return "Too many login attempts. Please try again in a few minutes.";
    }
    return null;
}

// Neutralizes a token whose account was deactivated or whose sessionVersion no longer
// matches the DB (password changed, forced logout elsewhere) — every authorization
// check in the app (role, tenantId, modules, or self-id comparisons) fails against
// these sentinel values, without needing to touch every route individually. Using
// SYSTEM_ACTOR_ID (rather than leaving the real id) also closes the one path that
// doesn't check role/tenantId: requireSelfOrAdmin's self-id match.
function revokeToken(token: JWT): JWT {
    return {
        ...token,
        id: SYSTEM_ACTOR_ID,
        role: "revoked",
        tenantId: null,
        modules: [],
        adminRole: undefined,
    };
}

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

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

                const rateLimitError = checkLoginRateLimit({
                    provider: "tenant",
                    email: credentials.email,
                    ipAddress,
                });
                if (rateLimitError) {
                    await recordAuditEvent({
                        actorId: SYSTEM_ACTOR_ID,
                        actorType: "system",
                        action: "user.login_rate_limited",
                        payload: { email: credentials.email },
                        ipAddress,
                        userAgent,
                    });
                    throw new Error(rateLimitError);
                }

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
                    throw new Error(INVALID_CREDENTIALS_MESSAGE);
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
                    throw new Error(INVALID_CREDENTIALS_MESSAGE);
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
                    sessionVersion: user.sessionVersion,
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

                const rateLimitError = checkLoginRateLimit({
                    provider: "admin",
                    email: credentials.email,
                    ipAddress,
                });
                if (rateLimitError) {
                    await recordAuditEvent({
                        actorId: SYSTEM_ACTOR_ID,
                        actorType: "system",
                        action: "admin.login_rate_limited",
                        payload: { email: credentials.email },
                        ipAddress,
                        userAgent,
                    });
                    throw new Error(rateLimitError);
                }

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
                    throw new Error(INVALID_CREDENTIALS_MESSAGE);
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
                    throw new Error(INVALID_CREDENTIALS_MESSAGE);
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
                    sessionVersion: adminUser.sessionVersion,
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
                token.sessionVersion = user.sessionVersion;
                return token;
            }

            // Subsequent request (no `user`) — getServerSession/getToken re-run this
            // callback on every call for the jwt strategy, so this check happens on
            // every authenticated request. Confirms the account is still active and
            // that no password change/forced logout has invalidated this token since
            // it was issued, without waiting up to `maxAge` for it to naturally expire.
            if (token.role === "admin") {
                const admin = await prisma.adminUser.findUnique({
                    where: { id: token.id },
                    select: { isActive: true, sessionVersion: true },
                });
                if (!admin || !admin.isActive || admin.sessionVersion !== token.sessionVersion) {
                    return revokeToken(token);
                }
            } else if (token.role !== "revoked") {
                const tenantUser = await prisma.tenantUser.findUnique({
                    where: { id: token.id },
                    select: { isActive: true, sessionVersion: true },
                });
                if (!tenantUser || !tenantUser.isActive || tenantUser.sessionVersion !== token.sessionVersion) {
                    return revokeToken(token);
                }
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
        // A session now hard-expires after 12h instead of NextAuth's 30-day default —
        // covers a full shift without reauthenticating while sharply reducing how long
        // a stolen token stays usable. Re-issued (sliding) after each hour of activity,
        // so an actively-used session doesn't interrupt a shift; an idle/stolen token
        // left unused simply expires.
        maxAge: 12 * 60 * 60,
        updateAge: 60 * 60,
    },
    secret: getNextAuthSecret(),
};