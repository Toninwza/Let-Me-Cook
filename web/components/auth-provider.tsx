"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthState = {
  /** False when NEXT_PUBLIC_SUPABASE_* are not set: the app runs as the demo user. */
  configured: boolean;
  /** True until the first session check finishes. */
  loading: boolean;
  session: Session | null;
  name: string | null;
  email: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  configured: false,
  loading: false,
  session: null,
  name: null,
  email: null,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => {
    const user = session?.user;
    const metaName = typeof user?.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
    return {
      configured: Boolean(supabase),
      loading,
      session,
      name: metaName || user?.email?.split("@")[0] || null,
      email: user?.email ?? null,
      signOut: async () => {
        await supabase?.auth.signOut();
      },
    };
  }, [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
