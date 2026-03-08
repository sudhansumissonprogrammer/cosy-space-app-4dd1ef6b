import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2, Upload, X, ArrowRight, ArrowLeft, Store, MapPin, Phone,
  Instagram, Facebook, Check, Sparkles, Globe, MessageCircle, Palette, Lock,
} from "lucide-react";

const CURRENCIES = [
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "INR", label: "Indian Rupee (₹)" },
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
  { id: 1, title: "Store Info", icon: Store, desc: "Name & branding" },
  { id: 2, title: "Location", icon: MapPin, desc: "Where you are" },
  { id: 3, title: "Contact", icon: Phone, desc: "How to reach you" },
  { id: 4, title: "Social", icon: Instagram, desc: "Your presence" },
  { id: 5, title: "Theme", icon: Palette, desc: "Pick a look" },
];

const THEMES = [
  { id: "theme-1", name: "Classic", desc: "Clean & modern storefront", available: true },
  { id: "theme-2", name: "Bold", desc: "Eye-catching vibrant design", available: false },
  { id: "theme-3", name: "Minimal", desc: "Simple & elegant layout", available: false },
  { id: "theme-4", name: "Starter", desc: "Starter template with cool UI", available: false },
];

export default function CreateStore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [checkingStore, setCheckingStore] = useState(true);

  // Check if user already has a store
  useEffect(() => {
    if (!user) return;
    supabase
      .from("stores")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          toast.error("You already have a store. Only one store per account is allowed.");
          navigate("/dashboard/stores");
        } else {
          setCheckingStore(false);
        }
      });
  }, [user, navigate]);

  // Step 1 - Store Info
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [orderMode, setOrderMode] = useState<"whatsapp" | "website">("whatsapp");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // Step 2 - Location
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [location, setLocation] = useState("");

  // Step 3 - Contact
  const [whatsappNumber, setWhatsappNumber] = useState("");

  // Step 4 - Social
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");

  // Step 5 - Theme
  const [theme, setTheme] = useState("theme-1");

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

  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
  };

  const goNext = () => {
    if (step === 1 && (!name.trim() || !slug.trim())) {
      toast.error("Store name and slug are required");
      return;
    }
    setDirection("forward");
    setStep((s) => Math.min(s + 1, 5));
  };

  const goBack = () => {
    setDirection("back");
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let logoUrl: string | null = null;
      let bannerUrl: string | null = null;

      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        logoUrl = await uploadFile(logoFile, "store-logos", `${user.id}/${slug}-logo.${ext}`);
      }
      if (bannerFile) {
        const ext = bannerFile.name.split(".").pop();
        bannerUrl = await uploadFile(bannerFile, "store-banners", `${user.id}/${slug}-banner.${ext}`);
      }

      const { error } = await (supabase as any).from("stores").insert({
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
        theme,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("A store with this slug already exists");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Store created successfully!");
      navigate("/dashboard/stores");
    } catch (err: any) {
      toast.error(err.message || "Failed to create store");
    } finally {
      setLoading(false);
    }
  };

  const animClass =
    direction === "forward"
      ? "animate-fade-in"
      : "animate-fade-in";

  if (checkingStore) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Create Your Store</h1>
        <p className="mt-1 text-muted-foreground">Set up your storefront in just a few steps</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              type="button"
              onClick={() => { if (s.id < step) { setDirection("back"); setStep(s.id); } }}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300 ${
                step === s.id
                  ? "bg-primary text-primary-foreground shadow-md"
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
              <div className={`mx-1 h-px w-6 transition-colors duration-300 ${
                step > s.id ? "bg-primary" : "bg-border"
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardContent className="p-6 sm:p-8">
          <div key={step} className={animClass}>
            {/* Step 1: Store Info */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="mb-6">
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
                  <p className="text-xs text-muted-foreground">
                    Your store URL: <span className="font-medium text-foreground">/store/{slug}</span>
                  </p>
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

                {/* Order Mode */}
                <div className="space-y-2">
                  <Label>How do you want to take orders?</Label>
                  <RadioGroup value={orderMode} onValueChange={(v) => setOrderMode(v as "whatsapp" | "website")} className="grid gap-3 sm:grid-cols-2">
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all ${orderMode === "whatsapp" ? "border-primary bg-primary/5" : "border-input hover:border-primary/30"}`}>
                      <RadioGroupItem value="whatsapp" className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <MessageCircle className="h-4 w-4 text-green-600" /> Order via WhatsApp
                        </p>
                        <p className="text-xs text-muted-foreground">Take orders via WhatsApp messages</p>
                      </div>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all ${orderMode === "website" ? "border-primary bg-primary/5" : "border-input hover:border-primary/30"}`}>
                      <RadioGroupItem value="website" className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Globe className="h-4 w-4 text-blue-600" /> Order via Website
                        </p>
                        <p className="text-xs text-muted-foreground">Customers checkout on your site</p>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                {/* Logo + Banner side by side */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Logo</Label>
                    {logoPreview ? (
                      <div className="relative inline-block">
                        <img src={logoPreview} alt="Logo" className="h-24 w-24 rounded-xl border object-cover" />
                        <button
                          type="button"
                          onClick={() => removeFile(setLogoFile, setLogoPreview)}
                          className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input transition-all hover:border-primary/50 hover:bg-accent/50">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e.target.files?.[0] || null, setLogoFile, setLogoPreview)}
                        />
                      </label>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Banner</Label>
                    {bannerPreview ? (
                      <div className="relative">
                        <img src={bannerPreview} alt="Banner" className="h-24 w-full rounded-xl border object-cover" />
                        <button
                          type="button"
                          onClick={() => removeFile(setBannerFile, setBannerPreview)}
                          className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input transition-all hover:border-primary/50 hover:bg-accent/50">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Upload banner</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e.target.files?.[0] || null, setBannerFile, setBannerPreview)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Location */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-foreground">Location Details</h2>
                  <p className="text-sm text-muted-foreground">Help customers find you</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="Mumbai"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      maxLength={100}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State / Region</Label>
                    <Input
                      id="state"
                      placeholder="Maharashtra"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      maxLength={100}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Full Address</Label>
                  <Textarea
                    id="address"
                    placeholder="123 Main Street, Building A, Floor 2..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    maxLength={500}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">This will be shown on your storefront</p>
                </div>

                <div className="rounded-xl border bg-accent/30 p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Why add a location?</p>
                      <p className="text-xs text-muted-foreground">
                        Stores with a location get more trust from customers and appear more professional.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Contact */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-foreground">Contact Details</h2>
                  <p className="text-sm text-muted-foreground">How customers can reach you</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp Number {orderMode === "whatsapp" ? "*" : "(optional)"}</Label>
                  <div className="flex items-center gap-0 rounded-md border border-input bg-muted/50">
                    <span className="flex-shrink-0 px-3 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                    </span>
                    <Input
                      id="whatsapp"
                      placeholder="+91 98765 43210"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      maxLength={20}
                      className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {orderMode === "whatsapp"
                      ? "Customers will use this to place orders via WhatsApp"
                      : "Optional — for customer support"}
                  </p>
                </div>

                <div className="rounded-xl border bg-accent/30 p-4">
                  <div className="flex items-start gap-3">
                    {orderMode === "whatsapp" ? (
                      <Phone className="mt-0.5 h-5 w-5 text-primary" />
                    ) : (
                      <Globe className="mt-0.5 h-5 w-5 text-primary" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {orderMode === "whatsapp" ? "WhatsApp ordering" : "Website ordering"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {orderMode === "whatsapp"
                          ? "When customers click \"Order on WhatsApp\", a pre-filled message with product details will open in WhatsApp. Make sure to include your country code."
                          : "Customers will see a \"Buy Now\" button and checkout directly on your website with address and COD payment."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Social Media */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-foreground">Social Media</h2>
                  <p className="text-sm text-muted-foreground">Connect your social accounts</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <div className="flex items-center gap-0 rounded-md border border-input bg-muted/50">
                    <span className="flex-shrink-0 px-3 text-muted-foreground">
                      <Instagram className="h-4 w-4" />
                    </span>
                    <Input
                      id="instagram"
                      placeholder="https://instagram.com/yourstore"
                      value={instagramUrl}
                      onChange={(e) => setInstagramUrl(e.target.value)}
                      maxLength={200}
                      className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook</Label>
                  <div className="flex items-center gap-0 rounded-md border border-input bg-muted/50">
                    <span className="flex-shrink-0 px-3 text-muted-foreground">
                      <Facebook className="h-4 w-4" />
                    </span>
                    <Input
                      id="facebook"
                      placeholder="https://facebook.com/yourstore"
                      value={facebookUrl}
                      onChange={(e) => setFacebookUrl(e.target.value)}
                      maxLength={200}
                      className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-accent/30 p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Almost there!</p>
                      <p className="text-xs text-muted-foreground">
                        Social links help build trust and let customers follow your brand. You can always add these later.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
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
                className="gap-2 px-8"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Create Store
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
