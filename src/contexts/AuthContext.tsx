import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { maybeClearStaleReferralCookie } from "@/lib/referralTracking";

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
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
    );
    return !!key && !!localStorage.getItem(key);
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => hasStoredSession());
  const queryClient = useQueryClient();
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // v8.23.0: Skip getSession() entirely if no auth token exists in storage.
    // Saves a ~200ms /auth/v1/user round-trip on every cold load for logged-out
    // dashboard visitors. onAuthStateChange below still catches future sign-ins.
    if (!hasStoredSession()) {
      setLoading(false);
    } else {
      // 1. Restore session from storage FIRST — this is the source of truth
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        lastUserIdRef.current = session?.user?.id ?? null;
        setLoading(false);
        // Drop stale/partner-owned referral cookies on initial load
        maybeClearStaleReferralCookie(session?.user?.id ?? null).catch(() => {});
      });
    }

    // 2. Subscribe to future auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
          const prevUid = lastUserIdRef.current;
          const newUid = newSession?.user?.id ?? null;
          setSession(newSession);
          setUser(newSession?.user ?? null);

          // Cross-tab / account-swap safety: if the user identity changed
          // since the last event, blow away cached React Query data so the
          // previous user's stores/orders don't flash on the new account.
          if (event === "SIGNED_IN" && prevUid && newUid && prevUid !== newUid) {
            queryClient.clear();
          }
          lastUserIdRef.current = newUid;

          if (event === "SIGNED_IN") {
            maybeClearStaleReferralCookie(newUid).catch(() => {});
          }
        } else if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          lastUserIdRef.current = null;
          // Clear all cached data so a re-login as a different user can't
          // briefly see stale results.
          queryClient.clear();

          // Context-aware redirect: keep partners on /partners/login,
          // storefront customers on the storefront, everyone else on /login.
          try {
            const path = window.location.pathname || "";
            const isPublic =
              path === "/" ||
              path.startsWith("/login") ||
              path.startsWith("/signup") ||
              path.startsWith("/forgot-password") ||
              path.startsWith("/reset-password") ||
              path.startsWith("/partners/login") ||
              path.startsWith("/partners/signup") ||
              path === "/partners";
            if (!isPublic) {
              if (path.startsWith("/partners")) {
                window.location.assign("/partners/login");
              } else if (path.startsWith("/admin")) {
                window.location.assign("/admin/login");
              } else if (path.startsWith("/dashboard")) {
                window.location.assign("/login");
              }
              // storefront routes (/, /shop, /product/...) are public — stay put
            }
          } catch {}
        } else if (event === "USER_UPDATED" && newSession) {
          setUser(newSession.user);
        }
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    // scope: 'local' → only signs out THIS device.
    await supabase.auth.signOut({ scope: 'local' });
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
