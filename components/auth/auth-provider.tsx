"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { syncProjects } from "@/lib/editor/cloud-sync";
import { refreshProjects } from "@/lib/editor/projects-store";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase/client";

export type CloudSyncStatus = "idle" | "syncing" | "synced" | "error";

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  configured: boolean;
  syncStatus: CloudSyncStatus;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(() => !configured);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const syncUser = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setSyncStatus("idle");
      return;
    }
    setSyncStatus("syncing");
    setError(null);
    try {
      await syncProjects(nextUser.uid);
      refreshProjects();
      setSyncStatus("synced");
    } catch {
      setError("Cloud sync could not finish. Your local copy is still safe.");
      setSyncStatus("error");
    }
  }, []);

  useEffect(() => {
    const services = getFirebaseServices();
    if (!services) return;

    return onAuthStateChanged(services.auth, (nextUser) => {
      setUser(nextUser);
      setReady(true);
      void syncUser(nextUser);
    });
  }, [syncUser]);

  useEffect(() => {
    if (!user) return;
    const retrySync = () => void syncUser(user);
    window.addEventListener("online", retrySync);
    return () => window.removeEventListener("online", retrySync);
  }, [syncUser, user]);

  const signIn = useCallback(async () => {
    const services = getFirebaseServices();
    if (!services) {
      setError("Firebase is not configured for this deployment.");
      return;
    }
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(services.auth, provider);
    } catch (cause) {
      const code =
        cause && typeof cause === "object" && "code" in cause
          ? String(cause.code)
          : "";
      if (code !== "auth/popup-closed-by-user") {
        setError("Sign-in could not be completed. Please try again.");
      }
    }
  }, []);

  const signOutCurrentUser = useCallback(async () => {
    const services = getFirebaseServices();
    if (services) await signOut(services.auth);
  }, []);

  const syncNow = useCallback(async () => {
    await syncUser(user);
  }, [syncUser, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      configured,
      syncStatus,
      error,
      signIn,
      signOut: signOutCurrentUser,
      syncNow,
    }),
    [
      user,
      ready,
      configured,
      syncStatus,
      error,
      signIn,
      signOutCurrentUser,
      syncNow,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
