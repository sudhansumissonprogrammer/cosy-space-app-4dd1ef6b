import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, X, ArrowLeft, Globe, Palette, Lock, Check, Plus, Trash2, Flame } from "lucide-react";
import { compressImage, getCompressionMessage } from "@/lib/imageCompression";
import { Switch } from "@/components/ui/switch";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ICON_OPTIONS = [
  { value: "Award", label: "Award" },
  { value: "Leaf", label: "Leaf" },
  { value: "Shield", label: "Shield" },
  { value: "Star", label: "Star" },
  { value: "Sparkles", label: "Sparkles" },
  { value: "Heart", label: "Heart" },
  { value: "Truck", label: "Truck" },
  { value: "ThumbsUp", label: "ThumbsUp" },
];

interface Feature {
  icon: string;
  title: string;
  description: string;
}

const THEMES = [
  { id: "theme-1", name: "Classic", desc: "Clean & modern storefront", available: true },
  { id: "theme-2", name: "Bold", desc: "Eye-catching vibrant design", available: false },
  { id: "theme-3", name: "Minimal", desc: "Simple & elegant layout", available: false },
  { id: "theme-4", name: "Starter", desc: "Starter template with cool UI", available: false },
];

export default function StoreSettings() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [businessHours, setBusinessHours] = useState<Record<string, string>>({
    mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerRemoved, setBannerRemoved] = useState(false);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [heroRemoved, setHeroRemoved] = useState(false);
  const [theme, setTheme] = useState("theme-1");
  const [features, setFeatures] = useState<Feature[]>([]);
  const [returnPolicy, setReturnPolicy] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState("");
  const [bestSellingCarousel, setBestSellingCarousel] = useState(false);
  const [facebookPixelId, setFacebookPixelId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [ogImageFile, setOgImageFile] = useState<File | null>(null);
  const [ogImagePreview, setOgImagePreview] = useState<string | null>(null);
  const [ogImageRemoved, setOgImageRemoved] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const { data: store, isLoading } = useQuery({
    queryKey: ["store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("id", storeId!)
        .eq("owner_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId && !!user,
  });

  useEffect(() => {
    if (store) {
      setName(store.name);
      setDescription(store.description || "");
      setWhatsappNumber(store.whatsapp_number || "");
      setLocation((store as any).location || "");
      setCity((store as any).city || "");
      setStateName((store as any).state || "");
      setCurrency((store as any).currency || "USD");
      setInstagramUrl((store as any).instagram_url || "");
      setFacebookUrl((store as any).facebook_url || "");
      if ((store as any).business_hours) {
        setBusinessHours({ mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "", ...(store as any).business_hours });
      }
      if (store.logo_url) setLogoPreview(store.logo_url);
      if (store.banner_url) setBannerPreview(store.banner_url);
      if ((store as any).mobile_hero_url) setHeroPreview((store as any).mobile_hero_url);
      setTheme((store as any).theme || "theme-1");
      if (store.features) setFeatures(store.features as unknown as Feature[]);
      setReturnPolicy((store as any).return_policy || "");
      setShippingPolicy((store as any).shipping_policy || "");
      setBestSellingCarousel((store as any).best_selling_carousel || false);
      setFacebookPixelId((store as any).facebook_pixel_id || "");
      setMetaAccessToken((store as any).meta_access_token || "");
      setMetaTitle((store as any).meta_title || "");
      setMetaDescription((store as any).meta_description || "");
      setOgImageUrl((store as any).og_image_url || "");
      if ((store as any).og_image_url) setOgImagePreview((store as any).og_image_url);
      setOwnerEmail((store as any).owner_email || "");
    }
  }, [store]);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const uploadFile = async (file: File, bucket: string) => {
    if (file.size > MAX_FILE_SIZE) throw new Error("File must be less than 5MB");
    const result = await compressImage(file);
    const msg = getCompressionMessage(result);
    if (msg) toast.success(msg);
    const ext = result.file.name.split(".").pop();
    const path = `${user!.id}/${storeId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, result.file, { cacheControl: "3600", upsert: true });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      let logoUrl = store?.logo_url || null;
      let bannerUrl = store?.banner_url || null;
      let mobileHeroUrl = (store as any)?.mobile_hero_url || null;

      if (logoRemoved) logoUrl = null;
      if (bannerRemoved) bannerUrl = null;
      if (heroRemoved) mobileHeroUrl = null;

      if (logoFile) logoUrl = await uploadFile(logoFile, "store-logos");
      if (bannerFile) bannerUrl = await uploadFile(bannerFile, "store-banners");
      if (heroFile) mobileHeroUrl = await uploadFile(heroFile, "store-banners");

      // Handle OG image upload
      let finalOgImageUrl = ogImageUrl;
      if (ogImageRemoved) finalOgImageUrl = "";
      if (ogImageFile) {
        finalOgImageUrl = await uploadFile(ogImageFile, "store-banners");
      }

      const hasHours = Object.values(businessHours).some((v) => v.trim());
      const { error } = await (supabase as any)
        .from("stores")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          whatsapp_number: whatsappNumber.trim() || null,
          location: location.trim() || null,
          city: city.trim() || null,
          state: stateName.trim() || null,
          currency,
          instagram_url: instagramUrl.trim() || null,
          facebook_url: facebookUrl.trim() || null,
          business_hours: hasHours ? businessHours : null,
          logo_url: logoUrl,
          banner_url: bannerUrl,
          mobile_hero_url: mobileHeroUrl,
          theme,
          features: features.length > 0 ? features : null,
          return_policy: returnPolicy.trim() || null,
          shipping_policy: shippingPolicy.trim() || null,
          best_selling_carousel: bestSellingCarousel,
          facebook_pixel_id: facebookPixelId.trim() || null,
          meta_title: metaTitle.trim() || null,
          meta_description: metaDescription.trim() || null,
          og_image_url: finalOgImageUrl.trim() || null,
          owner_email: ownerEmail.trim() || null,
        })
        .eq("id", storeId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      toast.success("Store settings updated!");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/stores">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Store Settings</h1>
          <p className="text-sm text-muted-foreground">{store?.name}</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">General</CardTitle>
            <CardDescription>Update your store details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="store-name">Store Name *</Label>
              <Input id="store-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-desc">Description</Label>
              <Textarea
                id="store-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </div>




            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp Number</Label>
              <Input
                id="whatsapp"
                placeholder="+1234567890"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner-email">Notification Email</Label>
              <Input
                id="owner-email"
                type="email"
                placeholder="you@example.com"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">Order notification emails will be sent to this address</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" placeholder="Mumbai" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State / Region</Label>
                <Input id="state" placeholder="Maharashtra" value={stateName} onChange={(e) => setStateName(e.target.value)} maxLength={100} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">₹ INR – Indian Rupee</SelectItem>
                  <SelectItem value="USD">$ USD – US Dollar</SelectItem>
                  <SelectItem value="EUR">€ EUR – Euro</SelectItem>
                  <SelectItem value="GBP">£ GBP – British Pound</SelectItem>
                  <SelectItem value="AED">د.إ AED – UAE Dirham</SelectItem>
                  <SelectItem value="SAR">﷼ SAR – Saudi Riyal</SelectItem>
                  <SelectItem value="BDT">৳ BDT – Bangladeshi Taka</SelectItem>
                  <SelectItem value="PKR">₨ PKR – Pakistani Rupee</SelectItem>
                  <SelectItem value="LKR">₨ LKR – Sri Lankan Rupee</SelectItem>
                  <SelectItem value="NPR">₨ NPR – Nepalese Rupee</SelectItem>
                  <SelectItem value="CAD">$ CAD – Canadian Dollar</SelectItem>
                  <SelectItem value="AUD">$ AUD – Australian Dollar</SelectItem>
                  <SelectItem value="SGD">$ SGD – Singapore Dollar</SelectItem>
                  <SelectItem value="MYR">RM MYR – Malaysian Ringgit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Full Address</Label>
              <Input id="location" placeholder="123 Main St, City" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={500} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram URL</Label>
                <Input id="instagram" placeholder="https://instagram.com/store" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook">Facebook URL</Label>
                <Input id="facebook" placeholder="https://facebook.com/store" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} maxLength={200} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Business Hours</Label>
              <div className="grid gap-2">
                {Object.entries(businessHours).map(([day, hours]) => (
                  <div key={day} className="flex items-center gap-2">
                    <span className="w-10 text-sm font-medium capitalize text-muted-foreground">{day}</span>
                    <Input
                      placeholder="9:00-18:00 or Closed"
                      value={hours}
                      onChange={(e) => setBusinessHours((prev) => ({ ...prev, [day]: e.target.value }))}
                      maxLength={50}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Logo</Label>
                {logoPreview ? (
                  <div className="relative inline-block">
                    <img src={logoPreview} alt="Logo" className="h-20 w-20 rounded-lg border object-cover" />
                    <button
                      type="button"
                      onClick={() => { setLogoFile(null); setLogoPreview(null); setLogoRemoved(true); }}
                      className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input hover:border-primary/50">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); setLogoRemoved(false); }
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <Label>Banner</Label>
                {bannerPreview ? (
                  <div className="relative inline-block">
                    <img src={bannerPreview} alt="Banner" className="h-20 w-40 rounded-lg border object-cover" />
                    <button
                      type="button"
                      onClick={() => { setBannerFile(null); setBannerPreview(null); setBannerRemoved(true); }}
                      className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-20 w-40 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input hover:border-primary/50">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) { setBannerFile(f); setBannerPreview(URL.createObjectURL(f)); setBannerRemoved(false); }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mobile Hero Banner <span className="text-xs text-muted-foreground font-normal">(shown only on mobile)</span></Label>
              {heroPreview ? (
                <div className="relative inline-block">
                  <img src={heroPreview} alt="Mobile Hero" className="w-full max-h-32 rounded-lg border object-contain" />
                  <button
                    type="button"
                    onClick={() => { setHeroFile(null); setHeroPreview(null); setHeroRemoved(true); }}
                    className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input hover:border-primary/50">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Upload mobile hero</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setHeroFile(f); setHeroPreview(URL.createObjectURL(f)); setHeroRemoved(false); }
                    }}
                  />
                </label>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tracking & Analytics</CardTitle>
            <CardDescription>Connect your Facebook Pixel for Meta Ads tracking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fb-pixel">Facebook Pixel ID</Label>
              <Input
                id="fb-pixel"
                placeholder="e.g. 123456789012345"
                value={facebookPixelId}
                onChange={(e) => setFacebookPixelId(e.target.value)}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Enter your Facebook Pixel ID to track PageView, ViewContent, AddToCart, InitiateCheckout and Purchase events automatically.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Why Choose Us</CardTitle>
            <CardDescription>Manage selling points shown on your Contact page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {features.map((feature, idx) => (
              <div key={idx} className="flex gap-2 items-start rounded-lg border p-3">
                <div className="flex-1 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Select
                      value={feature.icon}
                      onValueChange={(v) => {
                        const updated = [...features];
                        updated[idx] = { ...updated[idx], icon: v };
                        setFeatures(updated);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Icon" /></SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Title"
                      value={feature.title}
                      onChange={(e) => {
                        const updated = [...features];
                        updated[idx] = { ...updated[idx], title: e.target.value };
                        setFeatures(updated);
                      }}
                      className="sm:col-span-2"
                      maxLength={50}
                    />
                  </div>
                  <Input
                    placeholder="Description"
                    value={feature.description}
                    onChange={(e) => {
                      const updated = [...features];
                      updated[idx] = { ...updated[idx], description: e.target.value };
                      setFeatures(updated);
                    }}
                    maxLength={100}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setFeatures(features.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {features.length < 6 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFeatures([...features, { icon: "Award", title: "", description: "" }])}
              >
                <Plus className="mr-1 h-4 w-4" /> Add Feature
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Policies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Store Policies</CardTitle>
            <CardDescription>Customize your return and shipping policies. Leave blank to use default templates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="return-policy">Return Policy</Label>
              <Textarea
                id="return-policy"
                value={returnPolicy}
                onChange={(e) => setReturnPolicy(e.target.value)}
                rows={6}
                placeholder="Leave blank for a default return policy template..."
                maxLength={5000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping-policy">Shipping Policy</Label>
              <Textarea
                id="shipping-policy"
                value={shippingPolicy}
                onChange={(e) => setShippingPolicy(e.target.value)}
                rows={6}
                placeholder="Leave blank for a default shipping policy template..."
                maxLength={5000}
              />
            </div>
          </CardContent>
        </Card>

        {/* Domain Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Custom Domain</CardTitle>
            <CardDescription>Connect your own domain to this store</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {store?.custom_domain ? (
                  <span>Connected: <strong className="text-foreground">{store.custom_domain}</strong></span>
                ) : (
                  "No custom domain configured"
                )}
              </div>
              <Button variant="outline" asChild>
                <Link to={`/dashboard/stores/${storeId}/domain`}>
                  <Globe className="mr-2 h-4 w-4" /> Configure Domain
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Best Selling Display */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" /> Best Selling Display
            </CardTitle>
            <CardDescription>Choose how best-selling products appear on your storefront</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Carousel Mode</p>
                <p className="text-xs text-muted-foreground">Show best-selling products in a swipeable carousel instead of a grid</p>
              </div>
              <Switch
                checked={bestSellingCarousel}
                onCheckedChange={setBestSellingCarousel}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Theme</CardTitle>
            <CardDescription>Choose your storefront look</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={!t.available}
                  onClick={() => t.available && setTheme(t.id)}
                  className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
                    !t.available
                      ? "cursor-not-allowed border-input bg-muted/40 opacity-60"
                      : theme === t.id
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-input hover:border-primary/30"
                  }`}
                >
                  {!t.available && (
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <Lock className="h-2.5 w-2.5" /> Coming Soon
                    </span>
                  )}
                  {theme === t.id && t.available && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </span>
                  )}
                  <div className={`flex h-12 w-full items-center justify-center rounded-lg ${
                    t.available ? "bg-gradient-to-br from-primary/20 to-primary/5" : "bg-muted"
                  }`}>
                    <Palette className={`h-5 w-5 ${t.available ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* SEO Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> SEO Settings</CardTitle>
            <CardDescription>Optimize your store for search engines.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Meta Title</Label>
              <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="Your Store — Best Products Online" maxLength={60} />
              <p className="text-xs text-muted-foreground">{metaTitle.length}/60 characters</p>
            </div>
            <div className="space-y-2">
              <Label>Meta Description</Label>
              <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="Discover amazing products at great prices..." maxLength={160} rows={3} />
              <p className="text-xs text-muted-foreground">{metaDescription.length}/160 characters</p>
            </div>
            <div className="space-y-2">
              <Label>OG Image <span className="text-xs text-muted-foreground font-normal">(1200×630 recommended)</span></Label>
              {ogImagePreview ? (
                <div className="relative inline-block">
                  <img src={ogImagePreview} alt="OG Image" className="h-24 w-48 rounded-lg border object-cover" />
                  <button
                    type="button"
                    onClick={() => { setOgImageFile(null); setOgImagePreview(null); setOgImageUrl(""); setOgImageRemoved(true); }}
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-24 w-48 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input hover:border-primary/50">
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Upload image</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setOgImageFile(f); setOgImagePreview(URL.createObjectURL(f)); setOgImageRemoved(false); }
                    }}
                  />
                </label>
              )}
              <p className="text-xs text-muted-foreground">Or paste a URL:</p>
              <Input value={ogImageUrl} onChange={(e) => { setOgImageUrl(e.target.value); if (e.target.value) { setOgImagePreview(e.target.value); setOgImageFile(null); setOgImageRemoved(false); } }} placeholder="https://..." maxLength={500} />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </div>
  );
}
