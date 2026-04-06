import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { LayoutDashboard, Loader2, Check, Crown, Rocket, ShoppingBag } from "lucide-react";

const PLANS = [
  {
    slug: "starter",
    name: "Starter",
    price: "₹499",
    period: "/month",
    desc: "Perfect for getting started",
    features: ["100 Products", "Custom Domain", "UPI Payments", "WhatsApp Orders", "Basic Analytics"],
    icon: ShoppingBag,
  },
  {
    slug: "growth",
    name: "Growth",
    price: "₹999",
    period: "/month",
    desc: "Best for serious sellers",
    features: ["500 Products", "All Payment Options", "Advanced Analytics", "Facebook Pixel", "Coupons & Discounts", "AI Descriptions"],
    icon: Rocket,
    popular: true,
  },
];

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"plan" | "details">("plan");
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) {
        toast.error(error.message || "Google sign-in failed");
      }
    } catch (err) {
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const isFetchFailure = (message: string) =>
    message.toLowerCase().includes("failed to fetch") ||
    message.toLowerCase().includes("network");

  const signUpWithProxy = async (
    signupEmail: string,
    signupPassword: string,
    signupFullName: string
  ) => {
    const { data, error } = await supabase.functions.invoke("auth-proxy", {
      body: {
        action: "signup",
        email: signupEmail,
        password: signupPassword,
        fullName: signupFullName || null,
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw new Error(error.message || "Unable to connect to authentication service");
    }

    const proxyError = (data as { error?: string } | null)?.error;
    if (proxyError) {
      throw new Error(proxyError);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFullName = fullName.trim();

    if (!normalizedEmail || !password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { full_name: normalizedFullName || null, selected_plan: selectedPlan },
        },
      });

      if (error) {
        if (isFetchFailure(error.message)) {
          await signUpWithProxy(normalizedEmail, password, normalizedFullName);
          toast.success("Account created! Signing you in...");
          navigate("/dashboard");
          return;
        }

        toast.error(error.message);
        return;
      }

      if (signUpData?.session) {
        toast.success("Account created! Your 7-day free trial has started.");
        navigate("/dashboard");
      } else {
        toast.success("Account created! Please check your email to confirm.");
        navigate("/login");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create account";

      if (isFetchFailure(message)) {
        try {
          await signUpWithProxy(normalizedEmail, password, normalizedFullName);
          toast.success("Account created! Signing you in...");
          navigate("/dashboard");
          return;
        } catch (proxyErr) {
          const proxyMessage =
            proxyErr instanceof Error ? proxyErr.message : "Unable to create account. Please try again.";
          toast.error(proxyMessage);
          return;
        }
      }

      console.error("Signup network error:", err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (step === "plan") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="mb-8 flex flex-col items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary">
              <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Choose your plan</h1>
            <p className="text-sm text-muted-foreground text-center">
              Start with a <span className="font-semibold text-primary">7-day free trial</span> — no payment required
            </p>
          </div>

          <div className="grid gap-4">
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.slug;
              const Icon = plan.icon;
              return (
                <button
                  key={plan.slug}
                  type="button"
                  onClick={() => setSelectedPlan(plan.slug)}
                  className={`relative w-full text-left rounded-lg border-2 p-5 transition-all duration-200 ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                      Recommended
                    </span>
                  )}
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isSelected ? "bg-primary" : "bg-muted"}`}>
                      <Icon className={`h-5 w-5 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <h3 className="font-semibold text-foreground">{plan.name}</h3>
                        <div className="text-right">
                          <span className="text-lg font-bold text-foreground">{plan.price}</span>
                          <span className="text-xs text-muted-foreground">{plan.period}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{plan.desc}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                        {plan.features.map((f) => (
                          <span key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Check className="h-3 w-3 text-primary" strokeWidth={3} />
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="absolute top-5 right-5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
            <p className="text-sm font-medium text-foreground">🎉 7-Day Free Trial on all plans</p>
            <p className="text-xs text-muted-foreground mt-0.5">No credit card needed. Cancel anytime.</p>
          </div>

          <Button className="w-full mt-6" size="lg" onClick={() => setStep("details")}>
            Continue with {PLANS.find((p) => p.slug === selectedPlan)?.name} Plan
          </Button>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary">
            <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Create an account</h1>
          <p className="text-sm text-muted-foreground">
            {PLANS.find((p) => p.slug === selectedPlan)?.name} plan — 7 days free
          </p>
        </div>

        <Card>
          <form onSubmit={handleSignup}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="full-name">Full Name</Label>
                <Input
                  id="full-name"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start 7-Day Free Trial
              </Button>

              <button
                type="button"
                onClick={() => setStep("plan")}
                className="text-xs text-muted-foreground hover:text-primary underline"
              >
                ← Change plan
              </button>

              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
