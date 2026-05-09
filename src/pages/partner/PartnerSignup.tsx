import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, ArrowRight, Rocket } from "lucide-react";
import PartnerNav from "@/components/partner/PartnerNav";

export default function PartnerSignup() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && session) {
      (async () => {
        const { data } = await supabase.from("partners").select("id").eq("user_id", session.user.id).maybeSingle();
        if (data) navigate("/partners/dashboard", { replace: true });
      })();
    }
  }, [authLoading, session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = { name: name.trim(), email: email.trim().toLowerCase(), mobile: mobile.trim() };
    if (!trimmed.name || !trimmed.email || !password) {
      toast.error("Please fill all required fields");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      let userId: string | null = session?.user.id ?? null;

      if (!userId) {
        const { data, error } = await supabase.auth.signUp({
          email: trimmed.email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/partners/dashboard`,
            data: { full_name: trimmed.name, user_type: "partner" },
          },
        });
        if (error) throw error;
        userId = data.user?.id ?? null;
        if (!data.session) {
          toast.success("Account created! Please check your email, then sign in.");
          navigate("/partners/login");
          return;
        }
      }

      if (!userId) throw new Error("Signup failed");

      const { error: insErr } = await supabase.from("partners").insert({
        user_id: userId,
        name: trimmed.name,
        email: trimmed.email,
        mobile: trimmed.mobile || null,
      });
      if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) {
        throw insErr;
      }

      toast.success("Welcome aboard! Your partner account is ready.");
      navigate("/partners/dashboard");
    } catch (err: any) {
      toast.error(err?.message || "Could not create partner account");
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
            <div className="inline-flex h-12 w-12 items-center justify-center bg-bauhaus-red border-2 border-foreground shadow-bauhaus mb-4">
              <Rocket className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="font-black text-3xl sm:text-4xl tracking-tight text-foreground">Join the Partner Program</h1>
            <p className="mt-2 font-medium text-sm text-muted-foreground">Earn recurring commission on every store you refer.</p>
          </div>

          <div className="bg-bauhaus-white border-3 border-foreground shadow-bauhaus-lg p-6 sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field id="name" label="Full name" value={name} onChange={setName} maxLength={100} />
              <Field id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
              <Field id="mobile" label="Mobile (optional)" type="tel" value={mobile} onChange={setMobile} maxLength={20} />
              <Field id="password" label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-xs sm:text-sm px-6 py-3.5 border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create Partner Account <ArrowRight className="h-4 w-4" /></>}
              </button>

              <p className="pt-2 text-center text-sm text-muted-foreground">
                Already a partner?{" "}
                <Link to="/partners/login" className="font-bold uppercase tracking-wider text-xs text-foreground hover:text-bauhaus-red">
                  Login →
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
  id, label, value, onChange, type = "text", autoComplete, maxLength,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; autoComplete?: string; maxLength?: number;
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
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bauhaus-white text-foreground border-2 border-foreground px-3 py-2.5 font-medium text-sm focus:outline-none focus:shadow-bauhaus-sm focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all duration-150"
      />
    </div>
  );
}
