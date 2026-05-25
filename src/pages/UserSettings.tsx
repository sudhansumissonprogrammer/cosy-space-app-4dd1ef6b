import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Upload, X, Crown, LogOut, Sparkles, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { processImage, getCompressionMessage } from "@/lib/imageCompression";
import { uploadOptimizedImage, generateUploadPath } from "@/lib/uploadOptimizedImage";
import BillingSection from "@/components/billing/BillingSection";

const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB

export default function UserSettings() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [partnerCode, setPartnerCode] = useState("");

  // Existing referral attribution (if any)
  const { data: referral, refetch: refetchReferral } = useQuery({
    queryKey: ["my-referral", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("partner_referrals")
        .select("id, partner_id, status, created_at, partners:partner_id(name, partner_code)")
        .eq("referred_user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const applyPartnerCode = useMutation({
    mutationFn: async () => {
      const cleaned = partnerCode.trim().toUpperCase();
      if (!/^SBP\d{2,}$/.test(cleaned)) {
        throw new Error("Code should look like SBP1234");
      }
      const { data, error } = await supabase.functions.invoke("attach-referral", {
        body: { ref: cleaned },
      });
      if (error) throw new Error(error.message || "Could not apply code");
      if (!data?.ok) {
        const reasons: Record<string, string> = {
          partner_inactive: "This partner code is not active.",
          self_referral: "You can't use your own partner code.",
          already_attached: "You're already linked to another partner.",
          invalid_code: "Invalid partner code.",
        };
        throw new Error(reasons[data?.reason] || "Could not apply code");
      }
      return data;
    },
    onSuccess: (data: any) => {
      const extra = data?.backfilled_stores
        ? ` ${data.backfilled_stores} of your stores have been linked.`
        : "";
      toast.success(`Partner code applied!${extra}`);
      setPartnerCode("");
      refetchReferral();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get the user's store to look up plan assignment
  const { data: userStore } = useQuery({
    queryKey: ["my-store-for-plan", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, slug, billing_mode")
        .eq("owner_id", user!.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isCommissionMode = (userStore as any)?.billing_mode === "commission";

  // Get effective plan from store_plan_assignments (includes admin overrides)
  const { data: storePlanAssignment } = useQuery({
    queryKey: ["my-store-plan", userStore?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_plan_assignments")
        .select("*, plans:plan_id(name, price, product_limit)")
        .eq("store_id", userStore!.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userStore?.id,
  });

  // Fallback to subscriptions if no store plan assignment
  const { data: subscription } = useQuery({
    queryKey: ["my-subscription", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plans:plan_id(name, price, product_limit)")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !storePlanAssignment,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      if (profile.avatar_url) setAvatarPreview(profile.avatar_url);
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      let avatarUrl = profile?.avatar_url || null;
      if (avatarFile) {
        const basePath = generateUploadPath(user!.id, "avatar");
        const result = await uploadOptimizedImage(avatarFile, "store-logos", basePath);
        if (result.compressionMessage) toast.success(result.compressionMessage);
        avatarUrl = result.mainUrl;
      }
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null, avatar_url: avatarUrl })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updatePassword = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
      if (newPassword !== confirmPassword) throw new Error("Passwords do not match");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleAvatarChange = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be less than 6MB");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Account Settings</h1>

      {/* Commission-mode stores: show wallet card instead of subscription UI */}
      {isCommissionMode && userStore?.id ? (
        <WalletAccountCard
          storeId={userStore.id}
          storeSlug={(userStore as any).slug}
          variant="compact"
        />
      ) : (
        <>
          {/* Billing & Subscription */}
          <BillingSection storeId={userStore?.id || null} />

          {/* Current Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const spa = storePlanAssignment as any;
                const plan = spa?.plans as any;
                const effectiveName = spa?.custom_plan_name || plan?.name;
                const isFreeLifetime = spa?.is_free_lifetime;
                const isOneTime = spa?.is_one_time;
                const effectivePrice = isFreeLifetime ? 0 : (spa?.custom_price ?? plan?.price ?? 0);
                const effectiveLimit = isFreeLifetime ? null : (spa?.custom_product_limit ?? plan?.product_limit);

                if (effectiveName) {
                  return (
                    <div className="flex items-center gap-3">
                      <Crown className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">{effectiveName}</p>
                        <p className="text-sm text-muted-foreground">
                          {isFreeLifetime
                            ? "Free Lifetime — Unlimited products"
                            : `₹${Number(effectivePrice).toFixed(0)}${isOneTime ? " one-time" : "/mo"} — ${effectiveLimit ? `${effectiveLimit} products` : "Unlimited products"}`}
                        </p>
                      </div>
                      <Badge variant="default" className="ml-auto">
                        {isFreeLifetime ? "Lifetime" : "Active"}
                      </Badge>
                    </div>
                  );
                }

                if (subscription) {
                  const subPlan = subscription.plans as any;
                  return (
                    <div className="flex items-center gap-3">
                      <Crown className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">{subPlan?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ₹{Number(subPlan?.price || 0).toFixed(0)}/mo —{" "}
                          {subPlan?.product_limit ? `${subPlan.product_limit} products` : "Unlimited products"}
                        </p>
                      </div>
                      <Badge variant="default" className="ml-auto">Active</Badge>
                    </div>
                  );
                }

                return <p className="text-sm text-muted-foreground">Free plan</p>;
              })()}
            </CardContent>
          </Card>
        </>
      )}

      {/* Partner / Referral code */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Referred by a partner?
          </CardTitle>
          <CardDescription>
            {referral
              ? "You're linked to a ShopBanao partner."
              : "Have a partner code? Add it once and your stores will be tracked automatically."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referral ? (
            <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {(referral as any).partners?.name || "Partner"}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({(referral as any).partners?.partner_code})
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Linked on {new Date(referral.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyPartnerCode.mutate();
              }}
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="partner-code">Partner code</Label>
                <Input
                  id="partner-code"
                  placeholder="e.g. SBP1023"
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                  maxLength={11}
                  className="font-mono"
                />
              </div>
              <Button type="submit" disabled={applyPartnerCode.isPending || !partnerCode.trim()}>
                {applyPartnerCode.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Profile */}
      <form onSubmit={(e) => { e.preventDefault(); updateProfile.mutate(); }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Your public display information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Avatar</Label>
              {avatarPreview ? (
                <div className="relative inline-block">
                  <img src={avatarPreview} alt="Avatar" className="h-16 w-16 rounded-full border object-cover" />
                  <button
                    type="button"
                    onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-input hover:border-primary/50">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarChange(e.target.files?.[0])} />
                </label>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name</Label>
              <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled />
            </div>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Profile
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Change Password */}
      <form onSubmit={(e) => { e.preventDefault(); updatePassword.mutate(); }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-pw">New Password</Label>
              <Input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} maxLength={128} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirm New Password</Label>
              <Input id="confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} maxLength={128} />
            </div>
            <Button type="submit" disabled={updatePassword.isPending}>
              {updatePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Sign Out */}
      <Card>
        <CardContent className="pt-6">
          <Button
            variant="destructive"
            className="w-full"
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
