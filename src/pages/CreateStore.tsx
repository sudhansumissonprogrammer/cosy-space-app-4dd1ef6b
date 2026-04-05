import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, Upload, X, ArrowRight, ArrowLeft, Store, MapPin, Phone,
  Instagram, Facebook, Check, Sparkles, Globe, MessageCircle, Zap,
  Rocket, Crown, ShoppingBag,
} from "lucide-react";
import { processImage, getCompressionMessage } from "@/lib/imageCompression";
import { uploadOptimizedImage, generateUploadPath } from "@/lib/uploadOptimizedImage";

const CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "AED", label: "UAE Dirham (AED)" },
  { code: "SAR", label: "Saudi Riyal (SAR)" },
  { code: "BRL", label: "Brazilian Real (R$)" },
  { code: "NGN", label: "Nigerian Naira (₦)" },
  { code: "ZAR", label: "South African Rand (R)" },
  { code: "PKR", label: "Pakistani Rupee (₨)" },
  { code: "BDT", label: "Bangladeshi Taka (৳)" },
  { code: "EGP", label: "Egyptian Pound (E£)" },
  { code: "MYR", label: "Malaysian Ringgit (RM)" },
  { code: "IDR", label: "Indonesian Rupiah (Rp)" },
  { code: "PHP", label: "Philippine Peso (₱)" },
];

const STEPS = [
  { id: 1, title: "Store Info", icon: Store, desc: "Name & branding", motivation: "Let's build something amazing! 🚀" },
  { id: 2, title: "Location", icon: MapPin, desc: "Where you are", motivation: "Great start! Keep going 💪" },
  { id: 3, title: "Contact", icon: Phone, desc: "How to reach you", motivation: "Almost there! 🎯" },
  { id: 4, title: "Social", icon: Instagram, desc: "Your presence", motivation: "Final step — you're a star! ⭐" },
];

export default function CreateStore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [checkingStore, setCheckingStore] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  const [showExistingStoreDialog, setShowExistingStoreDialog] = useState(false);
  const [existingStoreSlug, setExistingStoreSlug] = useState<string | null>(null);
  const [creatingAnimation, setCreatingAnimation] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("stores")
      .select("id, slug")
      .eq("owner_id", user.id)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          // User already has a store — redirect to dashboard immediately
          navigate("/dashboard", { replace: true });
          return;
        }
        setCheckingStore(false);
      });
  }, [user, navigate]);

  // Step 1
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [orderMode, setOrderMode] = useState<"whatsapp" | "website" | "both">("website");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);

  // Step 2
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [location, setLocation] = useState("");

  // Step 3
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  // Step 4
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");

  const theme = "theme-1";

  const generateSlug = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(generateSlug(value));
  };

  const handleFileSelect = (
    file: File | null,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File must be less than 5MB");
        return;
      }
      setFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const removeFile = (
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    setFile(null);
    setPreview(null);
  };

  const uploadFile = async (file: File, bucket: string, _path: string) => {
    const basePath = generateUploadPath(user!.id, "new-store");
    const result = await uploadOptimizedImage(file, bucket, basePath);
    if (result.compressionMessage) toast.success(result.compressionMessage);
    return result.mainUrl;
  };

  const goNext = () => {
    if (step === 1 && (!name.trim() || !slug.trim())) {
      toast.error("Store name and slug are required");
      return;
    }
    setDirection("forward");
    setStep((s) => Math.min(s + 1, 4));
  };

  const goBack = () => {
    setDirection("back");
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setCreatingAnimation(true);
    setLoading(true);

    // Brief magical delay for the animation
    await new Promise(r => setTimeout(r, 1200));

    try {
      let logoUrl: string | null = null;
      let bannerUrl: string | null = null;
      let mobileHeroUrl: string | null = null;

      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        logoUrl = await uploadFile(logoFile, "store-logos", `${user.id}/${slug}-logo.${ext}`);
      }
      if (bannerFile) {
        const ext = bannerFile.name.split(".").pop();
        bannerUrl = await uploadFile(bannerFile, "store-banners", `${user.id}/${slug}-banner.${ext}`);
      }
      if (heroFile) {
        const ext = heroFile.name.split(".").pop();
        mobileHeroUrl = await uploadFile(heroFile, "store-banners", `${user.id}/${slug}-mobile-hero.${ext}`);
      }

      const { data: newStore, error } = await (supabase as any).from("stores").insert({
        owner_id: user.id,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        whatsapp_number: whatsappNumber.trim() || null,
        currency,
        order_mode: orderMode,
        city: city.trim() || null,
        state: state.trim() || null,
        location: location.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        facebook_url: facebookUrl.trim() || null,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        mobile_hero_url: mobileHeroUrl,
        theme,
        owner_email: ownerEmail.trim() || null,
      }).select("id").single();

      if (error) {
        setCreatingAnimation(false);
        if (error.code === "23505") {
          toast.error("A store with this slug already exists");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Create default theme config — Elegant Black & White + Algeria SC + Center + Transparent + Mobile Nav
      if (newStore?.id) {
        await (supabase as any).from("store_theme_config").insert({
          store_id: newStore.id,
          primary_color: "#1a1a1a",
          accent_color: "#f5f5f5",
          text_color: "#1a1a1a",
          background_color: "#ffffff",
          heading_font: "Alegreya SC",
          body_font: "Alegreya SC",
          button_style: "rounded",
          product_card_style: "style-1",
          category_style: "minimal",
          header_style: "transparent",
          header_logo_alignment: "Center",
          mobile_nav_enabled: true,
          marquee_enabled: false,
          marquee_text: "",
          marquee_gradient: "linear-gradient(90deg, #1a1a1a, #333333)",
        }).then(({ error: themeErr }: any) => {
          if (themeErr) console.warn("Theme config insert failed:", themeErr.message);
        });

        // AI-powered content generation (non-blocking for store creation)
        try {
          const { data: aiData, error: aiErr } = await supabase.functions.invoke(
            "generate-store-content",
            {
              body: {
                store_name: name.trim(),
                store_description: description.trim() || name.trim(),
              },
            }
          );

          if (!aiErr && aiData && !aiData.error) {
            // Update store with AI-generated content
            const updatePayload: Record<string, string> = {};
            if (aiData.store_description) updatePayload.description = aiData.store_description;
            if (aiData.meta_title) updatePayload.meta_title = aiData.meta_title;
            if (aiData.meta_description) updatePayload.meta_description = aiData.meta_description;
            if (aiData.about_us) updatePayload.about_us_text = aiData.about_us;

            if (Object.keys(updatePayload).length > 0) {
              await (supabase as any)
                .from("stores")
                .update(updatePayload)
                .eq("id", newStore.id);
            }

            // Create About Us page with AI content
            if (aiData.about_us) {
              await (supabase as any).from("store_pages").insert({
                store_id: newStore.id,
                title: "About Us",
                slug: "about-us",
                page_type: "about",
                content: aiData.about_us,
                is_active: true,
                display_order: 0,
              }).then(({ error: pageErr }: any) => {
                if (pageErr) console.warn("About page insert failed:", pageErr.message);
              });
            }
          } else {
            console.warn("AI content generation skipped:", aiErr || aiData?.error);
          }
        } catch (aiError) {
          console.warn("AI content generation failed (non-blocking):", aiError);
        }
      }

      // Pre-warm edge caches so first visitor gets instant load
      import("@/lib/prewarmStore").then(({ prewarmStore }) => {
        prewarmStore(slug.trim());
      }).catch(() => {});

      setShowConfetti(true);
      toast.success("Store created successfully! 🎉");
      queryClient.invalidateQueries({ queryKey: ["my-store"] });
      setTimeout(() => navigate("/dashboard", { replace: true }), 2000);
    } catch (err: any) {
      setCreatingAnimation(false);
      toast.error(err.message || "Failed to create store");
    } finally {
      setLoading(false);
    }
  };

  const progress = (step / STEPS.length) * 100;
  const currentStep = STEPS[step - 1];

  if (checkingStore) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Full-screen creating animation overlay
  if (creatingAnimation) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
        {/* Animated rings */}
        <div className="relative flex items-center justify-center">
          <div className="absolute h-32 w-32 rounded-full border-2 border-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
          <div className="absolute h-24 w-24 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: "1.5s", animationDelay: "0.3s" }} />
          <div className="absolute h-16 w-16 rounded-full border-2 border-primary/40 animate-ping" style={{ animationDuration: "1s", animationDelay: "0.6s" }} />
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
            <Rocket className="h-10 w-10 text-primary-foreground animate-bounce" />
          </div>
        </div>

        {/* Floating particles */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-primary/20"
            style={{
              width: `${4 + Math.random() * 6}px`,
              height: `${4 + Math.random() * 6}px`,
              left: `${15 + Math.random() * 70}%`,
              top: `${15 + Math.random() * 70}%`,
              animation: `float-particle ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}

        <div className="mt-10 text-center space-y-2">
          <h2 className="text-xl font-bold text-foreground animate-pulse">
            Creating your store...
          </h2>
          <p className="text-sm text-muted-foreground">
            Setting up <span className="font-semibold text-primary">{name || "your store"}</span> ✨
          </p>
          <div className="mx-auto mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000"
              style={{
                width: loading ? "85%" : "100%",
                animation: "progress-grow 1.5s ease-out forwards",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8 relative">
      {/* Existing Store Dialog */}
      <Dialog open={showExistingStoreDialog} onOpenChange={setShowExistingStoreDialog}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader className="items-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Crown className="h-8 w-8 text-primary animate-bounce" />
            </div>
            <DialogTitle className="text-xl">You Already Have a Store!</DialogTitle>
            <DialogDescription className="text-sm">
              Your store <span className="font-semibold text-primary">{existingStoreSlug}.shopbanao.in</span> is already live and ready for business.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="rounded-xl border bg-accent/30 p-4 text-left">
              <div className="flex items-start gap-3">
                <ShoppingBag className="mt-0.5 h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">One store per account</p>
                  <p className="text-xs text-muted-foreground">
                    Each account gets one powerful store. Head to your dashboard to manage products, orders, and themes!
                  </p>
                </div>
              </div>
            </div>
            <Button
              onClick={() => navigate("/dashboard")}
              className="w-full gap-2"
            >
              <Rocket className="h-4 w-4" />
              Go to My Dashboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (existingStoreSlug) {
                  window.open(`https://${existingStoreSlug}.shopbanao.in`, "_blank");
                }
              }}
              className="w-full text-xs gap-1.5"
            >
              <Globe className="h-3.5 w-3.5" />
              Visit My Store
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confetti overlay */}
      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="text-6xl animate-bounce-once">🎉</div>
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${6 + Math.random() * 8}px`,
                height: `${6 + Math.random() * 8}px`,
                backgroundColor: ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--warning))', 'hsl(var(--success))'][i % 4],
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
                animation: `confetti-fall ${1 + Math.random() * 2}s ease-out forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
                opacity: 0.8,
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Create Your Store</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set up your storefront in just a few steps</p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <p className="text-center text-xs font-medium text-primary animate-fade-in" key={step}>
          {currentStep.motivation}
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              type="button"
              onClick={() => { if (s.id < step) { setDirection("back"); setStep(s.id); } }}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all duration-300 ${
                step === s.id
                  ? "bg-primary text-primary-foreground shadow-md scale-110"
                  : step > s.id
                  ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.id ? (
                <Check className="h-3 w-3" />
              ) : (
                <s.icon className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">{s.title}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`mx-1 h-px w-6 transition-colors duration-500 ${
                step > s.id ? "bg-primary" : "bg-border"
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardContent className="p-5 sm:p-8">
          <div
            key={step}
            className="animate-fade-in"
            style={{ animationDuration: "0.35s" }}
          >
            {/* Step 1: Store Info */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-foreground">Store Information</h2>
                  <p className="text-sm text-muted-foreground">Tell us about your store</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="store-name">Store Name *</Label>
                  <Input
                    id="store-name"
                    placeholder="My Fashion Store"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    maxLength={100}
                    className="h-11"
                  />
                </div>

                {slug && (
                  <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Your store will be live at:</p>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-primary" />
                      {slug}.shopbanao.in
                    </p>
                    <p className="text-[10px] text-muted-foreground">You can connect your own custom domain later in Settings → Domain</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your store in a few words..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Order Mode — 3 options */}
                <div className="space-y-2">
                  <Label>How do you want to take orders?</Label>
                  <RadioGroup
                    value={orderMode}
                    onValueChange={(v) => setOrderMode(v as "whatsapp" | "website" | "both")}
                    className="grid gap-3"
                  >
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all duration-200 ${orderMode === "whatsapp" ? "border-primary bg-primary/5 shadow-sm" : "border-input hover:border-primary/30"}`}>
                      <RadioGroupItem value="whatsapp" className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <MessageCircle className="h-4 w-4 text-success" /> WhatsApp Orders
                        </p>
                        <p className="text-xs text-muted-foreground">Customers order via WhatsApp messages</p>
                      </div>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all duration-200 ${orderMode === "website" ? "border-primary bg-primary/5 shadow-sm" : "border-input hover:border-primary/30"}`}>
                      <RadioGroupItem value="website" className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Globe className="h-4 w-4 text-accent-foreground" /> Website Orders
                        </p>
                        <p className="text-xs text-muted-foreground">Customers checkout directly on your site</p>
                      </div>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all duration-200 ${orderMode === "both" ? "border-primary bg-primary/5 shadow-sm" : "border-input hover:border-primary/30"}`}>
                      <RadioGroupItem value="both" className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-warning" /> Both WhatsApp & Website
                        </p>
                        <p className="text-xs text-muted-foreground">Let customers choose their preferred way</p>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                {/* Logo + Banner */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Logo</Label>
                    {logoPreview ? (
                      <div className="relative inline-block">
                        <img src={logoPreview} alt="Logo" className="h-24 w-24 rounded-xl border object-cover" />
                        <button type="button" onClick={() => removeFile(setLogoFile, setLogoPreview)} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input transition-all hover:border-primary/50 hover:bg-accent/50">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Upload</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0] || null, setLogoFile, setLogoPreview)} />
                      </label>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Banner</Label>
                    {bannerPreview ? (
                      <div className="relative">
                        <img src={bannerPreview} alt="Banner" className="h-24 w-full rounded-xl border object-cover" />
                        <button type="button" onClick={() => removeFile(setBannerFile, setBannerPreview)} className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input transition-all hover:border-primary/50 hover:bg-accent/50">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Upload banner</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0] || null, setBannerFile, setBannerPreview)} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Mobile Hero */}
                <div className="space-y-2">
                  <Label>Mobile Hero Banner <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                  {heroPreview ? (
                    <div className="relative">
                      <img src={heroPreview} alt="Mobile Hero" className="w-full rounded-xl border object-contain max-h-48" />
                      <button type="button" onClick={() => removeFile(setHeroFile, setHeroPreview)} className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-input transition-all hover:border-primary/50 hover:bg-accent/50">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Upload mobile hero image</span>
                      <span className="text-[10px] text-muted-foreground/70">You can skip this</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0] || null, setHeroFile, setHeroPreview)} />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Location */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-foreground">Location Details</h2>
                  <p className="text-sm text-muted-foreground">Help customers find you</p>
                </div>

                <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-center">
                  <p className="text-xs text-muted-foreground">📍 All fields here are optional — you can skip ahead!</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" placeholder="Mumbai" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State / Region</Label>
                    <Input id="state" placeholder="Maharashtra" value={state} onChange={(e) => setState(e.target.value)} maxLength={100} className="h-11" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Full Address</Label>
                  <Textarea id="address" placeholder="123 Main Street, Building A, Floor 2..." value={location} onChange={(e) => setLocation(e.target.value)} maxLength={500} rows={3} />
                  <p className="text-xs text-muted-foreground">This will be shown on your storefront</p>
                </div>

                <div className="rounded-xl border bg-accent/30 p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Why add a location?</p>
                      <p className="text-xs text-muted-foreground">Stores with a location get more trust from customers and appear more professional.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Contact */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-foreground">Contact Details</h2>
                  <p className="text-sm text-muted-foreground">How customers can reach you</p>
                </div>

                <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-center">
                  <p className="text-xs text-muted-foreground">📞 Only email is required — WhatsApp is optional unless you chose WhatsApp orders</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp Number {(orderMode === "whatsapp" || orderMode === "both") ? "*" : "(optional)"}</Label>
                  <div className="flex items-center gap-0 rounded-md border border-input bg-muted/50">
                    <span className="flex-shrink-0 px-3 text-muted-foreground"><Phone className="h-4 w-4" /></span>
                    <Input id="whatsapp" placeholder="+91 98765 43210" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} maxLength={20} className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(orderMode === "whatsapp" || orderMode === "both")
                      ? "Customers will use this to place orders via WhatsApp"
                      : "Optional — for customer support"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner-email">Your Email *</Label>
                  <div className="flex items-center gap-0 rounded-md border border-input bg-muted/50">
                    <span className="flex-shrink-0 px-3 text-muted-foreground"><Globe className="h-4 w-4" /></span>
                    <Input id="owner-email" type="email" placeholder="you@example.com" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} maxLength={200} className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0" />
                  </div>
                  <p className="text-xs text-muted-foreground">You'll receive order notification emails at this address</p>
                </div>

                <div className="rounded-xl border bg-accent/30 p-4">
                  <div className="flex items-start gap-3">
                    {(orderMode === "whatsapp" || orderMode === "both") ? (
                      <Phone className="mt-0.5 h-5 w-5 text-primary" />
                    ) : (
                      <Globe className="mt-0.5 h-5 w-5 text-primary" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {orderMode === "both" ? "Dual ordering mode" : orderMode === "whatsapp" ? "WhatsApp ordering" : "Website ordering"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {orderMode === "both"
                          ? "Customers can choose to checkout on your website or order via WhatsApp — best of both worlds!"
                          : orderMode === "whatsapp"
                          ? 'When customers click "Order on WhatsApp", a pre-filled message with product details will open in WhatsApp.'
                          : 'Customers will see a "Buy Now" button and checkout directly on your website.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Social Media */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-foreground">Social Media</h2>
                  <p className="text-sm text-muted-foreground">Connect your social accounts</p>
                </div>

                <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-center">
                  <p className="text-xs text-muted-foreground">🔗 Both are optional — you can add them later from Settings</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <div className="flex items-center gap-0 rounded-md border border-input bg-muted/50">
                    <span className="flex-shrink-0 px-3 text-muted-foreground"><Instagram className="h-4 w-4" /></span>
                    <Input id="instagram" placeholder="https://instagram.com/yourstore" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} maxLength={200} className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook</Label>
                  <div className="flex items-center gap-0 rounded-md border border-input bg-muted/50">
                    <span className="flex-shrink-0 px-3 text-muted-foreground"><Facebook className="h-4 w-4" /></span>
                    <Input id="facebook" placeholder="https://facebook.com/yourstore" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} maxLength={200} className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0" />
                  </div>
                </div>

                <div className="rounded-xl border bg-accent/30 p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">You're all set! 🎉</p>
                      <p className="text-xs text-muted-foreground">Click "Create Store" to launch your store. You can always update everything later.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={goBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <Button type="button" onClick={goNext} className="gap-2 px-6">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="gap-2 px-8 relative overflow-hidden group"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <span className="relative flex items-center gap-2">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4 group-hover:animate-bounce" />
                  )}
                  Launch My Store 🚀
                </span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step counter */}
      <p className="text-center text-xs text-muted-foreground">
        Step {step} of {STEPS.length}
      </p>
    </div>
  );
}
