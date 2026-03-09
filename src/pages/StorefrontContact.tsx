import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";

const ICON_MAP: Record<string, React.ElementType> = {
  Award,
  Leaf,
  Shield,
  Star,
  Sparkles,
  Heart,
  Truck,
  ThumbsUp,
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

  const features: Feature[] = (store.features as Feature[]) || [];
  const businessHours = (store.business_hours as Record<string, string>) || {};

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-12">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground">Contact Us</h1>
        <p className="mt-2 text-muted-foreground">
          We'd love to hear from you. Get in touch with us!
        </p>
      </div>

      {/* Why Choose Us */}
      {features.length > 0 && (
        <section>
          <h2 className="mb-6 text-center text-2xl font-semibold text-foreground">
            Why Choose Us
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, idx) => {
              const IconComponent = ICON_MAP[feature.icon] || Award;
              return (
                <Card key={idx} className="text-center">
                  <CardContent className="pt-6">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Contact Form */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Send us a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  placeholder="+1234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="How can we help you?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={1000}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitMutation.isPending}>
                {submitMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Message
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Store Info */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Store Information</h2>

              {store.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Address</p>
                    <p className="text-sm text-muted-foreground">{store.location}</p>
                    {(store.city || store.state) && (
                      <p className="text-sm text-muted-foreground">
                        {[store.city, store.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {store.whatsapp_number && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">WhatsApp</p>
                    <a
                      href={`https://wa.me/${store.whatsapp_number.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {store.whatsapp_number}
                    </a>
                  </div>
                </div>
              )}

              {Object.values(businessHours).some((v) => v) && (
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Business Hours</p>
                    <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                      {Object.entries(businessHours).map(([day, hours]) =>
                        hours ? (
                          <p key={day}>
                            <span className="capitalize">{day}</span>: {hours}
                          </p>
                        ) : null
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(store.instagram_url || store.facebook_url) && (
                <div className="flex items-center gap-3 pt-2">
                  {store.instagram_url && (
                    <a
                      href={store.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-accent hover:bg-accent/80"
                    >
                      <Instagram className="h-5 w-5" />
                    </a>
                  )}
                  {store.facebook_url && (
                    <a
                      href={store.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-accent hover:bg-accent/80"
                    >
                      <Facebook className="h-5 w-5" />
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
