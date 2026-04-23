import { useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { storefrontPath } from "@/lib/subdomain";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { useLoginRateLimit } from "@/hooks/useLoginRateLimit";

export default function StorefrontLogin() {
  const store = useOutletContext<StoreData>();
  const { signIn } = useStorefrontAuth();
  const navigate = useNavigate();

  // Phone login (default)
  const [phone, setPhone] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);

  // Email + password login (fallback)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const { isLocked, remainingSeconds, attemptsLeft, checkCanAttempt, recordFailedAttempt, resetAttempts } = useLoginRateLimit();

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkCanAttempt()) {
      toast.error(`Too many login attempts. Please wait ${remainingSeconds}s.`);
      return;
    }
    const normalized = phone.replace(/[^0-9]/g, "");
    if (normalized.length < 7) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setPhoneLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-login", {
        body: { phone: normalized, store_id: store.id },
      });
      if (error || !data?.session) {
        recordFailedAttempt();
        throw new Error(error?.message || data?.error || "Login failed");
      }
      // Inject session into the supabase client → triggers onAuthStateChange → user is logged in
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessErr) throw sessErr;
      resetAttempts();
      toast.success(data.is_new_user ? "Welcome!" : "Logged in!");
      navigate(storefrontPath(store.slug, "account"));
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkCanAttempt()) {
      toast.error(`Too many login attempts. Please wait ${remainingSeconds}s.`);
      return;
    }
    setEmailLoading(true);
    const { error } = await signIn(email, password);
    setEmailLoading(false);
    if (error) {
      recordFailedAttempt();
      toast.error(error.message || "Login failed");
    } else {
      resetAttempts();
      toast.success("Logged in!");
      navigate(storefrontPath(store.slug, "account"));
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>Sign in to your {store.name} account</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="phone" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="phone">
                <Phone className="h-4 w-4 mr-2" /> Phone
              </TabsTrigger>
              <TabsTrigger value="email">
                <Mail className="h-4 w-4 mr-2" /> Email
              </TabsTrigger>
            </TabsList>

            <TabsContent value="phone">
              <form onSubmit={handlePhoneLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    No password needed. Enter your phone to view orders & track delivery.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={phoneLoading || isLocked}>
                  {phoneLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLocked ? `Locked (${remainingSeconds}s)` : "Continue"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="email">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={emailLoading || isLocked}>
                  {emailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLocked ? `Locked (${remainingSeconds}s)` : "Sign In"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {attemptsLeft < 5 && !isLocked && (
            <p className="mt-3 text-xs text-destructive text-center">{attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining</p>
          )}

          <p className="mt-4 text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link to={storefrontPath(store.slug, "signup")} className="font-medium text-primary underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
