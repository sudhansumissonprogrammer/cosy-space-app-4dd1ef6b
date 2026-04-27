// Separate Supabase client for STOREFRONT customer auth.
//
// Why this exists:
// The main `supabase` client (src/integrations/supabase/client.ts) is used by the
// merchant dashboard + admin panel and persists its session in localStorage under
// the default key `sb-<ref>-auth-token`. If the storefront also used that client,
// a customer logging into a storefront would overwrite the merchant/admin session
// in the same browser (and vice-versa), and a single signOut would log out both.
//
// This client uses an isolated `storageKey` so storefront customer sessions are
// completely independent from dashboard sessions. They can coexist in the same
// browser, across tabs, without interfering with each other.
//
// Use this client ONLY for storefront customer auth calls:
//   - signUp / signIn / signOut / setSession
//   - getSession / onAuthStateChange (storefront context)
//
// For database reads/writes and edge function invocations, keep using the main
// `supabase` client from "@/integrations/supabase/client" — RLS + anon key handle
// access control there.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseStorefront = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      // Isolated storage key — does NOT collide with the dashboard/admin session.
      storageKey: "sb-storefront-auth-token",
    },
  }
);
