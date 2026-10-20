export const ACCOUNT_SYNC_STORAGE_KEYS = [
  "madini-position",
  "madini-bookmarked",
  "madini-bookmark-position",
  "madini-dark",
  "madini-font-size",
  "madini-reciter",
  "madini-review-completed",
  "madini-activity",
  "madini-history",
  "madini-reminders",
  "madini-prayer-location",
  "madini-prayer-method",
  "madini-prayer-school",
  "madini-dua-favorites",
  "madini-tasbih-data",
] as const;

export const GUEST_SNAPSHOT_KEY = "madini-sync:guest:v1";
export const USER_SNAPSHOT_PREFIX = "madini-sync:user:";
export const VISIBLE_OWNER_KEY = "madini-sync:visible-owner:v1";

const ACCOUNT_SYNC_KEY_SET = new Set<string>(ACCOUNT_SYNC_STORAGE_KEYS);

export type LocalData = Record<string, string>;
export type Snapshot = {
  version: 1;
  data: LocalData;
  updatedAt: string | null;
  savedAt: string;
};
export type VisibleOwner = "guest" | number;

/** Minimal browser-storage contract, deliberately usable with an in-memory Map in unit tests. */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function userSnapshotKey(userId: number): string {
  return `${USER_SNAPSHOT_PREFIX}${userId}:v1`;
}

export function snapshotKeyForOwner(owner: VisibleOwner): string {
  return owner === "guest" ? GUEST_SNAPSHOT_KEY : userSnapshotKey(owner);
}

export function isAccountSyncStorageKey(key: string): boolean {
  return ACCOUNT_SYNC_KEY_SET.has(key);
}

export function sanitizeLocalData(data: Record<string, unknown>): LocalData {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([key, value]) =>
        ACCOUNT_SYNC_KEY_SET.has(key) && typeof value === "string"
    )
  ) as LocalData;
}

export function readLocalData(storage: StorageLike): LocalData {
  const data: LocalData = {};
  for (const key of ACCOUNT_SYNC_STORAGE_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return data;
}

/** Replaces only the approved visible keys; marker and unrelated browser keys are never touched. */
export function writeLocalData(
  storage: StorageLike,
  data: Record<string, unknown>
): void {
  const safeData = sanitizeLocalData(data);
  for (const key of ACCOUNT_SYNC_STORAGE_KEYS) {
    const value = safeData[key];
    if (typeof value === "string") storage.setItem(key, value);
    else storage.removeItem(key);
  }
}

export function readSnapshot(
  storage: StorageLike,
  key: string
): Snapshot | null {
  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    if (parsed.version !== 1 || !parsed.data || typeof parsed.data !== "object")
      return null;
    return {
      version: 1,
      data: sanitizeLocalData(parsed.data),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      savedAt:
        typeof parsed.savedAt === "string"
          ? parsed.savedAt
          : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeSnapshot(
  storage: StorageLike,
  key: string,
  data: Record<string, unknown>,
  updatedAt: string | null
): void {
  const snapshot: Snapshot = {
    version: 1,
    data: sanitizeLocalData(data),
    updatedAt,
    savedAt: new Date().toISOString(),
  };
  storage.setItem(key, JSON.stringify(snapshot));
}

export function hasValues(data: Record<string, unknown>): boolean {
  return Object.keys(data).length > 0;
}

export function sameData(left: LocalData, right: LocalData): boolean {
  const leftKeys = Object.keys(left);
  return (
    leftKeys.length === Object.keys(right).length &&
    leftKeys.every(key => left[key] === right[key])
  );
}

/** `guest` or `user:<id>` is persisted locally only; it is never part of server-sync data. */
export function readVisibleOwner(storage: StorageLike): VisibleOwner | null {
  const value = storage.getItem(VISIBLE_OWNER_KEY);
  if (value === "guest") return "guest";
  const match = value?.match(/^user:(\d+)$/);
  if (!match) return null;
  const userId = Number(match[1]);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

export function writeVisibleOwner(
  storage: StorageLike,
  owner: VisibleOwner
): void {
  storage.setItem(
    VISIBLE_OWNER_KEY,
    owner === "guest" ? "guest" : `user:${owner}`
  );
}

/**
 * Persists the visible whitelist only when the persistent marker confirms that owner
 * owns it. This is the guard that prevents an account's screen from becoming a guest
 * candidate after logout or an account switch.
 */
export function captureVisibleOwnerSnapshot(
  storage: StorageLike,
  owner: VisibleOwner,
  updatedAt: string | null
): boolean {
  if (readVisibleOwner(storage) !== owner) return false;
  writeSnapshot(
    storage,
    snapshotKeyForOwner(owner),
    readLocalData(storage),
    owner === "guest" ? null : updatedAt
  );
  return true;
}

/**
 * Atomically (for synchronous Storage) captures the former marked owner, replaces the
 * visible whitelist with targetData, and marks the new owner. Callers choose targetData
 * from that owner's snapshot, remote account state, or an empty object.
 */
export function transitionVisibleOwner(
  storage: StorageLike,
  nextOwner: VisibleOwner,
  targetData: Record<string, unknown>,
  previousOwnerUpdatedAt: string | null = null
): VisibleOwner | null {
  const previousOwner = readVisibleOwner(storage);
  if (previousOwner !== null && previousOwner !== nextOwner) {
    captureVisibleOwnerSnapshot(storage, previousOwner, previousOwnerUpdatedAt);
  }
  writeLocalData(storage, targetData);
  writeVisibleOwner(storage, nextOwner);
  return previousOwner;
}
