import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;
    let hasNavigated = false;

    const redirect = (path: string) => {
      if (!isActive || hasNavigated) return;
      hasNavigated = true;
      navigate(path, { replace: true });
    };

    const url = new URL(window.location.href);
    const queryParams = url.searchParams;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const authType = hashParams.get("type") ?? queryParams.get("type");
    const isPasswordRecovery = authType === "recovery";
    const hasError = hashParams.has("error") || queryParams.has("error");

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        redirect("/reset-password");
        return;
      }

      if (event === "SIGNED_IN") {
        // Best-effort: if a referral cookie was set before email confirmation,
        // attach it to this user now that they have a session.
        import("@/lib/referralTracking")
          .then(({ attachReferralAfterSignup }) => attachReferralAfterSignup())
          .catch(() => {});
        redirect(isPasswordRecovery ? "/reset-password" : "/dashboard");
      }
    });

    const completeAuth = async () => {
      if (hasError) {
        redirect("/login");
        return;
      }

      const code = queryParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          redirect("/login");
          return;
        }

        import("@/lib/referralTracking")
          .then(({ attachReferralAfterSignup }) => attachReferralAfterSignup())
          .catch(() => {});
        redirect(isPasswordRecovery ? "/reset-password" : "/dashboard");
        return;
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          redirect("/login");
          return;
        }

        import("@/lib/referralTracking")
          .then(({ attachReferralAfterSignup }) => attachReferralAfterSignup())
          .catch(() => {});
        redirect(isPasswordRecovery ? "/reset-password" : "/dashboard");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        import("@/lib/referralTracking")
          .then(({ attachReferralAfterSignup }) => attachReferralAfterSignup())
          .catch(() => {});
        redirect(isPasswordRecovery ? "/reset-password" : "/dashboard");
        return;
      }

      redirect("/login");
    };

    void completeAuth();

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Verifying your account...</p>
      </div>
    </div>
  );
}
