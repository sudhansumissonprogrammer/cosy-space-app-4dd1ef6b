import { buildCors, matchAllowedOrigin } from "../_shared/security.ts";

type AuthProxyAction = "login" | "signup";

interface AuthProxyPayload {
  action?: AuthProxyAction;
  email?: string;
  password?: string;
  fullName?: string | null;
  redirectTo?: string;
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15;
const WINDOW_MS = 60_000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function getErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Authentication failed";

  const body = payload as Record<string, unknown>;
  return (
    (typeof body.msg === "string" && body.msg) ||
    (typeof body.error_description === "string" && body.error_description) ||
    (typeof body.error === "string" && body.error) ||
    "Authentication failed"
  );
}

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Refuse requests from unknown origins — auth-proxy returns raw tokens.
  if (!matchAllowedOrigin(req.headers.get("Origin"))) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as AuthProxyPayload;
    const action = payload.action;
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password;

    if (!action || !email || !password) {
      return new Response(JSON.stringify({ error: "action, email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action !== "login" && action !== "signup") {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ error: "Auth service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeaders = {
      "Content-Type": "application/json",
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      "x-client-info": "auth-proxy",
    };

    if (action === "login") {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ email, password }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        return new Response(JSON.stringify({ error: getErrorMessage(body) }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ data: body }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signupPayload: {
      email: string;
      password: string;
      data?: { full_name: string | null; user_type: "merchant" };
    } = { email, password };

    if (payload.fullName !== undefined) {
      signupPayload.data = {
        full_name: payload.fullName?.trim() || null,
        user_type: "merchant",
      };
    }

    const redirectParam = payload.redirectTo
      ? `?redirect_to=${encodeURIComponent(payload.redirectTo)}`
      : "";

    const signupResponse = await fetch(`${supabaseUrl}/auth/v1/signup${redirectParam}`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(signupPayload),
    });

    const signupBody = await signupResponse.json().catch(() => ({}));

    if (!signupResponse.ok) {
      return new Response(JSON.stringify({ error: getErrorMessage(signupBody) }), {
        status: signupResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: signupBody }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected auth error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
