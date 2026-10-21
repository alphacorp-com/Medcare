import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_STATE_TTL_MS,
  clearSessionStateCache,
  getAccountSessionState,
  invalidateSessionState,
  type AccountSessionState,
} from "@/lib/session-state-cache";

function counter(state: AccountSessionState | null) {
  let calls = 0;
  return {
    load: async () => {
      calls++;
      return state;
    },
    get calls() {
      return calls;
    },
  };
}

describe("session state cache", () => {
  beforeEach(() => clearSessionStateCache());

  it("hits the database once per TTL window", async () => {
    const db = counter({ isActive: true, sessionVersion: 1 });
    await getAccountSessionState("u1", db.load, 0);
    await getAccountSessionState("u1", db.load, SESSION_STATE_TTL_MS - 1);
    assert.equal(db.calls, 1);
    await getAccountSessionState("u1", db.load, SESSION_STATE_TTL_MS);
    assert.equal(db.calls, 2, "expired entry must be reloaded");
  });

  it("reloads immediately after an invalidation (password change, deactivation)", async () => {
    const before = counter({ isActive: true, sessionVersion: 1 });
    await getAccountSessionState("u1", before.load, 0);
    invalidateSessionState("u1");
    const after = counter({ isActive: false, sessionVersion: 2 });
    assert.deepEqual(await getAccountSessionState("u1", after.load, 1), { isActive: false, sessionVersion: 2 });
    assert.equal(after.calls, 1);
  });

  it("never caches a missing account", async () => {
    const db = counter(null);
    await getAccountSessionState("gone", db.load, 0);
    await getAccountSessionState("gone", db.load, 1);
    assert.equal(db.calls, 2);
  });

  it("keeps users separate", async () => {
    await getAccountSessionState("a", counter({ isActive: true, sessionVersion: 1 }).load, 0);
    const b = counter({ isActive: true, sessionVersion: 7 });
    assert.deepEqual(await getAccountSessionState("b", b.load, 0), { isActive: true, sessionVersion: 7 });
    assert.equal(b.calls, 1);
  });
});
