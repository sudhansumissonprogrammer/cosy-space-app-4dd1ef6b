import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, ArrowRight, Sparkles, AlertTriangle } from "lucide-react";
import PartnerNav from "@/components/partner/PartnerNav";

export default function PartnerLogin() {
  const navigate = useNavigate();
  const { session, loading: authLoading, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [otherAccount, setOtherAccount] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !session) return;
    (async () => {
      const { data: p } = await supabase
        .from("partners")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (p) navigate("/partners/dashboard", { replace: true });
      else setOtherAccount(session.user.email || "another account");
    })();
  }, [authLoading, session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otherAccount) {
      toast.error("Sign out first to log into a partner account");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      navigate("/partners/dashboard");
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bauhaus-canvas flex flex-col">
      <PartnerNav />

      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center bg-bauhaus-blue border-2 border-foreground shadow-bauhaus mb-4">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="font-black text-3xl sm:text-4xl tracking-tight text-foreground">Partner Login</h1>
            <p className="mt-2 font-medium text-sm text-muted-foreground">Sign in to your partner dashboard.</p>
          </div>

          {otherAccount && (
            <div className="mb-5 bg-bauhaus-yellow border-3 border-foreground shadow-bauhaus p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold uppercase tracking-wider text-xs text-foreground">Another account is signed in</p>
                  <p className="mt-1 font-medium text-sm text-foreground/80">
                    You're signed in as <span className="font-black">{otherAccount}</span>. Sign out first to log into a partner account.
                  </p>
                  <button
                    onClick={async () => { await signOut(); setOtherAccount(null); }}
                    className="mt-3 inline-flex items-center justify-center gap-2 bg-foreground text-primary-foreground font-bold uppercase tracking-wider text-xs px-4 py-2 border-2 border-foreground shadow-bauhaus-sm hover:bg-foreground/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-bauhaus-white border-3 border-foreground shadow-bauhaus-lg p-6 sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
              <div>
                <Field id="password" label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
                <Link to="/forgot-password" className="mt-2 block text-right font-bold uppercase tracking-widest text-[10px] text-muted-foreground hover:text-bauhaus-red">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading || !!otherAccount}
                className="w-full inline-flex items-center justify-center gap-2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-xs sm:text-sm px-6 py-3.5 border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Login <ArrowRight className="h-4 w-4" /></>}
              </button>

              <p className="pt-2 text-center text-sm text-muted-foreground">
                New here?{" "}
                <Link to="/partners/signup" className="font-bold uppercase tracking-wider text-xs text-foreground hover:text-bauhaus-red">
                  Become a partner →
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  id, label, value, onChange, type = "text", autoComplete,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-bold uppercase tracking-widest text-[10px] text-foreground mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bauhaus-white text-foreground border-2 border-foreground px-3 py-2.5 font-medium text-sm focus:outline-none focus:shadow-bauhaus-sm focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all duration-150"
      />
    </div>
  );
}
