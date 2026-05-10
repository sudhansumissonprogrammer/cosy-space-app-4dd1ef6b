import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { setCapiUser } from "@/lib/metaEnrichment";

/**
 * Lazy-load the STOREFRONT supabase client — keeps the supabase chunk off the
 * storefront critical path for anonymous visitors.
 *
 * Important: this is the dedicated storefront auth client (separate storageKey),
 * NOT the dashboard/admin client. This isolation means a customer logging into a
 * storefront will NOT touch the merchant/admin session in the same browser.
 */
let _supabasePromise: Promise<typeof import("@/integrations/supabase/storefrontClient")> | null = null;
function getStorefrontSupabase() {
  if (!_supabasePromise) _supabasePromise = import("@/integrations/supabase/storefrontClient");
  return _supabasePromise;
}

interface StorefrontCustomer {
  id: string;
  user_id: string;
  store_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

interface StorefrontAuthContextType {
  session: Session | null;
  user: User | null;
  customer: StorefrontCustomer | null;
  loading: boolean;
  /** Lazily fetch/create the customer record. Only call from pages that need it (account, checkout). */
  ensureCustomer: () => Promise<StorefrontCustomer | null>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const StorefrontAuthContext = createContext<StorefrontAuthContextType | undefined>(undefined);

// Storage key used by the dedicated storefront supabase client.
// Must match the `storageKey` in src/integrations/supabase/storefrontClient.ts
const STOREFRONT_AUTH_STORAGE_KEY = "sb-storefront-auth-token";

export function StorefrontAuthProvider({
  children,
  storeId,
}: {
  children: ReactNode;
  storeId: string;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<StorefrontCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const ensurePromiseRef = useRef<Promise<StorefrontCustomer | null> | null>(null);

  const fetchOrCreateCustomer = useCallback(
    async (userId: string, email?: string): Promise<StorefrontCustomer | null> => {
      // Use the storefront client so the JWT (auth.uid()) matches RLS on
      // storefront_customers — the dashboard client never sees this session.
      const { supabaseStorefront } = await getStorefrontSupabase();
      const { data } = await supabaseStorefront
        .from("storefront_customers")
        .select("*")
        .eq("user_id", userId)
        .eq("store_id", storeId)
        .maybeSingle();

      if (data) {
        setCustomer(data as StorefrontCustomer);
        return data as StorefrontCustomer;
      }

      const { data: newCustomer, error: insertErr } = await supabaseStorefront
        .from("storefront_customers")
        .insert({ user_id: userId, store_id: storeId, email: email || null })
        .select()
        .single();

      if (!insertErr && newCustomer) {
        setCustomer(newCustomer as StorefrontCustomer);
        return newCustomer as StorefrontCustomer;
      }
      return null;
    },
    [storeId]
  );

  /** Lazy customer resolution — deduped via ref */
  const ensureCustomer = useCallback(async (): Promise<StorefrontCustomer | null> => {
    if (customer) return customer;
    if (!user) return null;
    if (ensurePromiseRef.current) return ensurePromiseRef.current;
    const promise = fetchOrCreateCustomer(user.id, user.email ?? undefined);
    ensurePromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      ensurePromiseRef.current = null;
    }
  }, [customer, user, fetchOrCreateCustomer]);

  useEffect(() => {
    // Fast-path: if no STOREFRONT auth token in localStorage, mark loading=false
    // immediately so anonymous visitors don't see a spinner. We STILL subscribe
    // to onAuthStateChange below so that a later phone-login (which writes the
    // token via setSession) propagates without a page refresh.
    const hasAuthToken = (() => {
      try {
        return !!localStorage.getItem(STOREFRONT_AUTH_STORAGE_KEY);
      } catch {
        return false;
      }
    })();

    if (!hasAuthToken) {
      setLoading(false);
    }

    let subscription: any;
    let cancelled = false;

    const initAuth = async () => {
      const { supabaseStorefront } = await getStorefrontSupabase();
      if (cancelled) return;

      const {
        data: { subscription: sub },
      } = supabaseStorefront.auth.onAuthStateChange((_event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (!sess?.user) {
          setCustomer(null);
        }
        setLoading(false);
        if (sess?.user) {
          import("@/lib/prefetchAccountRoutes")
            .then((m) => m.prefetchAccountRoutes())
            .catch(() => {});
        }
      });
      subscription = sub;

      // Only call getSession if we had a stored token (avoids a needless network
      // hit on cold loads for anonymous visitors).
      if (hasAuthToken) {
        supabaseStorefront.auth.getSession().then(({ data: { session: sess } }) => {
          setSession(sess);
          setUser(sess?.user ?? null);
          setLoading(false);
          if (sess?.user) {
            import("@/lib/prefetchAccountRoutes")
              .then((m) => m.prefetchAccountRoutes())
              .catch(() => {});
          }
        });
      }
    };

    // For users with a stored token, init immediately so /account doesn't bounce.
    // For anonymous users, defer until idle so initial paint isn't blocked.
    if (hasAuthToken) {
      initAuth();
    } else {
      const schedule = typeof requestIdleCallback !== "undefined" ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 200);
      const handle = schedule(() => { initAuth(); });
      return () => {
        cancelled = true;
        subscription?.unsubscribe();
        if (typeof cancelIdleCallback !== "undefined" && typeof handle === "number") {
          cancelIdleCallback(handle);
        }
      };
    }

    const safetyTimeout = setTimeout(() => setLoading(false), 2000);

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const signUp = async (email: string, password: string, name?: string) => {
    const { supabaseStorefront } = await getStorefrontSupabase();
    const { error } = await supabaseStorefront.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, user_type: "customer" } },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { supabaseStorefront } = await getStorefrontSupabase();
    const { error } = await supabaseStorefront.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    const { supabaseStorefront } = await getStorefrontSupabase();
    // scope: 'local' → only sign out THIS device. Without this, a customer
    // signing out on one device would force-logout all their other devices.
    await supabaseStorefront.auth.signOut({ scope: 'local' });
    setCustomer(null);
  };

  return (
    <StorefrontAuthContext.Provider
      value={{ session, user, customer, loading, ensureCustomer, signUp, signIn, signOut }}
    >
      {children}
    </StorefrontAuthContext.Provider>
  );
}

export function useStorefrontAuth() {
  const ctx = useContext(StorefrontAuthContext);
  if (!ctx) throw new Error("useStorefrontAuth must be used within StorefrontAuthProvider");
  return ctx;
}
