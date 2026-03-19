import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
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

  const fetchOrCreateCustomer = useCallback(
    async (userId: string, email?: string) => {
      // Try to fetch existing customer record
      const { data, error } = await supabase
        .from("storefront_customers")
        .select("*")
        .eq("user_id", userId)
        .eq("store_id", storeId)
        .maybeSingle();

      if (data) {
        setCustomer(data as StorefrontCustomer);
        return;
      }

      // Create customer record if not exists
      const { data: newCustomer, error: insertErr } = await supabase
        .from("storefront_customers")
        .insert({ user_id: userId, store_id: storeId, email: email || null })
        .select()
        .single();

      if (!insertErr && newCustomer) {
        setCustomer(newCustomer as StorefrontCustomer);
      }
    },
    [storeId]
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // defer to avoid Supabase deadlock
        setTimeout(() => fetchOrCreateCustomer(sess.user.id, sess.user.email), 0);
      } else {
        setCustomer(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        fetchOrCreateCustomer(sess.user.id, sess.user.email);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchOrCreateCustomer]);

  const isFetchFailure = (message: string) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("failed to fetch") ||
      normalized.includes("network") ||
      normalized.includes("context canceled") ||
      normalized.includes("request canceled")
    );
  };

  const signInWithProxy = async (loginEmail: string, loginPassword: string) => {
    const { data, error } = await supabase.functions.invoke("auth-proxy", {
      body: {
        action: "login",
        email: loginEmail,
        password: loginPassword,
      },
    });

    if (error) {
      throw new Error(error.message || "Unable to connect to authentication service");
    }

    const proxyError = (data as { error?: string } | null)?.error;
    if (proxyError) {
      throw new Error(proxyError);
    }

    const sessionData = (data as { data?: { access_token?: string; refresh_token?: string } } | null)?.data;
    if (!sessionData?.access_token || !sessionData?.refresh_token) {
      throw new Error("Authentication failed. Please try again.");
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
    });

    if (sessionError) {
      throw new Error(sessionError.message);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        if (isFetchFailure(error.message)) {
          await signInWithProxy(normalizedEmail, password);
          return { error: null };
        }

        return { error };
      }

      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";

      if (isFetchFailure(message)) {
        try {
          await signInWithProxy(normalizedEmail, password);
          return { error: null };
        } catch (proxyErr) {
          return { error: proxyErr };
        }
      }

      return { error: err };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCustomer(null);
  };

  return (
    <StorefrontAuthContext.Provider
      value={{ session, user, customer, loading, signUp, signIn, signOut }}
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
