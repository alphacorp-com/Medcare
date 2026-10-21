// Short-lived, per-process cache of the account facts every authenticated request checks
// (lib/auth.ts, callbacks.jwt): is the account still active, and does the token's
// sessionVersion still match. Without it, every API call paid one database round trip
// before doing any work.
//
// Security trade-off (accepted): another server process may honour a revoked session for
// up to TTL_MS. Within this process there is no delay: every write that revokes sessions
// (password change, deactivation, deletion) calls invalidateSessionState().

export const SESSION_STATE_TTL_MS = 30_000;
const MAX_ENTRIES = 10_000;

export interface AccountSessionState {
  isActive: boolean;
  sessionVersion: number;
}

interface Entry {
  state: AccountSessionState;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

export async function getAccountSessionState(
  userId: string,
  load: () => Promise<AccountSessionState | null>,
  now: number = Date.now()
): Promise<AccountSessionState | null> {
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > now) return hit.state;

  const state = await load();
  // A missing account is not cached: it is revoked on every request anyway.
  if (state) {
    if (cache.size >= MAX_ENTRIES) cache.clear(); // bounded memory; entries are cheap to rebuild
    cache.set(userId, { state, expiresAt: now + SESSION_STATE_TTL_MS });
  } else {
    cache.delete(userId);
  }
  return state;
}

export function invalidateSessionState(userId: string): void {
  cache.delete(userId);
}

// Tests only.
export function clearSessionStateCache(): void {
  cache.clear();
}
