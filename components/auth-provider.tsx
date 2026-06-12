"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { bootstrapCompanyForUser } from "@/lib/firestore/bootstrap";
import type { UserRole } from "@/lib/types";

type AppUser = {
  uid: string;
  email: string | null;
  companyId: string;
  role: UserRole;
};

type AuthContextValue = {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    businessName: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const registeringRef = useRef(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      setLoading(false);
      return;
    }

    const firebaseAuth = auth;
    const firestore = db;

    return onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setAppUser(null);
        setLoading(false);
        return;
      }

      if (registeringRef.current) {
        setLoading(false);
        return;
      }

      const userSnapshot = await getDoc(doc(firestore, "users", user.uid));
      if (userSnapshot.exists()) {
        const data = userSnapshot.data();
        const companyId = String(data.companyId);
        const profileSnapshot = await getDoc(
          doc(firestore, "business_profiles", companyId),
        );

        if (!profileSnapshot.exists()) {
          const result = await bootstrapCompanyForUser({
            uid: user.uid,
            email: user.email,
            businessName: user.email?.split("@")[0] ?? "Bisnis Baru",
          });
          setAppUser({
            uid: user.uid,
            email: user.email,
            companyId: result.companyId,
            role: result.role,
          });
        } else {
          setAppUser({
            uid: user.uid,
            email: user.email,
            companyId,
            role: (data.role ?? "owner") as UserRole,
          });
        }
      } else {
        const result = await bootstrapCompanyForUser({
          uid: user.uid,
          email: user.email,
          businessName: user.email?.split("@")[0] ?? "Bisnis Baru",
        });
        setAppUser({
          uid: user.uid,
          email: user.email,
          companyId: result.companyId,
          role: result.role,
        });
      }

      setLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase belum dikonfigurasi.");
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (
    email: string,
    password: string,
    businessName: string,
  ) => {
    if (!auth) throw new Error("Firebase belum dikonfigurasi.");
    registeringRef.current = true;
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const result = await bootstrapCompanyForUser({
        uid: credential.user.uid,
        email,
        businessName,
      });
      setFirebaseUser(credential.user);
      setAppUser({
        uid: credential.user.uid,
        email,
        companyId: result.companyId,
        role: result.role,
      });
    } finally {
      registeringRef.current = false;
    }
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  const value = useMemo(
    () => ({ firebaseUser, appUser, loading, login, register, logout }),
    [firebaseUser, appUser, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
