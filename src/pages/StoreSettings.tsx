import { useState, useEffect, useRef } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreData } from "@/hooks/useStoreData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, X, ArrowLeft, Globe, Plus, Flame, Store, MapPin, Clock, Image, FileText, Search, Award, QrCode, Download } from "lucide-react";
import { processImage, getCompressionMessage } from "@/lib/imageCompression";
import { uploadOptimizedImage, generateUploadPath } from "@/lib/uploadOptimizedImage";
import { Switch } from "@/components/ui/switch";

import { Link, useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QRCodeSVG } from "qrcode.react";
import PushNotificationManager from "@/components/dashboard/PushNotificationManager";

/** Generate a URL-safe slug from a store name */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // remove special chars
    .replace(/\s+/g, "")          // remove all spaces (no hyphens, just concatenate)
    .replace(/-+/g, "-")          // collapse hyphens
    .replace(/^-|-$/g, "");       // trim hyphens
}




export default function StoreSettings() {
  const { storeId, storeSlug } = useStoreSlugParam();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [heroImageFiles, setHeroImageFiles] = useState<File[]>([]);
  const [bestSellingCarousel, setBestSellingCarousel] = useState(false);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [ogImageFile, setOgImageFile] = useState<File | null>(null);
  const [ogImagePreview, setOgImagePreview] = useState<string | null>(null);
  const [ogImageRemoved, setOgImageRemoved] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [defaultProfitMargin, setDefaultProfitMargin] = useState<number>(30);

  const { data: store, isLoading } = useStoreData(storeId);

  // Fetch owner_email via secure RPC (column revoked from direct SELECT)
  const { data: ownerEmailFromDb } = useQuery({
    queryKey: ["store-public-email", storeId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_store_public_email", { _store_id: storeId! });
      return (data as string) || "";
    },
    enabled: !!storeId,
  });

  useEffect(() => {
    if (ownerEmailFromDb !== undefined) {
      setOwnerEmail(ownerEmailFromDb);
    }
  }, [ownerEmailFromDb]);

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
      const existingHeroImages = (store as any).mobile_hero_images;
      if (existingHeroImages && Array.isArray(existingHeroImages) && existingHeroImages.length > 0) {
        setHeroImages(existingHeroImages);
      }
      setBestSellingCarousel((store as any).best_selling_carousel || false);
      setMetaTitle((store as any).meta_title || "");
      setMetaDescription((store as any).meta_description || "");
      setOgImageUrl((store as any).og_image_url || "");
      if ((store as any).og_image_url) setOgImagePreview((store as any).og_image_url);
      setDefaultProfitMargin((store as any).default_profit_margin ?? 30);
    }
  }, [store]);

  const MAX_FILE_SIZE = 6 * 1024 * 1024;

  const uploadFile = async (file: File, bucket: string) => {
    if (file.size > MAX_FILE_SIZE) throw new Error("File must be less than 6MB");
    const basePath = generateUploadPath(user!.id, storeId!);
    const result = await uploadOptimizedImage(file, bucket, basePath);
    if (result.compressionMessage) toast.success(result.compressionMessage);
    return result.mainUrl;
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

      let finalHeroImages = [...heroImages];
      for (const file of heroImageFiles) {
        const url = await uploadFile(file, "store-banners");
        finalHeroImages.push(url);
      }

      let finalOgImageUrl = ogImageUrl;
      if (ogImageRemoved) finalOgImageUrl = "";
      if (ogImageFile) {
        finalOgImageUrl = await uploadFile(ogImageFile, "store-banners");
      }




      const hasHours = Object.values(businessHours).some((v) => v.trim());
      const newSlug = generateSlug(name);
      if (!newSlug) throw new Error("Store name must contain at least one letter or number");

      const { error } = await (supabase as any)
        .from("stores")
        .update({
          name: name.trim(),
          slug: newSlug,
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
          mobile_hero_images: finalHeroImages.length > 0 ? finalHeroImages : null,
          best_selling_carousel: bestSellingCarousel,
          meta_title: metaTitle.trim() || null,
          meta_description: metaDescription.trim() || null,
          og_image_url: finalOgImageUrl.trim() || null,
          owner_email: ownerEmail.trim() || null,
          default_profit_margin: defaultProfitMargin,
        })
        .eq("id", storeId!);
      if (error) throw error;
      return { newSlug };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      queryClient.invalidateQueries({ queryKey: ["my-store"] });
      setHeroImageFiles([]);
      setLogoFile(null);
      setBannerFile(null);
      setHeroFile(null);
      setOgImageFile(null);
      setLogoRemoved(false);
      setBannerRemoved(false);
      setHeroRemoved(false);
      setOgImageRemoved(false);
      toast.success("Store settings updated!");

      const newSlug = result?.newSlug;
      const oldSlug = store?.slug;

      // Auto-purge edge cache for BOTH old and new slugs
      if (oldSlug) {
        import("@/lib/purgeStoreCache").then(({ purgeStoreCache }) =>
          purgeStoreCache(oldSlug, (store as any).custom_domain)
        );
      }
      if (newSlug) {
        import("@/lib/purgeStoreCache").then(({ purgeStoreCache }) =>
          purgeStoreCache(newSlug, (store as any).custom_domain)
        );
        import("@/lib/prewarmStore").then(({ prewarmStore }) =>
          prewarmStore(newSlug, (store as any).custom_domain)
        );
      }

      // Navigate to new slug URL if slug changed
      if (newSlug && newSlug !== oldSlug) {
        navigate(`/dashboard/stores/${newSlug}/settings`, { replace: true });
      }
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
          <Link to={`/dashboard/stores/${storeSlug}/products`}>
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
        className="space-y-6"
      >
        {/* ── 1. Basic Info ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Store className="h-5 w-5 text-primary" /> Basic Information
            </CardTitle>
            <CardDescription>Your store name, contact info and currency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="store-name">Store Name *</Label>
              <Input id="store-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-desc">Description</Label>
              <Textarea id="store-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp Number</Label>
                <Input id="whatsapp" placeholder="+1234567890" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-email">Contact Email</Label>
                <Input id="owner-email" type="email" placeholder="you@example.com" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} maxLength={200} />
                <p className="text-xs text-muted-foreground">Receives order notifications and is shown on your storefront's footer & contact page.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency"><SelectValue placeholder="Select currency" /></SelectTrigger>
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
              <Label htmlFor="profit-margin">Default Profit Margin (%)</Label>
              <Input id="profit-margin" type="number" min={0} max={100} value={defaultProfitMargin} onChange={(e) => setDefaultProfitMargin(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">Used for Meta ad optimization when product cost price isn't set. E.g. 30 means 30% of sale price is profit.</p>
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
          </CardContent>
        </Card>

        {/* ── 2. Location & Hours ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" /> Location & Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
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
              <Label htmlFor="location">Full Address</Label>
              <Input id="location" placeholder="123 Main St, City" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={500} />
            </div>
          </CardContent>
        </Card>

        {/* ── 3. Images & Media ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Image className="h-5 w-5 text-primary" /> Images & Media
            </CardTitle>
            <CardDescription>Logo, desktop hero banner, and mobile hero images</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Logo</Label>
                {logoPreview ? (
                  <div className="relative inline-block">
                    <img src={logoPreview} alt="Logo" className="h-20 w-20 rounded-lg border object-cover" />
                    <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); setLogoRemoved(true); }} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input hover:border-primary/50">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); setLogoRemoved(false); } }} />
                  </label>
                )}
              </div>
              <div className="space-y-2">
                <Label>Desktop Hero Banner <span className="text-xs text-muted-foreground font-normal">(shown on desktop)</span></Label>
                {bannerPreview ? (
                  <div className="relative inline-block">
                    <img src={bannerPreview} alt="Banner" className="h-20 w-40 rounded-lg border object-cover" />
                    <button type="button" onClick={() => { setBannerFile(null); setBannerPreview(null); setBannerRemoved(true); }} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <label className="flex h-20 w-40 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input hover:border-primary/50">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setBannerFile(f); setBannerPreview(URL.createObjectURL(f)); setBannerRemoved(false); } }} />
                  </label>
                )}
              </div>
            </div>

            {/* Mobile Hero */}
            <div className="space-y-2">
              <Label>Mobile Hero Banner <span className="text-xs text-muted-foreground font-normal">(add multiple for carousel)</span></Label>
              {heroPreview ? (
                <div className="relative inline-block">
                  <img src={heroPreview} alt="Mobile Hero" className="w-full max-h-32 rounded-lg border object-contain" />
                  <button type="button" onClick={() => { setHeroFile(null); setHeroPreview(null); setHeroRemoved(true); }} className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input hover:border-primary/50">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Upload mobile hero</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setHeroFile(f); setHeroPreview(URL.createObjectURL(f)); setHeroRemoved(false); } }} />
                </label>
              )}
              <Label className="text-xs text-muted-foreground font-normal">Carousel Images (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {heroImages.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt={`Hero ${i + 1}`} className="h-20 w-32 rounded-lg border object-cover" />
                    <button type="button" onClick={() => setHeroImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                {heroImageFiles.map((file, i) => (
                  <div key={`new-${i}`} className="relative">
                    <img src={URL.createObjectURL(file)} alt={`New hero ${i + 1}`} className="h-20 w-32 rounded-lg border object-cover" />
                    <button type="button" onClick={() => setHeroImageFiles(prev => prev.filter((_, idx) => idx !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                <label className="flex h-20 w-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input hover:border-primary/50">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length > 0) setHeroImageFiles(prev => [...prev, ...files]); }} />
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 4. Storefront Display ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flame className="h-5 w-5 text-primary" /> Storefront Display
            </CardTitle>
            <CardDescription>Control how products and features appear on your store</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Best Selling Carousel</p>
                <p className="text-xs text-muted-foreground">Show best sellers in a swipeable carousel</p>
              </div>
              <Switch checked={bestSellingCarousel} onCheckedChange={setBestSellingCarousel} />
            </div>

          </CardContent>
        </Card>

        {/* ── 5. Pages & Policies ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" /> Pages & Policies
            </CardTitle>
            <CardDescription>Manage your About Us, Contact, and policy pages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Edit About Us, Contact, Return Policy, Shipping Policy, and more from the Pages section.
              </p>
              <Button variant="outline" asChild>
                <Link to={`/dashboard/stores/${storeSlug}/pages`}>
                  <FileText className="mr-2 h-4 w-4" /> Manage Pages
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── 6. SEO ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5 text-primary" /> SEO Settings
            </CardTitle>
            <CardDescription>Optimize your store for search engines</CardDescription>
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
                  <button type="button" onClick={() => { setOgImageFile(null); setOgImagePreview(null); setOgImageUrl(""); setOgImageRemoved(true); }} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <label className="flex h-24 w-48 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input hover:border-primary/50">
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Upload image</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setOgImageFile(f); setOgImagePreview(URL.createObjectURL(f)); setOgImageRemoved(false); } }} />
                </label>
              )}
              <p className="text-xs text-muted-foreground">Or paste a URL:</p>
              <Input value={ogImageUrl} onChange={(e) => { setOgImageUrl(e.target.value); if (e.target.value) { setOgImagePreview(e.target.value); setOgImageFile(null); setOgImageRemoved(false); } }} placeholder="https://..." maxLength={500} />
            </div>
          </CardContent>
        </Card>

        {/* ── 6b. Search engine helpers ── */}
        <SearchEngineHelperCard
          slug={store?.slug || storeSlug || ""}
          storeName={name || store?.name || ""}
          customDomain={store?.custom_domain || null}
          whatsappNumber={whatsappNumber}
          city={city}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-primary" /> Custom Domain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {store?.custom_domain ? (
                  <span>Connected: <strong className="text-foreground">{store.custom_domain}</strong></span>
                ) : "No custom domain configured"}
              </div>
              <Button variant="outline" asChild>
                <Link to={`/dashboard/stores/${storeSlug}/domain`}>
                  <Globe className="mr-2 h-4 w-4" /> Configure
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR Code Generator for Restaurant Theme */}
        {store?.theme === "theme-13" && (
          <QRCodeGeneratorCard slug={store.slug} customDomain={store.custom_domain} />
        )}

        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </div>
  );
}

/* ── QR Code Generator Card ── */
function QRCodeGeneratorCard({ slug, customDomain }: { slug: string; customDomain: string | null }) {
  const [tableCount, setTableCount] = useState(5);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const baseUrl = customDomain
    ? `https://${customDomain}`
    : `${window.location.origin}/store/${slug}`;

  const tables = Array.from({ length: tableCount }, (_, i) => i + 1);

  const downloadQR = (tableNum: number | null) => {
    const svgEl = document.getElementById(tableNum === null ? "qr-no-table" : `qr-table-${tableNum}`);
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 580;
    const ctx = canvas.getContext("2d")!;

    const img = new window.Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 512, 580);
      ctx.drawImage(img, 56, 20, 400, 400);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        tableNum === null ? "Scan to Order" : `Table ${tableNum}`,
        256,
        470
      );
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#666666";
      ctx.fillText("Scan QR to view menu & order", 256, 510);

      const link = document.createElement("a");
      link.download = tableNum === null ? `qr-menu.png` : `qr-table-${tableNum}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const downloadAll = () => {
    downloadQR(null);
    tables.forEach((t) => {
      setTimeout(() => downloadQR(t), t * 200);
    });
    toast.success(`Downloading ${tables.length + 1} QR codes`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <QrCode className="h-5 w-5" /> QR Code Generator
        </CardTitle>
        <CardDescription>Generate printable QR codes for each table. Customers scan to open your menu and order via WhatsApp.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label className="text-xs">Number of Tables</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={tableCount}
              onChange={(e) => setTableCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
              className="mt-1"
            />
          </div>
          <Button onClick={downloadAll} variant="outline" className="mt-5">
            <Download className="mr-2 h-4 w-4" /> Download All
          </Button>
        </div>

        <div ref={qrContainerRef} className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {/* No-table QR */}
          <div className="flex flex-col items-center gap-2 rounded-xl border p-3">
            <QRCodeSVG
              id="qr-no-table"
              value={baseUrl}
              size={120}
              level="M"
              fgColor="#1a1a1a"
            />
            <p className="text-xs font-semibold">Menu (No Table)</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => downloadQR(null)}>
              <Download className="mr-1 h-3 w-3" /> Download
            </Button>
          </div>

          {/* Per-table QRs */}
          {tables.map((t) => (
            <div key={t} className="flex flex-col items-center gap-2 rounded-xl border p-3">
              <QRCodeSVG
                id={`qr-table-${t}`}
                value={`${baseUrl}?table=${t}`}
                size={120}
                level="M"
                fgColor="#1a1a1a"
              />
              <p className="text-xs font-semibold">Table {t}</p>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => downloadQR(t)}>
                <Download className="mr-1 h-3 w-3" /> Download
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Phase 2: Search Engine Helpers (sitemap/robots URLs, GSC + GBP CTAs) ── */
function SearchEngineHelperCard({
  slug,
  storeName,
  customDomain,
  whatsappNumber,
  city,
}: {
  slug: string;
  storeName: string;
  customDomain: string | null;
  whatsappNumber: string;
  city: string;
}) {
  const primaryHost = customDomain || `${slug}.shopbanao.in`;
  const primaryBase = `https://${primaryHost}`;
  const sitemapUrl = `${primaryBase}/sitemap.xml`;
  const robotsUrl = `${primaryBase}/robots.txt`;
  const llmsUrl = `${primaryBase}/llms.txt`;

  const copy = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} URL copied`);
    } catch {
      toast.error("Copy failed — long-press the link to copy manually");
    }
  };

  // Google Business Profile prefill — these are standard create-flow params.
  const gbpParams = new URLSearchParams();
  if (storeName) gbpParams.set("name", storeName);
  gbpParams.set("website", primaryBase);
  if (whatsappNumber) gbpParams.set("phone", whatsappNumber);
  if (city) gbpParams.set("city", city);
  const gbpUrl = `https://business.google.com/create?${gbpParams.toString()}`;

  // GSC links
  const gscAddProperty = `https://search.google.com/search-console/welcome?utm_source=shopbanao`;
  const gscSubmitSitemap = `https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(primaryBase + "/")}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5 text-primary" /> Search Engine Submission
        </CardTitle>
        <CardDescription>
          Submit your store to Google so it shows up when customers search your brand name.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Sitemap / Robots / llms URLs */}
        <div className="space-y-3">
          {[
            { label: "Sitemap", url: sitemapUrl, hint: "Lists every page Google should index" },
            { label: "Robots", url: robotsUrl, hint: "Tells crawlers what they may visit" },
            { label: "llms.txt", url: llmsUrl, hint: "Helps AI assistants describe your store" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-primary hover:underline"
                  >
                    {item.url}
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copy(item.url, item.label)}
                >
                  Copy
                </Button>
              </div>
            </div>
          ))}
          {customDomain && (
            <p className="text-xs text-muted-foreground">
              Your subdomain copies of these files automatically redirect to your custom
              domain, so Google sees one canonical version of your store.
            </p>
          )}
        </div>

        {/* Google Search Console */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">1. Google Search Console</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verify ownership and submit your sitemap so Google starts crawling your store.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="default" asChild>
              <a href={gscAddProperty} target="_blank" rel="noopener noreferrer">
                Add property
              </a>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <a href={gscSubmitSitemap} target="_blank" rel="noopener noreferrer">
                Submit sitemap
              </a>
            </Button>
          </div>
        </div>

        {/* Google Business Profile */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">2. Google Business Profile</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A claimed Business Profile is the biggest single driver of brand-name search ranking
            in India. It also unlocks the right-side info panel with your logo and photos.
          </p>
          <div className="mt-3">
            <Button type="button" size="sm" variant="default" asChild>
              <a href={gbpUrl} target="_blank" rel="noopener noreferrer">
                <Award className="mr-2 h-4 w-4" /> Claim Business Profile
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
