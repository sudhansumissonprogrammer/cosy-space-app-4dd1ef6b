import { Link } from "react-router-dom";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StorefrontNotFoundProps {
  slug?: string;
  label?: string;
}

export default function StorefrontNotFound({ slug, label = "Store" }: StorefrontNotFoundProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Store className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold text-foreground">{label} not found</h1>
      <p className="text-muted-foreground">The {label.toLowerCase()} "{slug}" doesn't exist.</p>
      <Button asChild variant="outline">
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );
}
