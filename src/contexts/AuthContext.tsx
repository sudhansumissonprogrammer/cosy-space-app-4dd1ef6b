import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Synchronous check: does localStorage contain a Supabase session?
 * If not, we know loading=false immediately — no spinner for anonymous users.
 */
function hasStoredSession(): boolean {
  try {
    // Supabase stores session under this key pattern
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
    );
    return !!key && !!localStorage.getItem(key);
  } catch {
    return false; // localStorage blocked — assume no session
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  // Start loading=false if there's clearly no stored session — skip spinner entirely
  const [loading, setLoading] = useState(() => hasStoredSession());

  useEffect(() => {
    // 1. Restore session from storage FIRST — this is the source of truth
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Then subscribe to future changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Don't log out on transient token refresh failures
        if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
          setSession(newSession);
          setUser(newSession?.user ?? null);
        } else if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
        }
        // Ignore INITIAL_SESSION (already handled by getSession) and
        // USER_UPDATED events that don't affect the session
        if (event === "USER_UPDATED" && newSession) {
          setUser(newSession.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
