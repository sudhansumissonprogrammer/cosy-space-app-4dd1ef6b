import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, Palette, RotateCcw, Save, Lock } from "lucide-react";
import { toast } from "sonner";

const FONT_OPTIONS = [
  "Alegreya SC",
  "Inter",
  "Playfair Display",
  "Lora",
  "Poppins",
  "Montserrat",
  "Roboto",
  "Open Sans",
  "Oswald",
  "Raleway",
  "Merriweather",
  "DM Sans",
  "Space Grotesk",
];

const BUTTON_STYLES = [
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Pill" },
  { value: "square", label: "Square" },
];

const MARQUEE_PRESETS = [
  { label: "Gold Classic", value: "linear-gradient(90deg, #b8873c, #f1d78a, #d1a24a)" },
  { label: "Dark Elegant", value: "linear-gradient(90deg, #1a1a1a, #333333, #1a1a1a)" },
  { label: "Rose Gold", value: "linear-gradient(90deg, #b76e79, #f0c9cf, #b76e79)" },
  { label: "Ocean Blue", value: "linear-gradient(90deg, #1e3a5f, #4a90d9, #1e3a5f)" },
  { label: "Forest Green", value: "linear-gradient(90deg, #2d5016, #6b8f3c, #2d5016)" },
  { label: "Custom", value: "custom" },
];

const THEME_DEFAULTS: Record<string, ThemeConfig> = {
  "theme-1": {
    primary_color: "#b8873c",
    accent_color: "#000000",
    text_color: "#1a1a1a",
    background_color: "#f7f5f0",
    heading_font: "Alegreya SC",
    body_font: "Inter",
    button_style: "rounded",
    marquee_gradient: "linear-gradient(90deg, #b8873c, #f1d78a, #d1a24a)",
  },
};

interface ThemeConfig {
  primary_color: string;
  accent_color: string;
  text_color: string;
  background_color: string;
  heading_font: string;
  body_font: string;
  button_style: string;
  marquee_gradient: string;
}

const THEMES = [
  { id: "theme-1", name: "Classic", description: "Elegant gold & black with serif headings", available: true },
  { id: "theme-2", name: "Bold Modern", description: "Clean minimalist with strong typography", available: false },
  { id: "theme-3", name: "Pastel Soft", description: "Soft pastels with rounded elements", available: false },
];

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-md border border-input p-0.5"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-24 rounded-md border border-input bg-background px-2 text-xs font-mono"
        />
      </div>
    </div>
  );
}

export default function StoreThemeSettings() {
  const { storeId } = useParams<{ storeId: string }>();
  const queryClient = useQueryClient();

  const { data: store } = useQuery({
    queryKey: ["store-detail", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, theme")
        .eq("id", storeId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const { data: themeConfig, isLoading } = useQuery({
    queryKey: ["store-theme-config", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_theme_config")
        .select("*")
        .eq("store_id", storeId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const currentTheme = store?.theme || "theme-1";
  const defaults = THEME_DEFAULTS[currentTheme] || THEME_DEFAULTS["theme-1"];

  const [config, setConfig] = useState<ThemeConfig>(defaults);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (themeConfig) {
      setConfig({
        primary_color: themeConfig.primary_color,
        accent_color: themeConfig.accent_color,
        text_color: themeConfig.text_color,
        background_color: themeConfig.background_color,
        heading_font: themeConfig.heading_font,
        body_font: themeConfig.body_font,
        button_style: themeConfig.button_style,
        marquee_gradient: themeConfig.marquee_gradient,
      });
    } else {
      setConfig(defaults);
    }
    setDirty(false);
  }, [themeConfig, currentTheme]);

  const updateField = (key: keyof ThemeConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const applyThemeMutation = useMutation({
    mutationFn: async (themeId: string) => {
      const { error } = await supabase
        .from("stores")
        .update({ theme: themeId })
        .eq("id", storeId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-detail", storeId] });
      toast.success("Theme applied!");
    },
    onError: () => toast.error("Failed to apply theme"),
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const payload = { store_id: storeId!, ...config };
      if (themeConfig?.id) {
        const { error } = await supabase
          .from("store_theme_config")
          .update(config)
          .eq("id", themeConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_theme_config")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-theme-config", storeId] });
      setDirty(false);
      toast.success("Theme settings saved!");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const resetToDefaults = () => {
    setConfig(defaults);
    setDirty(true);
  };

  const selectedMarqueePreset = MARQUEE_PRESETS.find((p) => p.value === config.marquee_gradient);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Theme Settings</h1>
        <p className="text-sm text-muted-foreground">Customize your storefront's look and feel</p>
      </div>

      {/* Section 1: Theme Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Choose a Theme</CardTitle>
          <CardDescription>Select a layout theme for your storefront</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {THEMES.map((theme) => {
              const isApplied = currentTheme === theme.id;
              return (
                <div
                  key={theme.id}
                  className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                    isApplied
                      ? "border-foreground shadow-md"
                      : theme.available
                      ? "border-border hover:border-foreground/40"
                      : "border-border opacity-60"
                  }`}
                >
                  {/* Theme preview strip */}
                  <div
                    className="h-24 w-full"
                    style={{
                      background: theme.id === "theme-1"
                        ? "linear-gradient(135deg, #f7f5f0 0%, #b8873c 50%, #000000 100%)"
                        : theme.id === "theme-2"
                        ? "linear-gradient(135deg, #ffffff 0%, #2563eb 50%, #1e293b 100%)"
                        : "linear-gradient(135deg, #fdf2f8 0%, #f9a8d4 50%, #c084fc 100%)",
                    }}
                  />
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{theme.name}</h3>
                        <p className="text-xs text-muted-foreground">{theme.description}</p>
                      </div>
                      {isApplied ? (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3 w-3" /> Applied
                        </Badge>
                      ) : theme.available ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => applyThemeMutation.mutate(theme.id)}
                          disabled={applyThemeMutation.isPending}
                        >
                          Apply
                        </Button>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <Lock className="h-3 w-3" /> Soon
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Theme Customization */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Customize Theme</CardTitle>
              <CardDescription>Adjust colors, fonts, and styles for your active theme</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Colors */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Colors</h4>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <ColorPicker label="Primary" value={config.primary_color} onChange={(v) => updateField("primary_color", v)} />
              <ColorPicker label="Accent" value={config.accent_color} onChange={(v) => updateField("accent_color", v)} />
              <ColorPicker label="Text" value={config.text_color} onChange={(v) => updateField("text_color", v)} />
              <ColorPicker label="Background" value={config.background_color} onChange={(v) => updateField("background_color", v)} />
            </div>
          </div>

          <Separator />

          {/* Fonts */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Typography</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Heading Font</Label>
                <Select value={config.heading_font} onValueChange={(v) => updateField("heading_font", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Body Font</Label>
                <Select value={config.body_font} onValueChange={(v) => updateField("body_font", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Button & Marquee */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Style</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Button Style</Label>
                <Select value={config.button_style} onValueChange={(v) => updateField("button_style", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUTTON_STYLES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Marquee Gradient</Label>
                <Select
                  value={selectedMarqueePreset ? config.marquee_gradient : "custom"}
                  onValueChange={(v) => {
                    if (v !== "custom") updateField("marquee_gradient", v);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MARQUEE_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!selectedMarqueePreset || selectedMarqueePreset.value === "custom") && (
                  <input
                    type="text"
                    value={config.marquee_gradient}
                    onChange={(e) => updateField("marquee_gradient", e.target.value)}
                    placeholder="linear-gradient(90deg, ...)"
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-mono"
                  />
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Live Preview */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Preview</h4>
            <div
              className="overflow-hidden rounded-xl border"
              style={{ backgroundColor: config.background_color }}
            >
              {/* Marquee preview */}
              <div
                className="px-4 py-2 text-center text-xs font-medium"
                style={{ background: config.marquee_gradient, color: config.text_color }}
              >
                🚚 Free Delivery • 🔄 Easy Returns • 🔒 Secure Payment
              </div>
              <div className="p-4">
                <h3
                  className="text-lg font-bold"
                  style={{ fontFamily: config.heading_font, color: config.text_color }}
                >
                  Sample Heading
                </h3>
                <p
                  className="mt-1 text-sm"
                  style={{ fontFamily: config.body_font, color: config.text_color + "cc" }}
                >
                  This is how your body text will look on the storefront.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${
                      config.button_style === "pill"
                        ? "rounded-full"
                        : config.button_style === "square"
                        ? "rounded-none"
                        : "rounded-lg"
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${config.primary_color}, ${config.primary_color}dd)`,
                      color: config.background_color,
                    }}
                  >
                    Add to Cart
                  </button>
                  <button
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border ${
                      config.button_style === "pill"
                        ? "rounded-full"
                        : config.button_style === "square"
                        ? "rounded-none"
                        : "rounded-lg"
                    }`}
                    style={{
                      borderColor: config.accent_color,
                      color: config.accent_color,
                      backgroundColor: "transparent",
                    }}
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={() => saveConfigMutation.mutate()}
              disabled={!dirty || saveConfigMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saveConfigMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={resetToDefaults} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
