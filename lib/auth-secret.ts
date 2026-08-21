// Edge-safe (no node-only imports) so both lib/auth.ts (Node runtime) and
// middleware.ts (Edge runtime) can share the same guard against an unset secret.
export function getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXTAUTH_SECRET must be set in production. Refusing to start with an insecure fallback secret."
    );
  }

  return "super-secret-key-for-development";
}
