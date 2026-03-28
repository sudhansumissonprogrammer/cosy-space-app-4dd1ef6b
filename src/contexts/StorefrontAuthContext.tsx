import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
      const { data } = await supabase
        .from("storefront_customers")
        .select("*")
        .eq("user_id", userId)
        .eq("store_id", storeId)
        .maybeSingle();

      if (data) {
        setCustomer(data as StorefrontCustomer);
        return data as StorefrontCustomer;
      }

      const { data: newCustomer, error: insertErr } = await supabase
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
    // Fast-path: if no Supabase auth token in localStorage, skip auth entirely.
    const hasAuthToken = (() => {
      try {
        const storageKey = `sb-soxuyuupzodkufxbbndq-auth-token`;
        return !!localStorage.getItem(storageKey);
      } catch {
        return false;
      }
    })();

    if (!hasAuthToken) {
      setLoading(false);
      return;
    }

    const initAuth = () => {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (!sess?.user) {
          setCustomer(null);
        }
        setLoading(false);
      });

      supabase.auth.getSession().then(({ data: { session: sess } }) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        setLoading(false);
      });

      return subscription;
    };

    let subscription: any;
    const schedule = typeof requestIdleCallback !== "undefined" ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 100);
    const handle = schedule(() => {
      subscription = initAuth();
    });

    const safetyTimeout = setTimeout(() => setLoading(false), 2000);

    return () => {
      subscription?.unsubscribe();
      clearTimeout(safetyTimeout);
      if (typeof cancelIdleCallback !== "undefined" && typeof handle === "number") {
        cancelIdleCallback(handle);
      }
    };
  }, []);

  const signUp = async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
