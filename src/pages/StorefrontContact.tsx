import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import CustomHtmlRenderer from "@/components/storefront/CustomHtmlRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  MapPin,
  Phone,
  Clock,
  Instagram,
  Facebook,
  Award,
  Leaf,
  Shield,
  Star,
  Sparkles,
  Heart,
  Truck,
  ThumbsUp,
  Loader2,
  Send,
  MessageCircle,
  ArrowRight,
  Mail,
} from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";

const ICON_MAP: Record<string, React.ElementType> = {
  Award, Leaf, Shield, Star, Sparkles, Heart, Truck, ThumbsUp,
};

interface Feature {
  icon: string;
  title: string;
  description: string;
}

export default function StorefrontContact() {
  const store = useOutletContext<StoreData>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const shellContactPage = (() => {
    const pages = (window as any).__STOREFRONT_DATA__?.standard_pages;
    return Array.isArray(pages)
      ? pages.find((page: any) => page?.page_type === "contact")
      : undefined;
  })();

  // Fetch custom_html for contact page
  const { data: contactPage } = useQuery({
    queryKey: ["storefront-contact-page-html", store.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_pages")
        .select("custom_html")
        .eq("store_id", store.id)
        .eq("page_type", "contact")
        .eq("is_active", true)
        .single();
      return data;
    },
    enabled: !!store.id,
    staleTime: 5 * 60 * 1000,
    initialData: shellContactPage ? { custom_html: shellContactPage.custom_html } : undefined,
  });

  const customHtml = (contactPage as any)?.custom_html as string | null;

  // Phase 3: prefer shell-bundled owner_email; only fall back to RPC for legacy shells.
  const shellEmail = (store as any).owner_email as string | null | undefined;
  const { data: ownerEmail } = useQuery({
    queryKey: ["store-public-email", store.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_store_public_email", { _store_id: store.id });
      return ((data as string) || "").trim();
    },
    enabled: !!store.id && shellEmail === undefined,
    staleTime: 10 * 60 * 1000,
    initialData: shellEmail === undefined ? undefined : (shellEmail || "").trim(),
  });

  const features: Feature[] = (store.features as unknown as Feature[]) || [];
  const businessHours = (store.business_hours as Record<string, string>) || {};
  const hasHours = Object.values(businessHours).some((v) => v?.trim());
  const address = [store.location, store.city, store.state].filter(Boolean).join(", ");

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customer_leads").insert({
        store_id: store.id,
        name: name.trim() || null,
        phone: phone.trim(),
        source: "contact_form",
        product_name: message.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message sent! We'll get back to you soon.");
      setName("");
      setPhone("");
      setMessage("");
    },
    onError: () => toast.error("Failed to send message. Please try again."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("Please enter your phone number");
      return;
    }
    submitMutation.mutate();
  };

  // Render custom HTML if available (contact form still shown below)
  if (customHtml?.trim()) {
    return (
      <div className="min-h-[70vh]">
        <CustomHtmlRenderer html={customHtml} className="" />
        {/* Always keep the contact form for lead capture */}
        <section className="mx-auto max-w-3xl px-4 pb-16">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-foreground">Send us a Message</h2>
            <p className="mt-1 text-sm text-muted-foreground">Fill out the form and we'll respond as soon as possible.</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Your Name</Label>
                  <Input id="name" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">Phone Number *</Label>
                  <Input id="phone" placeholder="+1234567890" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={20} className="h-11 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-medium">Message</Label>
                <Textarea id="message" placeholder="Tell us how we can help you..." value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={1000} className="rounded-xl resize-none" />
              </div>
              <Button type="submit" className="h-12 w-full rounded-xl text-base font-semibold" disabled={submitMutation.isPending}>
                {submitMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                Send Message
              </Button>
            </form>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh]">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/30 to-background px-4 py-16 lg:py-24 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--accent)/0.15),transparent_50%)]" />
        <div className="relative mx-auto max-w-2xl lg:max-w-3xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 backdrop-blur-sm">
            <MessageCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Get in Touch
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Have a question or need help? We'd love to hear from you.
          </p>
        </div>
      </div>

      {/* Why Choose Us */}
      {features.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 lg:px-6 py-12">
          <h2 className="mb-8 text-center text-2xl font-bold text-foreground">
            Why Choose {store.name}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, idx) => {
              const IconComponent = ICON_MAP[feature.icon] || Award;
              return (
                <div
                  key={idx}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-center transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="relative">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                      <IconComponent className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="font-bold text-foreground">{feature.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Contact Form + Info */}
      <section className="mx-auto max-w-7xl px-4 lg:px-6 pb-16">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Form */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold text-foreground">Send us a Message</h2>
              <p className="mt-1 text-sm text-muted-foreground">Fill out the form and we'll respond as soon as possible.</p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Your Name</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={100}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">Phone Number *</Label>
                    <Input
                      id="phone"
                      placeholder="+1234567890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      maxLength={20}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message" className="text-sm font-medium">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us how we can help you..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    maxLength={1000}
                    className="rounded-xl resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl text-base font-semibold"
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-5 w-5" />
                  )}
                  Send Message
                </Button>
              </form>
            </div>
          </div>

          {/* Info Sidebar */}
          <div className="space-y-5 lg:col-span-2">
            {/* Address Card */}
            {address && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Our Address</p>
                    <p className="text-sm text-muted-foreground">{address}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Email Card */}
            {ownerEmail && (
              <a
                href={`mailto:${ownerEmail}`}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Email</p>
                  <p className="text-sm text-muted-foreground break-all">{ownerEmail}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 shrink-0" />
              </a>
            )}

            {/* WhatsApp Card */}
            {store.whatsapp_number && (
              <a
                href={`https://wa.me/${store.whatsapp_number.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:border-green-500/30 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10">
                  <Phone className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">WhatsApp</p>
                  <p className="text-sm text-muted-foreground">{store.whatsapp_number}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </a>
            )}

            {/* Business Hours Card */}
            {hasHours && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Business Hours</p>
                </div>
                <div className="space-y-1.5 pl-[52px]">
                  {Object.entries(businessHours).map(([day, hours]) =>
                    hours?.trim() ? (
                      <div key={day} className="flex justify-between text-sm">
                        <span className="capitalize text-muted-foreground">{day}</span>
                        <span className="font-medium text-foreground">{hours}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {/* Social Links */}
            {(store.instagram_url || store.facebook_url) && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="mb-3 text-sm font-semibold text-foreground">Follow Us</p>
                <div className="flex gap-3">
                  {store.instagram_url && (
                    <a
                      href={store.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 transition-all hover:scale-105 hover:shadow-md"
                    >
                      <Instagram className="h-5 w-5 text-pink-600" />
                    </a>
                  )}
                  {store.facebook_url && (
                    <a
                      href={store.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 transition-all hover:scale-105 hover:shadow-md"
                    >
                      <Facebook className="h-5 w-5 text-blue-600" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
