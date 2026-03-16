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
import { Loader2, Upload, X, ArrowLeft, Globe, Plus, Trash2, Flame, Store, MapPin, Clock, Image, FileText, Search, Award } from "lucide-react";
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
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [heroImageFiles, setHeroImageFiles] = useState<File[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [returnPolicy, setReturnPolicy] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState("");
  const [bestSellingCarousel, setBestSellingCarousel] = useState(false);
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
      const existingHeroImages = (store as any).mobile_hero_images;
      if (existingHeroImages && Array.isArray(existingHeroImages) && existingHeroImages.length > 0) {
        setHeroImages(existingHeroImages);
      }
      if (store.features) setFeatures(store.features as unknown as Feature[]);
      setReturnPolicy((store as any).return_policy || "");
      setShippingPolicy((store as any).shipping_policy || "");
      setBestSellingCarousel((store as any).best_selling_carousel || false);
      setMetaTitle((store as any).meta_title || "");
      setMetaDescription((store as any).meta_description || "");
      setOgImageUrl((store as any).og_image_url || "");
      if ((store as any).og_image_url) setOgImagePreview((store as any).og_image_url);
      setOwnerEmail((store as any).owner_email || "");
    }
  }, [store]);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
          mobile_hero_images: finalHeroImages.length > 0 ? finalHeroImages : null,
          features: features.length > 0 ? features : null,
          return_policy: returnPolicy.trim() || null,
          shipping_policy: shippingPolicy.trim() || null,
          best_selling_carousel: bestSellingCarousel,
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
      setHeroImageFiles([]);
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
          <Link to="/dashboard">
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
                <Label htmlFor="owner-email">Notification Email</Label>
                <Input id="owner-email" type="email" placeholder="you@example.com" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} maxLength={200} />
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
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Business Hours</Label>
              <div className="grid gap-2">
                {Object.entries(businessHours).map(([day, hours]) => (
                  <div key={day} className="flex items-center gap-2">
                    <span className="w-10 text-sm font-medium capitalize text-muted-foreground">{day}</span>
                    <Input placeholder="9:00-18:00 or Closed" value={hours} onChange={(e) => setBusinessHours((prev) => ({ ...prev, [day]: e.target.value }))} maxLength={50} />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 3. Images & Media ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Image className="h-5 w-5 text-primary" /> Images & Media
            </CardTitle>
            <CardDescription>Logo, banner, and mobile hero images</CardDescription>
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
                <Label>Banner</Label>
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

            {/* Why Choose Us features */}
            <div className="space-y-3">
              <div>
                <Label className="flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> Why Choose Us</Label>
                <p className="text-xs text-muted-foreground">Selling points shown on your Contact page</p>
              </div>
              {features.map((feature, idx) => (
                <div key={idx} className="flex gap-2 items-start rounded-lg border p-3">
                  <div className="flex-1 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Select value={feature.icon} onValueChange={(v) => { const updated = [...features]; updated[idx] = { ...updated[idx], icon: v }; setFeatures(updated); }}>
                        <SelectTrigger><SelectValue placeholder="Icon" /></SelectTrigger>
                        <SelectContent>{ICON_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
                      </Select>
                      <Input placeholder="Title" value={feature.title} onChange={(e) => { const updated = [...features]; updated[idx] = { ...updated[idx], title: e.target.value }; setFeatures(updated); }} className="sm:col-span-2" maxLength={50} />
                    </div>
                    <Input placeholder="Description" value={feature.description} onChange={(e) => { const updated = [...features]; updated[idx] = { ...updated[idx], description: e.target.value }; setFeatures(updated); }} maxLength={100} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setFeatures(features.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {features.length < 6 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setFeatures([...features, { icon: "Award", title: "", description: "" }])}>
                  <Plus className="mr-1 h-4 w-4" /> Add Feature
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── 5. Store Policies ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" /> Store Policies
            </CardTitle>
            <CardDescription>Leave blank to use default templates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="return-policy">Return Policy</Label>
              <Textarea id="return-policy" value={returnPolicy} onChange={(e) => setReturnPolicy(e.target.value)} rows={5} placeholder="Leave blank for a default template..." maxLength={5000} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping-policy">Shipping Policy</Label>
              <Textarea id="shipping-policy" value={shippingPolicy} onChange={(e) => setShippingPolicy(e.target.value)} rows={5} placeholder="Leave blank for a default template..." maxLength={5000} />
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

        {/* ── 7. Domain shortcut ── */}
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
                <Link to={`/dashboard/stores/${storeId}/domain`}>
                  <Globe className="mr-2 h-4 w-4" /> Configure
                </Link>
              </Button>
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
