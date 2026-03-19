

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("aborted") || message.includes("timeout") || message.includes("context canceled");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    const requestOrigin = new URL(req.url).origin;
    const requestApiKey =
      req.headers.get("apikey") ||
      req.headers.get("x-api-key") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!requestApiKey) {
      return new Response(JSON.stringify({ error: "Auth service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeaders = {
      "Content-Type": "application/json",
      apikey: requestApiKey,
      authorization: `Bearer ${requestApiKey}`,
      "x-client-info": "auth-proxy",
    };

    if (action === "login") {
      let response: Response;

      try {
        response = await fetchWithTimeout(`${requestOrigin}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ email, password }),
        });
      } catch (fetchErr) {
        if (isTimeoutError(fetchErr)) {
          return new Response(JSON.stringify({ error: "Authentication server timeout. Please retry." }), {
            status: 504,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw fetchErr;
      }

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
      data?: { full_name: string | null };
    } = { email, password };

    if (payload.fullName !== undefined) {
      signupPayload.data = { full_name: payload.fullName?.trim() || null };
    }

    const redirectParam = payload.redirectTo
      ? `?redirect_to=${encodeURIComponent(payload.redirectTo)}`
      : "";

    let signupResponse: Response;

    try {
      signupResponse = await fetchWithTimeout(`${requestOrigin}/auth/v1/signup${redirectParam}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(signupPayload),
      });
    } catch (fetchErr) {
      if (isTimeoutError(fetchErr)) {
        return new Response(JSON.stringify({ error: "Authentication server timeout. Please retry." }), {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchErr;
    }

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
