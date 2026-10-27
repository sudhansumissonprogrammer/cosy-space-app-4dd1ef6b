import { Link } from "react-router-dom";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StorefrontNotFoundProps {
  slug?: string;
  label?: string;
  loadFailed?: boolean;
  onRetry?: () => void;
}

export default function StorefrontNotFound({ slug, label = "Store", loadFailed = false, onRetry }: StorefrontNotFoundProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Store className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold text-foreground">{loadFailed ? `${label} couldn't load` : `${label} not found`}</h1>
      <p className="max-w-md px-4 text-center text-muted-foreground">{loadFailed ? "We couldn't connect to the store. Please try again." : `The ${label.toLowerCase()} "${slug}" doesn't exist.`}</p>
      {loadFailed && onRetry && <Button onClick={onRetry}>Try again</Button>}
      <Button asChild variant="outline">
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );
}
