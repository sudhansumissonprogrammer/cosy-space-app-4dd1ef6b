import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";

export default function CreateStore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

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
      setFile(file);
      const url = URL.createObjectURL(file);
      setPreview(url);
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
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim() || !slug.trim()) {
      toast.error("Store name and slug are required");
      return;
    }

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

      const { error } = await supabase.from("stores").insert({
        owner_id: user.id,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        whatsapp_number: whatsappNumber.trim() || null,
        logo_url: logoUrl,
        banner_url: bannerUrl,
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Create Store</h1>
        <p className="text-sm text-muted-foreground">Set up your new storefront</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Store Details</CardTitle>
            <CardDescription>Basic information about your store</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="store-name">Store Name *</Label>
              <Input
                id="store-name"
                placeholder="My Fashion Store"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-slug">Store Slug *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/store/</span>
                <Input
                  id="store-slug"
                  placeholder="my-fashion-store"
                  value={slug}
                  onChange={(e) => setSlug(generateSlug(e.target.value))}
                  maxLength={100}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your store..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp Number</Label>
              <Input
                id="whatsapp"
                placeholder="+1234567890"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                maxLength={20}
              />
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Logo</Label>
              {logoPreview ? (
                <div className="relative inline-block">
                  <img src={logoPreview} alt="Logo preview" className="h-20 w-20 rounded-lg border object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(setLogoFile, setLogoPreview)}
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input hover:border-primary/50 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null, setLogoFile, setLogoPreview)}
                  />
                </label>
              )}
            </div>

            {/* Banner Upload */}
            <div className="space-y-2">
              <Label>Banner</Label>
              {bannerPreview ? (
                <div className="relative">
                  <img src={bannerPreview} alt="Banner preview" className="h-32 w-full rounded-lg border object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(setBannerFile, setBannerPreview)}
                    className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-32 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input hover:border-primary/50 transition-colors">
                  <div className="text-center">
                    <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                    <span className="mt-1 block text-xs text-muted-foreground">Upload banner image</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null, setBannerFile, setBannerPreview)}
                  />
                </label>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Store
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
