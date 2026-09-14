import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FirebaseError } from "firebase/app";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  signInWithPopup,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth, db, googleProvider } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { seed, demoUsers } from "../lib/seed";
import type { Entity, User } from "../types";

type WorkspaceData = Record<string, Entity[]>;

type Store = {
  user: User | null;
  data: WorkspaceData;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  demo: (id: string) => void;
  logout: () => Promise<void>;
  save: (table: string, row: Partial<Entity>) => Promise<void>;
  remove: (table: string, id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

type Snapshot = {
  user: User | null;
  data: WorkspaceData;
};

const Context = createContext<Store | undefined>(undefined);
const allowedTables = new Set(Object.keys(seed()));

function isAdmin(user: User): boolean {
  return ["director", "manager"].includes(user.role);
}

function storageKey(uid: string): string {
  return `ca-firebase-data:${uid}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(cause: unknown): string {
  if (cause instanceof FirebaseError) {
    const messages: Record<string, string> = {
      "permission-denied": "Firestore denied access to your workspace profile. Check the users document ID and Firestore rules.",
      "unavailable": "Cannot reach the workspace server. Check your connection and try again.",
      "failed-precondition": "Firestore is not ready for this project. Check that Cloud Firestore is enabled.",
      "auth/popup-closed-by-user": "Google sign-in was cancelled.",
      "auth/popup-blocked": "Allow popups in your browser and try again.",
      "auth/account-exists-with-different-credential": "Use the sign-in method already linked to this email.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/user-not-found": "Incorrect email or password.",
      "auth/wrong-password": "Incorrect email or password.",
      "auth/user-disabled": "This account has been disabled.",
      "auth/too-many-requests":
        "Too many attempts. Please try again later.",
      "auth/network-request-failed":
        "Check your internet connection and try again.",
      "auth/operation-not-allowed":
        "Enable Email/Password login in Firebase Authentication.",
      "auth/unauthorized-domain":
        "Add this domain to Firebase authorized domains.",
    };

    return messages[cause.code] ?? `Authentication failed (${cause.code}).`;
  }

  if (cause instanceof DOMException) {
    if (
      cause.name === "QuotaExceededError" ||
      cause.name === "NS_ERROR_DOM_QUOTA_REACHED"
    ) {
      return "Browser storage is full. Your changes were not saved.";
    }

    if (cause.name === "SecurityError") {
      return "Browser storage is unavailable. Check your browser settings.";
    }
  }

  if (cause instanceof SyntaxError) {
    return "Saved workspace data cannot be read. Existing storage was preserved.";
  }

  return cause instanceof Error
    ? cause.message
    : "Something went wrong. Please try again.";
}

function readData(uid: string): WorkspaceData {
  const saved = window.localStorage.getItem(storageKey(uid));

  if (saved === null) return seed();

  const parsed: unknown = JSON.parse(saved);

  if (!isObject(parsed)) {
    throw new Error("Saved workspace data is invalid.");
  }

  const result: WorkspaceData = {};

  for (const table of allowedTables) {
    const rows = parsed[table];

    if (rows === undefined) {
      result[table] = [];
      continue;
    }

    if (!Array.isArray(rows)) {
      throw new Error(`Saved "${table}" data is invalid.`);
    }

    const ids = new Set<string>();

    for (const row of rows) {
      if (
        !isObject(row) ||
        typeof row.id !== "string" ||
        !row.id.trim() ||
        ids.has(row.id)
      ) {
        throw new Error(`Saved "${table}" contains an invalid record.`);
      }

      ids.add(row.id);
    }

    result[table] = rows as Entity[];
  }

  return result;
}

// Use the same Firebase app as Authentication. No new Firebase config is needed.
// The Firestore document ID must be the Firebase Authentication UID.
function profileReadError(cause: unknown, uid: string): Error {
  if (cause instanceof FirebaseError) {
    if (cause.code === "permission-denied") {
      return new Error(
        `Firestore denied access to users/${uid}. In Firestore Rules, allow the signed-in user to read only this UID document.`,
      );
    }
    if (cause.code === "unavailable") {
      return new Error("Cannot reach Firestore. Check your internet connection and try again.");
    }
  }
  return new Error(getErrorMessage(cause));
}

async function createProfile(firebaseUser: FirebaseUser): Promise<User> {
  const uid = firebaseUser.uid.trim();
  if (!uid) throw new Error("Firebase returned an empty user ID. Please sign in again.");

  let profileDoc;
  try {
    profileDoc = await getDoc(doc(db, "users", uid));
  } catch (cause) {
    throw profileReadError(cause, uid);
  }

  if (!profileDoc.exists()) {
    throw new Error(
      `Workspace profile not found at users/${uid}. Create or rename the Firestore document to this exact Firebase Authentication UID.`,
    );
  }

  const profile = profileDoc.data();
  const role = typeof profile.role === "string"
    ? profile.role.trim().toLowerCase()
    : "";

  if (!["director", "manager", "team_lead", "employee"].includes(role)) {
    throw new Error(
      `The role in users/${uid} is missing or invalid. Use director, manager, team_lead, or employee.`,
    );
  }

  if (profile.active === false) {
    throw new Error(`The workspace account in users/${uid} is inactive.`);
  }

  return {
    ...profile,
    id: uid,
    name:
      typeof profile.name === "string" && profile.name.trim()
        ? profile.name.trim()
        : firebaseUser.displayName?.trim() ||
          firebaseUser.email?.split("@")[0] ||
          "Workspace User",
    email:
      firebaseUser.email ??
      (typeof profile.email === "string" ? profile.email : ""),
    role,
    active: true,
    team_id: typeof profile.team_id === "string" ? profile.team_id : null,
  } as User;
}

function validateTable(table: string): void {
  if (!allowedTables.has(table)) {
    throw new Error(`Unknown workspace table: ${table}`);
  }
}

function createActivity(
  user: User,
  action: string,
  table: string,
  details: unknown,
): Entity {
  return {
    id: crypto.randomUUID(),
    name: `${user.name} ${action} ${table}`,
    status: "Recorded",
    owner_id: user.id,
    created_at: new Date().toISOString(),
    description: JSON.stringify(details),
  } as Entity;
}

export function Provider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    user: null,
    data: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const snapshotRef = useRef(snapshot);
  const mountedRef = useRef(false);
  const authBusyRef = useRef(false);
  const operationVersionRef = useRef(0);
  const demoIdRef = useRef<string | null>(null);

  const publish = useCallback((next: Snapshot) => {
    if (!mountedRef.current) return;
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const reportError = useCallback((cause: unknown): Error => {
    const message = getErrorMessage(cause);
    if (mountedRef.current) setError(message);
    return new Error(message);
  }, []);

  const clearWorkspace = useCallback(() => {
    demoIdRef.current = null;
    publish({ user: null, data: {} });
  }, [publish]);

  const isCurrent = useCallback((version: number) =>
    mountedRef.current && operationVersionRef.current === version, []);

  const loadWorkspace = useCallback(async (firebaseUser: FirebaseUser, version: number) => {
    const profile = await createProfile(firebaseUser);
    if (!isCurrent(version) || auth.currentUser?.uid !== firebaseUser.uid) return;
    const records = readData(firebaseUser.uid);
    demoIdRef.current = null;
    publish({ user: profile, data: records });
    setError("");
  }, [isCurrent, publish]);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Login/logout methods await their own profile load; avoid a second race.
      if (!active || authBusyRef.current) return;
      const version = ++operationVersionRef.current;
      clearWorkspace();
      setError("");
      if (!firebaseUser) {
        setLoading(false);
        return;
      }
      setLoading(true);
      void loadWorkspace(firebaseUser, version).catch((cause) => {
        if (active && isCurrent(version)) {
          clearWorkspace();
          reportError(cause);
        }
      }).finally(() => {
        if (active && isCurrent(version)) setLoading(false);
      });
    }, (cause) => {
      if (!active) return;
      ++operationVersionRef.current;
      authBusyRef.current = false;
      clearWorkspace();
      reportError(cause);
      setLoading(false);
    });

    const handleStorage = (event: StorageEvent) => {
      const profile = snapshotRef.current.user;
      if (!active || authBusyRef.current || !profile ||
        event.storageArea !== window.localStorage ||
        (event.key !== null && event.key !== storageKey(profile.id))) return;
      try {
        publish({ user: profile, data: readData(profile.id) });
      } catch (cause) { reportError(cause); }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      mountedRef.current = false;
      ++operationVersionRef.current;
      authBusyRef.current = false;
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, [clearWorkspace, isCurrent, loadWorkspace, publish, reportError]);

  const authenticate = useCallback(async (method: () => Promise<{ user: FirebaseUser }>) => {
    if (authBusyRef.current) throw reportError(new Error("Another sign-in request is in progress."));
    authBusyRef.current = true;
    const version = ++operationVersionRef.current;
    clearWorkspace();
    setError("");
    setLoading(true);
    try {
      const credential = await method();
      if (isCurrent(version)) await loadWorkspace(credential.user, version);
    } catch (cause) {
      if (isCurrent(version)) {
        clearWorkspace();
        throw reportError(cause);
      }
      throw new Error(getErrorMessage(cause));
    } finally {
      if (isCurrent(version)) {
        authBusyRef.current = false;
        setLoading(false);
      }
    }
  }, [clearWorkspace, isCurrent, loadWorkspace, reportError]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw reportError(new Error("Please enter a valid email address."));
    }
    if (!password) throw reportError(new Error("Please enter your password."));
    await authenticate(() => signInWithEmailAndPassword(auth, cleanEmail, password));
  }, [authenticate, reportError]);

  const loginGoogle = useCallback(async (): Promise<void> => {
    await authenticate(() => signInWithPopup(auth, googleProvider));
  }, [authenticate]);

  const logout = useCallback(async (): Promise<void> => {
    if (authBusyRef.current) throw reportError(new Error("Wait for the current sign-in request to finish."));
    authBusyRef.current = true;
    const version = ++operationVersionRef.current;
    setLoading(true);
    setError("");
    try {
      await signOut(auth);
      if (isCurrent(version)) clearWorkspace();
    } catch (cause) {
      if (isCurrent(version)) throw reportError(cause);
      throw new Error(getErrorMessage(cause));
    } finally {
      if (isCurrent(version)) {
        authBusyRef.current = false;
        setLoading(false);
      }
    }
  }, [clearWorkspace, isCurrent, reportError]);

  const demo = useCallback((id: string): void => {
    // Demo profiles are explicit local previews, never a fallback for real accounts.
    if (authBusyRef.current || auth.currentUser) {
      reportError(new Error("Sign out before opening a preview account."));
      return;
    }
    try {
      const profile = demoUsers.find((candidate) => candidate.id === id);
      if (!profile) throw new Error("That preview account does not exist.");
      const records = readData(profile.id);
      ++operationVersionRef.current;
      demoIdRef.current = profile.id;
      publish({ user: profile, data: records });
      setError("");
      setLoading(false);
    } catch (cause) { reportError(cause); }
  }, [publish, reportError]);

  const refresh = useCallback(async (): Promise<void> => {
    if (authBusyRef.current) throw reportError(new Error("Wait for the current sign-in request to finish."));
    const version = ++operationVersionRef.current;
    setLoading(true);
    try {
      if (auth.currentUser) {
        await loadWorkspace(auth.currentUser, version);
      } else if (demoIdRef.current && snapshotRef.current.user) {
        publish({ user: snapshotRef.current.user, data: readData(demoIdRef.current) });
        setError("");
      } else {
        clearWorkspace();
        setError("");
      }
    } catch (cause) {
      if (isCurrent(version)) {
        clearWorkspace();
        throw reportError(cause);
      }
      throw new Error(getErrorMessage(cause));
    } finally {
      if (isCurrent(version)) setLoading(false);
    }
  }, [clearWorkspace, isCurrent, loadWorkspace, publish, reportError]);

  const requireUser = useCallback((): User => {
    const currentUser = snapshotRef.current.user;

    if (
      authBusyRef.current ||
      !currentUser ||
      (demoIdRef.current !== currentUser.id && auth.currentUser?.uid !== currentUser.id)
    ) {
      throw new Error("Please sign in before changing workspace data.");
    }

    return currentUser;
  }, []);

  const persist = useCallback(
    (next: WorkspaceData, currentUser: User): void => {
      if (demoIdRef.current !== currentUser.id && auth.currentUser?.uid !== currentUser.id) {
        throw new Error("Your session changed. Please sign in again.");
      }

      window.localStorage.setItem(
        storageKey(currentUser.id),
        JSON.stringify(next),
      );

      publish({ user: currentUser, data: next });

      if (mountedRef.current) setError("");
    },
    [publish],
  );

  const save = useCallback(
    async (table: string, row: Partial<Entity>): Promise<void> => {
      try {
        const currentUser = requireUser();
        validateTable(table);

        if (!isObject(row)) {
          throw new Error("The record must be an object.");
        }

        const id = row.id ?? crypto.randomUUID();

        if (typeof id !== "string" || !id.trim()) {
          throw new Error("The record ID is invalid.");
        }

        const currentData = readData(currentUser.id);
        const rows = currentData[table] ?? [];
        const existing = rows.find((item) => item.id === id);

        const updates = Object.fromEntries(
          Object.entries(row).filter(([, value]) => value !== undefined),
        );

        const fields: Record<string, unknown> = {
          team_id: currentUser.team_id,
          ...existing,
          ...updates,
          owner_id: existing?.owner_id || currentUser.id,
          created_at: existing?.created_at || new Date().toISOString(),
        };

        for (const field of ["assignee", "project_id", "client_id"]) {
          if (fields[field] === "") fields[field] = null;
        }

        const record = {
          ...fields,
          id,
        } as Entity;

        const next: WorkspaceData = {
          ...currentData,
          [table]: existing
            ? rows.map((item) => (item.id === id ? record : item))
            : [record, ...rows],
        };

        if (
          table !== "activity_logs" &&
          allowedTables.has("activity_logs")
        ) {
          next.activity_logs = [
            createActivity(
              currentUser,
              existing ? "updated" : "created",
              table,
              { before: existing, after: record },
            ),
            ...(next.activity_logs ?? []),
          ];
        }

        if (table === "tasks" && allowedTables.has("notifications")) {
          const notification = {
            id: crypto.randomUUID(),
            name: `${String(fields.name || "Task")} · ${String(
              fields.status || "Updated",
            )}`,
            status: "Unread",
            assignee: fields.assignee ?? null,
            owner_id: currentUser.id,
            created_at: new Date().toISOString(),
          } as Entity;

          next.notifications = [
            notification,
            ...(next.notifications ?? []),
          ];
        }

        persist(next, currentUser);
      } catch (cause) {
        throw reportError(cause);
      }
    },
    [persist, reportError, requireUser],
  );

  const remove = useCallback(
    async (table: string, id: string): Promise<void> => {
      try {
        const currentUser = requireUser();
        validateTable(table);

        if (typeof id !== "string" || !id.trim()) {
          throw new Error("The record ID is invalid.");
        }

        const currentData = readData(currentUser.id);
        const rows = currentData[table] ?? [];
        const existing = rows.find((item) => item.id === id);

        if (!existing) {
          if (mountedRef.current) setError("");
          return;
        }

        const next: WorkspaceData = {
          ...currentData,
          [table]: rows.filter((item) => item.id !== id),
        };

        if (
          table !== "activity_logs" &&
          allowedTables.has("activity_logs")
        ) {
          next.activity_logs = [
            createActivity(currentUser, "deleted", table, {
              before: existing,
            }),
            ...(next.activity_logs ?? []),
          ];
        }

        persist(next, currentUser);
      } catch (cause) {
        throw reportError(cause);
      }
    },
    [persist, reportError, requireUser],
  );

  const value = useMemo<Store>(
    () => ({
      user: snapshot.user,
      data: snapshot.data,
      loading,
      error,
      login,
      loginGoogle,
      demo,
      logout,
      save,
      remove,
      refresh,
    }),
    [
      snapshot,
      loading,
      error,
      login,
      loginGoogle,
      demo,
      logout,
      save,
      remove,
      refresh,
    ],
  );

  return (
    <Context.Provider value={value}>
      {children}
    </Context.Provider>
  );
}

export function useWorkspace(): Store {
  const context = useContext(Context);

  if (!context) {
    throw new Error("useWorkspace must be used inside Provider.");
  }

  return context;
}

export function scoped(rows: Entity[], user: User | null): Entity[] {
  if (!user) return [];
  if (isAdmin(user)) return rows;

  return rows.filter(
    (row) =>
      row.assignee === user.id ||
      row.owner_id === user.id ||
      (user.role === "team_lead" &&
        user.team_id != null &&
        row.team_id === user.team_id),
  );
}
