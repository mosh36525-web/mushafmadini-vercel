import { describe, expect, it } from "vitest";
import {
  GUEST_SNAPSHOT_KEY,
  captureVisibleOwnerSnapshot,
  readLocalData,
  readSnapshot,
  readVisibleOwner,
  transitionVisibleOwner,
  userSnapshotKey,
  writeLocalData,
  writeVisibleOwner,
  type StorageLike,
} from "./accountStorage";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function snapshotData(
  storage: StorageLike,
  key: string
): Record<string, string> | null {
  return readSnapshot(storage, key)?.data ?? null;
}

describe("visible-owner account isolation", () => {
  it("keeps guest → A → logout → B isolated and never offers A as B's guest import", () => {
    const storage = new MemoryStorage();
    writeLocalData(storage, { "madini-dark": "guest-dark" });
    writeVisibleOwner(storage, "guest");

    // Guest signs in as A. Only the marker-confirmed guest screen becomes the guest snapshot.
    transitionVisibleOwner(storage, 101, { "madini-position": "account-a" });
    expect(snapshotData(storage, GUEST_SNAPSHOT_KEY)).toEqual({
      "madini-dark": "guest-dark",
    });
    expect(readVisibleOwner(storage)).toBe(101);

    // Logout restores the original guest snapshot and snapshots A under A, never under guest.
    transitionVisibleOwner(
      storage,
      "guest",
      snapshotData(storage, GUEST_SNAPSHOT_KEY) ?? {}
    );
    expect(readLocalData(storage)).toEqual({ "madini-dark": "guest-dark" });
    expect(snapshotData(storage, userSnapshotKey(101))).toEqual({
      "madini-position": "account-a",
    });
    expect(snapshotData(storage, GUEST_SNAPSHOT_KEY)).toEqual({
      "madini-dark": "guest-dark",
    });

    // B gets B's empty state. Capturing the outgoing guest still cannot replace it with A.
    transitionVisibleOwner(storage, 202, {});
    expect(readVisibleOwner(storage)).toBe(202);
    expect(readLocalData(storage)).toEqual({});
    expect(snapshotData(storage, userSnapshotKey(202))).toBeNull();
    expect(snapshotData(storage, GUEST_SNAPSHOT_KEY)).toEqual({
      "madini-dark": "guest-dark",
    });
    expect(snapshotData(storage, GUEST_SNAPSHOT_KEY)).not.toEqual({
      "madini-position": "account-a",
    });
  });

  it("switches directly A → B by snapshotting A and restoring only B's state", () => {
    const storage = new MemoryStorage();
    writeLocalData(storage, { "madini-reciter": "a-reciter" });
    writeVisibleOwner(storage, 11);

    transitionVisibleOwner(
      storage,
      22,
      { "madini-font-size": "b-font" },
      "2026-01-01T00:00:00.000Z"
    );

    expect(snapshotData(storage, userSnapshotKey(11))).toEqual({
      "madini-reciter": "a-reciter",
    });
    expect(readLocalData(storage)).toEqual({ "madini-font-size": "b-font" });
    expect(readVisibleOwner(storage)).toBe(22);
    expect(snapshotData(storage, GUEST_SNAPSHOT_KEY)).toBeNull();
  });

  it("does not turn a reload while logged in as A into a guest capture", () => {
    const storage = new MemoryStorage();
    writeLocalData(storage, { "madini-position": "a-before-reload" });
    writeVisibleOwner(storage, 77);

    // Hydration for the same marked owner writes A's remote state without capturing a guest.
    transitionVisibleOwner(storage, 77, {
      "madini-position": "a-from-account",
    });

    expect(readVisibleOwner(storage)).toBe(77);
    expect(readLocalData(storage)).toEqual({
      "madini-position": "a-from-account",
    });
    expect(snapshotData(storage, GUEST_SNAPSHOT_KEY)).toBeNull();
  });

  it("captures only a matching owner and keeps marker/internal keys outside visible data", () => {
    const storage = new MemoryStorage();
    writeLocalData(storage, {
      "madini-dark": "true",
      "not-allowed": "ignored",
    });
    writeVisibleOwner(storage, 9);

    expect(captureVisibleOwnerSnapshot(storage, "guest", null)).toBe(false);
    expect(snapshotData(storage, GUEST_SNAPSHOT_KEY)).toBeNull();
    expect(captureVisibleOwnerSnapshot(storage, 9, null)).toBe(true);
    expect(snapshotData(storage, userSnapshotKey(9))).toEqual({
      "madini-dark": "true",
    });
    expect(readLocalData(storage)).toEqual({ "madini-dark": "true" });
  });
});
