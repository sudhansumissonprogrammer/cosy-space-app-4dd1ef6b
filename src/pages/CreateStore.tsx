import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
import {
  Loader2, Upload, X, ArrowRight, MapPin, Phone,
  Instagram, Facebook, Check, Sparkles, Globe,
  Rocket, Crown, ShoppingBag, CreditCard, ExternalLink, Copy,
} from "lucide-react";
import { processImage, getCompressionMessage } from "@/lib/imageCompression";
import { uploadOptimizedImage, uploadStoreLogo, generateUploadPath } from "@/lib/uploadOptimizedImage";

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


// Commission-only stores use website checkout so platform commission,
// abandoned-cart recovery, order confirmations and wallet invoices stay linked.

export default function CreateStore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [checkingStore, setCheckingStore] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showExistingStoreDialog, setShowExistingStoreDialog] = useState(false);
  const [existingStoreSlug, setExistingStoreSlug] = useState<string | null>(null);
  const [creatingAnimation, setCreatingAnimation] = useState(false);
  const [storeCreated, setStoreCreated] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string>("");



  const [editContact, setEditContact] = useState(false);
  // v2 onboarding: one screen. Everything beyond the store name lives behind
  // this optional panel so a merchant can launch in ~10 seconds.
  const [showMore, setShowMore] = useState(false);


  useEffect(() => {
    if (!user) return;
    supabase
      .from("stores")
      .select("id, slug")
      .eq("owner_id", user.id)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
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
  const orderMode: "website" = "website";
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
  const [ownerName, setOwnerName] = useState("");

  // Step 3
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [partnerCode, setPartnerCode] = useState("");

  // Reuse the name / email / mobile already collected at signup —
  // never ask the merchant for the same details twice.
  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata || {}) as { full_name?: string; phone?: string };
    if (user.email) setOwnerEmail((v) => v || user.email!);
    if (meta.full_name) setOwnerName((v) => v || meta.full_name!);
    if (meta.phone) setWhatsappNumber((v) => v || `+91 ${meta.phone}`);

    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.full_name) setOwnerName((v) => v || data.full_name!);
        if (data.phone) setWhatsappNumber((v) => v || `+91 ${data.phone}`);
      });
  }, [user]);


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


  const handleSubmit = async () => {
    if (!user) return;
    setCreatingAnimation(true);
    setLoading(true);

    try {
      let logoUrl: string | null = null;
      let bannerUrl: string | null = null;
      let mobileHeroUrl: string | null = null;

      if (logoFile) {
        logoUrl = await uploadStoreLogo(logoFile, generateUploadPath(user.id, "new-store"));
      }
      if (bannerFile) {
        const ext = bannerFile.name.split(".").pop();
        bannerUrl = await uploadFile(bannerFile, "store-banners", `${user.id}/${slug}-banner.${ext}`);
      }
      if (heroFile) {
        const ext = heroFile.name.split(".").pop();
        mobileHeroUrl = await uploadFile(heroFile, "store-banners", `${user.id}/${slug}-mobile-hero.${ext}`);
      }

      const storeName = name.trim();
      // Slug clashes used to dead-end the merchant with an error. Now we retry
      // automatically with -1, -2, -3 so onboarding never stalls.
      let finalSlug = slug.trim();
      let attempt = 0;
      let newStore: any = null;
      let error: any = null;
      while (attempt < 4) {
        const res = await (supabase as any).from("stores").insert({
        owner_id: user.id,
        name: storeName,
        slug: finalSlug,
        description: description.trim() || null,
        whatsapp_number: whatsappNumber.trim() || null,
        currency,
        order_mode: "website",
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
        owner_name: ownerName.trim() || null,
        meta_title: `${storeName} — Shop Online`,
        meta_description: `Discover products at ${storeName}. Order online today.`,
        }).select("id").single();
        newStore = res.data;
        error = res.error;
        if (!error || error.code !== "23505") break;
        attempt += 1;
        finalSlug = `${slug.trim()}-${attempt}`;
      }

      if (error) {
        setCreatingAnimation(false);
        toast.error(
          error.code === "23505"
            ? "That store address is taken — try a slightly different store name."
            : error.message,
        );
        return;
      }

      if (newStore?.id) {


        // Create default theme config
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

        // Fast static content (replaces slow AI generation to speed up store creation)
        try {
          const storeName = name.trim();
          const shortDesc = description.trim();
          const founder = ownerName.trim();

          const aboutUs = `About ${storeName}\n\n${founder ? `Founded by ${founder}\n\n` : ""}Welcome to ${storeName}! 🛍️${founder ? ` Founded by ${founder}, our` : "\n\nOur"} mission is to bring you carefully curated products with quality you can trust. Every item in our collection is hand-picked to ensure it meets our high standards.\n\nWe keep shopping easy, affordable, and delightful for every customer — from fast delivery to friendly support, we are here for you at every step.\n\nThank you for choosing ${storeName}. We can't wait to serve you! ❤️`;

          const metaTitle = `${storeName} — Shop Online`.substring(0, 60);
          const metaDescription = (shortDesc
            ? `${storeName}: ${shortDesc}`
            : `Shop the best products at ${storeName}. Quality items, fast delivery, and great prices. Order now!`
          ).substring(0, 150);

          const updatePayload: Record<string, string> = {
            meta_title: metaTitle,
            meta_description: metaDescription,
            about_us_text: aboutUs,
          };
          if (!shortDesc) {
            updatePayload.description = `Discover quality products at ${storeName}. Shop now for the best deals!`;
          }

          await (supabase as any)
            .from("stores")
            .update(updatePayload)
            .eq("id", newStore.id);

          await (supabase as any).from("store_pages").insert({
            store_id: newStore.id,
            title: "About Us",
            slug: "about-us",
            page_type: "about",
            content: aboutUs,
            is_active: true,
            display_order: 0,
          }).then(({ error: pageErr }: any) => {
            if (pageErr) console.warn("About page insert failed:", pageErr.message);
          });
        } catch (contentError) {
          console.warn("Static content generation failed (non-blocking):", contentError);
        }

        // Seed 3 demo categories + 4 demo products
        try {
          const STORAGE_BASE = "https://cdn.shopbanao.in/product-images/demo";
          const DEMO_IMGS = [
            `${STORAGE_BASE}/product-1.jpg`,
            `${STORAGE_BASE}/product-2.jpg`,
            `${STORAGE_BASE}/product-3.jpg`,
            `${STORAGE_BASE}/product-4.jpg`,
          ];
          const CAT_IMGS = [
            `${STORAGE_BASE}/category-fashion.jpg`,
            `${STORAGE_BASE}/category-electronics.jpg`,
            `${STORAGE_BASE}/category-accessories.jpg`,
          ];
          const demoCategories = [
            { name: "Fashion", slug: "fashion", image_url: CAT_IMGS[0], display_order: 0 },
            { name: "Electronics", slug: "electronics", image_url: CAT_IMGS[1], display_order: 1 },
            { name: "Accessories", slug: "accessories", image_url: CAT_IMGS[2], display_order: 2 },
          ];
          await (supabase as any).from("categories").insert(
            demoCategories.map((c) => ({ ...c, store_id: newStore.id }))
          );

          const demoProducts = [
            { name: "Demo T-Shirt", slug: "demo-tshirt", price: 499, category: "Fashion", description: "This is a demo product. Go to your admin dashboard and add your own products!", image_url: DEMO_IMGS[0], display_order: 0 },
            { name: "Demo Earbuds", slug: "demo-earbuds", price: 799, category: "Electronics", description: "This is a demo product. Go to your admin dashboard and add your own products!", image_url: DEMO_IMGS[1], display_order: 1 },
            { name: "Demo Leather Bag", slug: "demo-leather-bag", price: 999, category: "Accessories", description: "This is a demo product. Go to your admin dashboard and add your own products!", image_url: DEMO_IMGS[2], display_order: 2 },
            { name: "Demo Watch", slug: "demo-watch", price: 1299, category: "Accessories", description: "This is a demo product. Go to your admin dashboard and add your own products!", image_url: DEMO_IMGS[3], display_order: 3 },
          ];
          await (supabase as any).from("products").insert(
            demoProducts.map((p) => ({ ...p, store_id: newStore.id, currency, is_active: true }))
          );
        } catch (demoErr) {
          console.warn("Demo seed failed (non-blocking):", demoErr);
        }
      }

      // Prewarm store cache (blocking) — ensures Cloudflare Worker slug index
      // is updated before the user could visit their subdomain
      try {
        const { prewarmStore } = await import("@/lib/prewarmStore");
        await prewarmStore(slug.trim());
      } catch {
        // Non-critical — store still works, just first visit may be slower
      }

      // Attach partner referral code if user entered one (non-blocking)
      const code = partnerCode.trim().toUpperCase();
      if (code) {
        if (!/^SBP\d{2,}$/.test(code)) {
          toast.error("Partner code should look like SBP1234 — skipped");
        } else {
          try {
            const { data: refData, error: refError } = await supabase.functions.invoke(
              "attach-referral",
              { body: { ref: code } }
            );
            const payload = refData as { ok?: boolean; reason?: string; error?: string } | null;
            if (refError) {
              toast.error("Couldn't apply partner code (you can add it later in Settings)");
            } else if (!payload?.ok) {
              const reasons: Record<string, string> = {
                partner_inactive: "This partner code is not active.",
                self_referral: "You can't use your own partner code.",
                already_attached: "You're already linked to another partner.",
                invalid_code: "Invalid partner code.",
              };
              toast.error(reasons[payload?.reason || ""] || "Couldn't apply partner code");
            } else {
              toast.success("Partner code applied! 🎉");
            }
          } catch {
            toast.error("Couldn't apply partner code (you can add it later in Settings)");
          }
        }
      }


      setCreatingAnimation(false);
      setStoreCreated(true);
      setCreatedSlug(finalSlug);
      setShowConfetti(true);
      toast.success("Store created successfully! 🎉");
      queryClient.invalidateQueries({ queryKey: ["my-store"] });
      queryClient.invalidateQueries({ queryKey: ["my-store-plan"] });
      queryClient.invalidateQueries({ queryKey: ["product-limit"] });
    } catch (err: any) {
      setCreatingAnimation(false);
      toast.error(err.message || "Failed to create store");
    } finally {
      setLoading(false);
    }
  };


  if (checkingStore) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Full-screen success screen — store is live!
  if (storeCreated) {
    const storeUrl = `https://${createdSlug}.shopbanao.in`;
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-4">
        {/* Confetti */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: `${6 + Math.random() * 8}px`,
                  height: `${6 + Math.random() * 8}px`,
                  backgroundColor: ['hsl(var(--primary))', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899'][i % 5],
                  left: `${5 + Math.random() * 90}%`,
                  top: `${5 + Math.random() * 90}%`,
                  animation: `confetti-fall ${1 + Math.random() * 2}s ease-out forwards`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  opacity: 0.8,
                }}
              />
            ))}
          </div>
        )}

        <div className="relative flex items-center justify-center mb-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-green-500/10">
            <Check className="h-12 w-12 text-green-500" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
          Your Store is Live! 🎉
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
          <span className="font-semibold text-primary">{name || createdSlug}</span> is now live and ready for customers.
        </p>

        {/* Store URL Card */}
        <div className="mt-6 w-full max-w-md rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Your store URL</p>
              <p className="text-sm font-semibold text-foreground truncate">{storeUrl}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild className="flex-1 gap-2" size="lg">
              <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Visit Your Store
              </a>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1 gap-2"
              onClick={() => {
                navigator.clipboard.writeText(storeUrl);
                toast.success("Link copied!");
              }}
            >
              <Copy className="h-4 w-4" />
              Copy Link
            </Button>
          </div>
        </div>

        {/* Go to Dashboard */}
        <Button
          variant="ghost"
          className="mt-6 gap-2 text-muted-foreground"
          onClick={() => navigate("/dashboard", { replace: true })}
        >
          <ArrowRight className="h-4 w-4" />
          Go to Dashboard
        </Button>

        <p className="mt-4 text-xs text-muted-foreground/60 text-center max-w-sm">
          You can manage products, orders, and customize your store from the dashboard.
        </p>
      </div>
    );
  }

  // Full-screen creating animation overlay
  if (creatingAnimation) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-32 w-32 rounded-full border-2 border-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
          <div className="absolute h-24 w-24 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: "1.5s", animationDelay: "0.3s" }} />
          <div className="absolute h-16 w-16 rounded-full border-2 border-primary/40 animate-ping" style={{ animationDuration: "1s", animationDelay: "0.6s" }} />
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
            <Rocket className="h-10 w-10 text-primary-foreground animate-bounce" />
          </div>
        </div>

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
              className="h-full rounded-full bg-primary transition-[transform,opacity,colors,box-shadow] duration-1000"
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
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Create your store</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Just your store name — everything else can wait. Takes about 10 seconds.
        </p>
      </div>

      <Card className="overflow-hidden border-0 shadow-lg">
        <CardContent className="space-y-5 p-5 sm:p-8">
          {/* The only required field */}
          <div className="space-y-2">
            <Label htmlFor="store-name">Store name</Label>
            <Input
              id="store-name"
              autoFocus
              placeholder="e.g. Utkal Watches"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              maxLength={100}
              className="h-14 text-lg font-medium"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleSubmit();
              }}
            />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5 text-primary" />
              <span className="truncate">
                {slug ? `${slug}.shopbanao.in` : "yourstore.shopbanao.in"}
              </span>
            </div>
          </div>

          {/* Logo — optional, inline */}
          <div className="flex items-center gap-3 rounded-xl border bg-accent/20 p-3">
            {logoPreview ? (
              <div className="relative">
                <img src={logoPreview} alt="Logo" className="h-14 w-14 rounded-xl border object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(setLogoFile, setLogoPreview)}
                  className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-input hover:border-primary/50">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null, setLogoFile, setLogoPreview)}
                />
              </label>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Add your logo</p>
              <p className="text-xs text-muted-foreground">Optional — we'll show your store name until you add one.</p>
            </div>
          </div>

          {/* Launch */}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            size="lg"
            className="h-14 w-full gap-2 text-base"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
            Launch my store
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Website checkout, COD, WhatsApp orders and analytics are switched on automatically.
          </p>

          {/* Contact — reused from signup, never asked twice */}
          <div className="rounded-xl border bg-accent/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">Support contact</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[ownerName.trim(), ownerEmail.trim(), whatsappNumber.trim()].filter(Boolean).join(" · ") || "From your account"}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditContact((v) => !v)}>
                {editContact ? "Done" : "Change"}
              </Button>
            </div>

            {editContact && (
              <div className="mt-3 space-y-3 border-t pt-3">
                <div className="flex items-center rounded-md border border-input bg-background">
                  <span className="px-3 text-muted-foreground"><Crown className="h-4 w-4" /></span>
                  <Input aria-label="Owner name" placeholder="Owner name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={80} className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0" />
                </div>
                <div className="flex items-center rounded-md border border-input bg-background">
                  <span className="px-3 text-muted-foreground"><Phone className="h-4 w-4" /></span>
                  <Input aria-label="WhatsApp number" placeholder="+91 98765 43210" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} maxLength={20} className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0" />
                </div>
                <div className="flex items-center rounded-md border border-input bg-background">
                  <span className="px-3 text-muted-foreground"><Globe className="h-4 w-4" /></span>
                  <Input aria-label="Support email" type="email" placeholder="you@example.com" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} maxLength={200} className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0" />
                </div>
              </div>
            )}
          </div>

          {/* Everything optional lives here */}
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-primary hover:bg-primary/5"
          >
            {showMore ? "Hide extra details" : "Add more details (optional)"}
            <ArrowRight className={`h-4 w-4 transition-transform ${showMore ? "rotate-90" : ""}`} />
          </button>

          {showMore && (
            <div className="space-y-5 border-t pt-5 animate-fade-in">
              <div className="space-y-2">
                <Label htmlFor="description">Short description</Label>
                <Textarea
                  id="description"
                  placeholder="What do you sell?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input hover:border-primary/50">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Upload banner</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0] || null, setBannerFile, setBannerPreview)} />
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <Label>Mobile hero banner</Label>
                {heroPreview ? (
                  <div className="relative">
                    <img src={heroPreview} alt="Mobile hero" className="max-h-48 w-full rounded-xl border object-contain" />
                    <button type="button" onClick={() => removeFile(setHeroFile, setHeroPreview)} className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input hover:border-primary/50">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Upload mobile hero</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0] || null, setHeroFile, setHeroPreview)} />
                  </label>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="Mumbai" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State / region</Label>
                  <Input id="state" placeholder="Maharashtra" value={state} onChange={(e) => setState(e.target.value)} maxLength={100} className="h-11" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> Full address
                </Label>
                <Textarea id="address" placeholder="123 Main Street, Building A..." value={location} onChange={(e) => setLocation(e.target.value)} maxLength={500} rows={2} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <div className="flex items-center rounded-md border border-input bg-muted/50">
                  <span className="px-3 text-muted-foreground"><Instagram className="h-4 w-4" /></span>
                  <Input id="instagram" placeholder="https://instagram.com/yourstore" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} maxLength={200} className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="facebook">Facebook</Label>
                <div className="flex items-center rounded-md border border-input bg-muted/50">
                  <span className="px-3 text-muted-foreground"><Facebook className="h-4 w-4" /></span>
                  <Input id="facebook" placeholder="https://facebook.com/yourstore" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} maxLength={200} className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="partnerCode">Partner referral code</Label>
                <div className="flex items-center rounded-md border border-input bg-muted/50">
                  <span className="px-3 font-mono text-xs text-muted-foreground">SBP</span>
                  <Input
                    id="partnerCode"
                    placeholder="e.g. SBP1023"
                    value={partnerCode}
                    onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                    maxLength={20}
                    className="h-11 border-0 bg-transparent uppercase shadow-none focus-visible:ring-0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Signed up through a partner link? Leave this blank — it's already tracked.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        You can change every one of these later in Settings.
      </p>

    </div>
  );
}
