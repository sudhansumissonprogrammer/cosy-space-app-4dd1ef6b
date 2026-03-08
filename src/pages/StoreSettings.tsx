import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, X, ArrowLeft, MessageCircle, Globe, Palette, Lock, Check } from "lucide-react";
import { Link } from "react-router-dom";

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
  const [orderMode, setOrderMode] = useState<"whatsapp" | "website">("whatsapp");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [businessHours, setBusinessHours] = useState<Record<string, string>>({
    mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [theme, setTheme] = useState("theme-1");

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
      setOrderMode((store as any).order_mode || "whatsapp");
      setInstagramUrl((store as any).instagram_url || "");
      setFacebookUrl((store as any).facebook_url || "");
      if ((store as any).business_hours) {
        setBusinessHours({ mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "", ...(store as any).business_hours });
      }
      if (store.logo_url) setLogoPreview(store.logo_url);
      if (store.banner_url) setBannerPreview(store.banner_url);
      setTheme((store as any).theme || "theme-1");
    }
  }, [store]);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const uploadFile = async (file: File, bucket: string) => {
    if (file.size > MAX_FILE_SIZE) throw new Error("File must be less than 5MB");
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${storeId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { cacheControl: "3600", upsert: true });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      let logoUrl = store?.logo_url || null;
      let bannerUrl = store?.banner_url || null;

      if (logoFile) logoUrl = await uploadFile(logoFile, "store-logos");
      if (bannerFile) bannerUrl = await uploadFile(bannerFile, "store-banners");

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
          order_mode: orderMode,
          instagram_url: instagramUrl.trim() || null,
          facebook_url: facebookUrl.trim() || null,
          business_hours: hasHours ? businessHours : null,
          logo_url: logoUrl,
          banner_url: bannerUrl,
          theme,
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
              <Label>Order Mode</Label>
              <RadioGroup value={orderMode} onValueChange={(v) => setOrderMode(v as "whatsapp" | "website")} className="grid gap-3 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-all ${orderMode === "whatsapp" ? "border-primary bg-primary/5" : "border-input hover:border-primary/30"}`}>
                  <RadioGroupItem value="whatsapp" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <MessageCircle className="h-3.5 w-3.5 text-green-600" /> WhatsApp
                    </p>
                    <p className="text-xs text-muted-foreground">Orders via WhatsApp</p>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-all ${orderMode === "website" ? "border-primary bg-primary/5" : "border-input hover:border-primary/30"}`}>
                  <RadioGroupItem value="website" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-blue-600" /> Website
                    </p>
                    <p className="text-xs text-muted-foreground">Checkout on site</p>
                  </div>
                </label>
              </RadioGroup>
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
                      onClick={() => { setLogoFile(null); setLogoPreview(null); }}
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
                        if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); }
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
                      onClick={() => { setBannerFile(null); setBannerPreview(null); }}
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
                        if (f) { setBannerFile(f); setBannerPreview(URL.createObjectURL(f)); }
                      }}
                    />
                  </label>
                )}
              </div>
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

            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
