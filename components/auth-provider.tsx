"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { bootstrapCompanyForUser } from "@/lib/supabase/bootstrap";
import type { UserRole } from "@/lib/types";

/** Supabase PostgrestError has non-enumerable properties — extract them for readable logging. */
function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const own = Object.getOwnPropertyNames(err).reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = (err as Record<string, unknown>)[k];
      return acc;
    }, {});
    return JSON.stringify(own);
  }
  return String(err);
}

type AppUser = {
  uid: string;
  email: string | null;
  companyId: string;
  role: UserRole;
};

type AuthContextValue = {
  supabaseUser: any | null;
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
  const [supabaseUser, setSupabaseUser] = useState<any | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        // Use getSession() instead of getUser() - much faster as it reads
        // from local storage first without blocking network call
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;

        setSupabaseUser(user);

        if (!user) {
          setAppUser(null);
          return;
        }

        // Fetch user profile and business profile in PARALLEL
        const [userResult, profileResult] = await Promise.all([
          supabase.from("users").select("*").eq("uid", user.id).maybeSingle(),
          // Try to find business profile via users table relationship
          supabase
            .from("users")
            .select("company_id, business_profiles(*)")
            .eq("uid", user.id)
            .maybeSingle(),
        ]);

        const userProfile = userResult.data;
        const userError = userResult.error;
        const joinedProfile = profileResult.data as any;

        if (userError && userError.code !== "PGRST116") {
          console.error("Error fetching user profile:", userError);
          setAppUser(null);
          return;
        }

        if (userProfile && joinedProfile?.business_profiles) {
          const profile = joinedProfile.business_profiles;
          setAppUser({
            uid: user.id,
            email: user.email ?? null,
            companyId: userProfile.company_id,
            role: (userProfile.role ?? "owner") as UserRole,
          });
        } else if (userProfile) {
          // Fallback: fetch business profile directly
          const { data: profile } = await supabase
            .from("business_profiles")
            .select("*")
            .eq("id", userProfile.company_id)
            .maybeSingle();

          if (profile) {
            setAppUser({
              uid: user.id,
              email: user.email ?? null,
              companyId: userProfile.company_id,
              role: (userProfile.role ?? "owner") as UserRole,
            });
          } else {
            // Bootstrap if profile missing
            try {
              const result = await bootstrapCompanyForUser({
                uid: user.id,
                email: user.email ?? null,
                businessName: user.email?.split("@")[0] ?? "Bisnis Baru",
              });
              setAppUser({
                uid: user.id,
                email: user.email ?? null,
                companyId: result.companyId,
                role: result.role,
              });
            } catch (bootstrapErr) {
              console.error("Bootstrap error:", formatError(bootstrapErr));
              setAppUser(null);
            }
          }
        } else {
          // No user profile, bootstrap
          try {
            const result = await bootstrapCompanyForUser({
              uid: user.id,
              email: user.email ?? null,
              businessName: user.email?.split("@")[0] ?? "Bisnis Baru",
            });
            setAppUser({
              uid: user.id,
              email: user.email ?? null,
              companyId: result.companyId,
              role: result.role,
            });
          } catch (bootstrapErr) {
            console.error("Bootstrap error:", formatError(bootstrapErr));
            setAppUser(null);
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        setAppUser(null);
        setSupabaseUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSupabaseUser(session?.user ?? null);

        if (!session?.user) {
          setAppUser(null);
          return;
        }

        // On sign in, load profile
        if (event === "SIGNED_IN") {
          try {
            const { data: userProfile, error } = await supabase
              .from("users")
              .select("*")
              .eq("uid", session.user.id)
              .maybeSingle();

            if (error) {
              console.error("Error fetching user on auth change:", error);
              return;
            }

            if (userProfile) {
              setAppUser({
                uid: session.user.id,
                email: session.user.email ?? null,
                companyId: userProfile.company_id,
                role: (userProfile.role ?? "owner") as UserRole,
              });
            }
          } catch (err) {
            console.error("Auth state change error:", err);
          }
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const register = async (
    email: string,
    password: string,
    businessName: string,
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;

    if (data.user) {
      try {
        const result = await bootstrapCompanyForUser({
          uid: data.user.id,
          email,
          businessName,
        });
        setSupabaseUser(data.user);
        setAppUser({
          uid: data.user.id,
          email,
          companyId: result.companyId,
          role: result.role,
        });
      } catch (bootstrapError) {
        const errMsg = formatError(bootstrapError);
        console.error('Bootstrap error:', errMsg);
        throw new Error(`Registrasi berhasil, tapi gagal membuat profil: ${errMsg}`);
      }
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({ supabaseUser, appUser, loading, login, register, logout }),
    [supabaseUser, appUser, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
