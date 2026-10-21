import { useAuth, type EmailCredentials, type RegisterCredentials } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ACCOUNT_SYNC_STORAGE_KEYS,
  GUEST_SNAPSHOT_KEY,
  captureVisibleOwnerSnapshot,
  hasValues,
  readLocalData,
  readSnapshot,
  readVisibleOwner,
  sameData,
  sanitizeLocalData,
  transitionVisibleOwner,
  userSnapshotKey,
  writeSnapshot,
  writeVisibleOwner,
  type LocalData,
  type StorageLike,
  type VisibleOwner,
} from "@shared/accountStorage";
import type { UserDataMap } from "@shared/userData";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export { ACCOUNT_SYNC_STORAGE_KEYS } from "@shared/accountStorage";

export const MADINI_DATA_CHANGE_EVENT = "madini-data-change";
export const MADINI_DATA_RESTORED_EVENT = "madini-data-restored";

const SYNC_DELAY_MS = 700;

type SyncStatus =
  | "guest"
  | "hydrating"
  | "ready"
  | "saving"
  | "offline"
  | "conflict"
  | "error";
type DataChangeDetail = { keys?: string[] };
type AccountRemoteData = { data: UserDataMap; updatedAt: string | null };
type Identity = { active: boolean; userId: number | null; epoch: number };
type HydrationPayload = AccountRemoteData & { userId: number; epoch: number };

export type UseAccountSyncOptions = { active?: boolean };

function browserStorage(): StorageLike | null {
  if (
    typeof window === "undefined" ||
    typeof window.localStorage === "undefined"
  )
    return null;
  return window.localStorage;
}

function readBrowserData(): LocalData {
  const storage = browserStorage();
  return storage ? readLocalData(storage) : {};
}

function saveAccountSnapshot(
  userId: number,
  data: LocalData,
  updatedAt: string | null
): void {
  const storage = browserStorage();
  // A late operation must not be allowed to create or overwrite another owner's snapshot.
  if (!storage || readVisibleOwner(storage) !== userId) return;
  writeSnapshot(storage, userSnapshotKey(userId), data, updatedAt);
}

function asLocalData(data: UserDataMap): LocalData {
  return sanitizeLocalData(data);
}

function localDataVersion(data: LocalData): string {
  return JSON.stringify(
    Object.keys(data)
      .sort()
      .map(key => [key, data[key]])
  );
}

function dispatchRestored(source: "account" | "snapshot" | "empty"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(MADINI_DATA_RESTORED_EVENT, {
      detail: { source, keys: [...ACCOUNT_SYNC_STORAGE_KEYS] },
    })
  );
}

/** Call after an allowed local key has changed so the authenticated hook can queue a save. */
export function announceMadiniDataChange(keys?: readonly string[]): void {
  if (typeof window === "undefined") return;
  const safeKeys = keys?.filter(key =>
    ACCOUNT_SYNC_STORAGE_KEYS.includes(
      key as (typeof ACCOUNT_SYNC_STORAGE_KEYS)[number]
    )
  );
  window.dispatchEvent(
    new CustomEvent<DataChangeDetail>(MADINI_DATA_CHANGE_EVENT, {
      detail: safeKeys?.length ? { keys: safeKeys } : {},
    })
  );
}

/**
 * Synchronizes only whitelisted local product settings with the current email account.
 * The persistent visible-owner marker separates guest, account A, and account B data;
 * neither the marker nor any unapproved browser key is sent to the server.
 */
export function useAccountSync(options: UseAccountSyncOptions = {}) {
  const active = options.active ?? true;
  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const userQuery = trpc.userData.get.useQuery(undefined, {
    enabled: active && Boolean(userId),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const saveMutation = trpc.userData.save.useMutation();

  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("guest");
  const [syncMessage, setSyncMessage] = useState("");
  const [hydrationRevision, setHydrationRevision] = useState(0);

  const identityRef = useRef<Identity>({ active, userId, epoch: 0 });
  if (
    identityRef.current.active !== active ||
    identityRef.current.userId !== userId
  ) {
    identityRef.current = {
      active,
      userId,
      epoch: identityRef.current.epoch + 1,
    };
  }

  // Keep a stable mutation caller: the mutation result object is not a safe callback dependency.
  const mutateAsyncRef = useRef(saveMutation.mutateAsync);
  mutateAsyncRef.current = saveMutation.mutateAsync;
  const refetchUserDataRef = useRef(userQuery.refetch);
  refetchUserDataRef.current = userQuery.refetch;

  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const baselineRef = useRef<LocalData>({});
  const updatedAtRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const queueSaveRef = useRef<() => void>(() => undefined);
  const ownerRef = useRef<VisibleOwner | null>(null);
  const previousUserRef = useRef<number | null | undefined>(undefined);
  const resetIdentityEpochRef = useRef(-1);
  const outgoingUpdatedAtRef = useRef<string | null>(null);
  const requestedQueryEpochRef = useRef(-1);
  const hydrationGuardRef = useRef<string | null>(null);
  const hydrationPayloadRef = useRef<HydrationPayload | null>(null);

  const isIdentityCurrent = useCallback(
    (operationUserId: number, operationEpoch: number): boolean => {
      const current = identityRef.current;
      return (
        current.active &&
        current.userId === operationUserId &&
        current.epoch === operationEpoch
      );
    },
    []
  );

  const acceptHydrationPayload = useCallback(
    (
      operationUserId: number,
      operationEpoch: number,
      result: AccountRemoteData | undefined
    ) => {
      if (!isIdentityCurrent(operationUserId, operationEpoch)) return;
      if (!result) {
        setSyncStatus("error");
        setSyncMessage(
          "تعذر استعادة بيانات الحساب الآن. لن تُستبدل بيانات هذا الجهاز."
        );
        return;
      }
      hydrationPayloadRef.current = {
        ...result,
        userId: operationUserId,
        epoch: operationEpoch,
      };
      setHydrationRevision(revision => revision + 1);
    },
    [isIdentityCurrent]
  );

  const flush = useCallback(async () => {
    const operation = identityRef.current;
    const operationUserId = operation.userId;
    if (
      !operation.active ||
      operationUserId === null ||
      !hydratedRef.current ||
      savingRef.current ||
      ownerRef.current !== operationUserId
    )
      return;
    if (!dirtyRef.current) return;

    const isCurrentOperation = () =>
      isIdentityCurrent(operationUserId, operation.epoch) &&
      ownerRef.current === operationUserId &&
      hydratedRef.current;
    if (!isCurrentOperation()) return;

    savingRef.current = true;
    setSyncStatus("saving");
    const data = readBrowserData();
    const baseline = baselineRef.current;
    dirtyRef.current = false;

    try {
      const result = await mutateAsyncRef.current({
        data,
        expectedUpdatedAt: updatedAtRef.current,
      });
      // Do not let an A response update B/guest local data, snapshots, or UI.
      if (!isCurrentOperation()) return;

      if (result.status === "conflict") {
        const remote = asLocalData(result.data);
        const current = readBrowserData();
        const merged: LocalData = { ...remote };
        for (const key of ACCOUNT_SYNC_STORAGE_KEYS) {
          if (current[key] !== baseline[key]) {
            if (current[key] === undefined) delete merged[key];
            else merged[key] = current[key];
          }
        }
        const storage = browserStorage();
        if (storage) {
          transitionVisibleOwner(
            storage,
            operationUserId,
            merged,
            updatedAtRef.current
          );
        }
        baselineRef.current = remote;
        updatedAtRef.current = result.updatedAt;
        saveAccountSnapshot(operationUserId, merged, result.updatedAt);
        dirtyRef.current = true;
        setSyncStatus("conflict");
        setSyncMessage(
          "تم دمج تحديث أحدث من حسابك؛ سيُعاد حفظ تعديلاتك المحلية."
        );
        dispatchRestored("account");
      } else {
        const saved = asLocalData(result.data);
        baselineRef.current = saved;
        updatedAtRef.current = result.updatedAt;
        saveAccountSnapshot(operationUserId, saved, result.updatedAt);
        setSyncStatus("ready");
        setSyncMessage("تمت مزامنة بيانات الحساب.");
      }
    } catch {
      if (!isCurrentOperation()) return;
      dirtyRef.current = true;
      setSyncStatus("offline");
      setSyncMessage(
        "تعذر الوصول إلى المزامنة الآن؛ ستبقى النسخة المحلية محفوظة على هذا الجهاز."
      );
      saveAccountSnapshot(
        operationUserId,
        readBrowserData(),
        updatedAtRef.current
      );
    } finally {
      // The owner/epoch check also prevents an old A finally block from clearing B's saving state.
      if (!isCurrentOperation()) return;
      savingRef.current = false;
      if (dirtyRef.current) queueSaveRef.current();
    }
  }, [isIdentityCurrent]);

  const queueSave = useCallback(() => {
    const identity = identityRef.current;
    if (
      !identity.active ||
      identity.userId === null ||
      !hydratedRef.current ||
      ownerRef.current !== identity.userId
    )
      return;
    if (typeof window === "undefined") return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, SYNC_DELAY_MS);
  }, [flush]);
  queueSaveRef.current = queueSave;

  // Identity changes invalidate every prior operation before the next hydrate begins.
  useEffect(() => {
    const identity = identityRef.current;
    const identityChanged = resetIdentityEpochRef.current !== identity.epoch;
    const userChanged = previousUserRef.current !== userId;
    if (identityChanged || userChanged) {
      resetIdentityEpochRef.current = identity.epoch;
      previousUserRef.current = userId;
      if (timerRef.current !== null && typeof window !== "undefined")
        window.clearTimeout(timerRef.current);
      timerRef.current = null;
      outgoingUpdatedAtRef.current =
        typeof ownerRef.current === "number" ? updatedAtRef.current : null;
      hydratedRef.current = false;
      dirtyRef.current = false;
      savingRef.current = false;
      baselineRef.current = {};
      updatedAtRef.current = null;
      hydrationGuardRef.current = null;
      hydrationPayloadRef.current = null;
      setHydrated(false);
    }

    if (!active || auth.loading) return;

    const storage = browserStorage();
    const nextOwner: VisibleOwner = userId ?? "guest";
    if (!storage) {
      ownerRef.current = nextOwner;
      if (nextOwner === "guest") {
        setSyncStatus("guest");
        setSyncMessage(
          "بيانات الزائر تبقى على هذا الجهاز حتى تختار استيرادها."
        );
      } else {
        setSyncStatus("hydrating");
      }
      return;
    }

    const markedOwner = readVisibleOwner(storage);
    if (markedOwner === null && nextOwner === "guest") {
      // First guest visit: establish ownership but do not create a snapshot until a guest change.
      writeVisibleOwner(storage, "guest");
      ownerRef.current = "guest";
    } else if (markedOwner !== nextOwner) {
      // Capture only the marked former owner, then reveal this owner's own snapshot or an empty whitelist.
      const nextSnapshot =
        nextOwner === "guest"
          ? null
          : readSnapshot(storage, userSnapshotKey(nextOwner));
      const guestSnapshot =
        nextOwner === "guest"
          ? readSnapshot(storage, GUEST_SNAPSHOT_KEY)
          : null;
      const targetSnapshot =
        nextOwner === "guest" ? guestSnapshot : nextSnapshot;
      const targetData = targetSnapshot?.data ?? {};
      transitionVisibleOwner(
        storage,
        nextOwner,
        targetData,
        outgoingUpdatedAtRef.current
      );
      ownerRef.current = nextOwner;
      dispatchRestored(hasValues(targetData) ? "snapshot" : "empty");
    } else {
      ownerRef.current = nextOwner;
    }

    if (nextOwner === "guest") {
      setSyncStatus("guest");
      setSyncMessage("بيانات الزائر تبقى على هذا الجهاز حتى تختار استيرادها.");
    } else {
      setSyncStatus("hydrating");
      setSyncMessage("جارٍ استعادة بيانات حسابك قبل بدء المزامنة…");
    }
  }, [active, auth.loading, userId]);

  // Every authenticated identity gets an awaited, user-current response before hydration.
  useEffect(() => {
    if (!active || auth.loading || userId === null) return;
    const operation = identityRef.current;
    if (requestedQueryEpochRef.current === operation.epoch) return;
    requestedQueryEpochRef.current = operation.epoch;
    let cancelled = false;

    void refetchUserDataRef
      .current()
      .then(result => {
        if (!cancelled)
          acceptHydrationPayload(userId, operation.epoch, result.data);
      })
      .catch(() => {
        if (!cancelled && isIdentityCurrent(userId, operation.epoch)) {
          setSyncStatus("error");
          setSyncMessage(
            "تعذر استعادة بيانات الحساب الآن. لن تُستبدل بيانات هذا الجهاز."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [active, acceptHydrationPayload, auth.loading, isIdentityCurrent, userId]);

  // One guard per identity + data/version prevents unrelated renders from rehydrating over local changes.
  useEffect(() => {
    const payload = hydrationPayloadRef.current;
    if (
      !payload ||
      !active ||
      userId === null ||
      payload.userId !== userId ||
      !isIdentityCurrent(payload.userId, payload.epoch)
    )
      return;
    const remote = asLocalData(payload.data);
    const guard = `${payload.userId}:${payload.epoch}:${payload.updatedAt ?? "null"}:${localDataVersion(remote)}`;
    if (hydrationGuardRef.current === guard) return;
    hydrationGuardRef.current = guard;

    const storage = browserStorage();
    const accountSnapshot = storage
      ? readSnapshot(storage, userSnapshotKey(payload.userId))
      : null;
    let nextData = remote;
    let source: "account" | "snapshot" | "empty" = "account";
    let shouldSaveSnapshot = false;

    if (
      !hasValues(remote) &&
      accountSnapshot &&
      hasValues(accountSnapshot.data)
    ) {
      nextData = accountSnapshot.data;
      source = "snapshot";
      shouldSaveSnapshot = true;
    } else if (!hasValues(remote)) {
      source = "empty";
    }

    if (storage) {
      // No unconditional guest capture: transitionVisibleOwner captures only a matching marker.
      transitionVisibleOwner(
        storage,
        payload.userId,
        nextData,
        outgoingUpdatedAtRef.current
      );
    }
    if (!isIdentityCurrent(payload.userId, payload.epoch)) return;

    ownerRef.current = payload.userId;
    baselineRef.current = { ...nextData };
    updatedAtRef.current = payload.updatedAt;
    saveAccountSnapshot(payload.userId, nextData, payload.updatedAt);
    hydratedRef.current = true;
    setHydrated(true);
    setSyncStatus("ready");
    setSyncMessage(
      source === "account"
        ? "تمت استعادة بيانات حسابك."
        : source === "snapshot"
          ? "استُعيدت نسخة محلية سابقة لهذا الحساب."
          : "حسابك جاهز للمزامنة."
    );
    dispatchRestored(source);

    if (shouldSaveSnapshot) {
      dirtyRef.current = true;
      queueSave();
    }
  }, [active, hydrationRevision, isIdentityCurrent, queueSave, userId]);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const onDataChange = (event: Event) => {
      const detail = (event as CustomEvent<DataChangeDetail>).detail;
      if (
        detail?.keys?.some(
          key =>
            !ACCOUNT_SYNC_STORAGE_KEYS.includes(
              key as (typeof ACCOUNT_SYNC_STORAGE_KEYS)[number]
            )
        )
      )
        return;
      const storage = browserStorage();
      if (!storage) return;

      const identity = identityRef.current;
      if (identity.userId === null) {
        // Guest writes are valid only while the persistent owner also says guest.
        if (ownerRef.current === "guest")
          captureVisibleOwnerSnapshot(storage, "guest", null);
        return;
      }
      if (
        !hydratedRef.current ||
        ownerRef.current !== identity.userId ||
        readVisibleOwner(storage) !== identity.userId
      )
        return;

      const local = readLocalData(storage);
      if (sameData(local, baselineRef.current)) return;
      dirtyRef.current = true;
      saveAccountSnapshot(identity.userId, local, updatedAtRef.current);
      queueSave();
    };
    window.addEventListener(MADINI_DATA_CHANGE_EVENT, onDataChange);
    return () =>
      window.removeEventListener(MADINI_DATA_CHANGE_EVENT, onDataChange);
  }, [active, queueSave, userId]);

  useEffect(
    () => () => {
      if (timerRef.current !== null && typeof window !== "undefined")
        window.clearTimeout(timerRef.current);
    },
    []
  );

  const guestDataAvailable = useMemo(() => {
    const storage = browserStorage();
    const guest = storage ? readSnapshot(storage, GUEST_SNAPSHOT_KEY) : null;
    return Boolean(guest && hasValues(guest.data));
  }, [hydrated, syncStatus, userId]);

  const importGuestData = useCallback(() => {
    const identity = identityRef.current;
    if (
      !identity.active ||
      identity.userId === null ||
      !hydratedRef.current ||
      ownerRef.current !== identity.userId
    )
      return false;
    const storage = browserStorage();
    if (!storage || readVisibleOwner(storage) !== identity.userId) return false;
    const guest = readSnapshot(storage, GUEST_SNAPSHOT_KEY);
    if (!guest || !hasValues(guest.data)) return false;

    // This is an explicit user action; a stored guest value overrides only its matching account key.
    const merged = { ...readLocalData(storage), ...guest.data };
    transitionVisibleOwner(
      storage,
      identity.userId,
      merged,
      updatedAtRef.current
    );
    dirtyRef.current = true;
    saveAccountSnapshot(identity.userId, merged, updatedAtRef.current);
    setSyncMessage("تم استيراد بيانات الزائر إلى حسابك وسيتم حفظها.");
    dispatchRestored("snapshot");
    queueSave();
    return true;
  }, [queueSave]);

  const refresh = useCallback(async () => {
    const operation = identityRef.current;
    const result = await refetchUserDataRef.current();
    if (operation.userId !== null)
      acceptHydrationPayload(operation.userId, operation.epoch, result.data);
    return result;
  }, [acceptHydrationPayload]);

  const login = useCallback(async (credentials: EmailCredentials) => {
    const user = await auth.login(credentials);
    setSyncStatus("hydrating");
    return user;
  }, [auth.login]);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    const user = await auth.register(credentials);
    setSyncStatus("hydrating");
    return user;
  }, [auth.register]);

  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    authLoading: auth.loading,
    hydrated,
    syncStatus,
    syncMessage,
    guestDataAvailable,
    login,
    register,
    logout: auth.logout,
    importGuestData,
    refresh,
  };
}

/** Pass this optional value to AccountPage when useAccountSync is mounted at app level. */
export type AccountSyncState = ReturnType<typeof useAccountSync>;
