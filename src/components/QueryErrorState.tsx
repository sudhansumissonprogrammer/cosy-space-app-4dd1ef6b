import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function QueryErrorState({
  message = "Failed to load data",
  onRetry,
}: QueryErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}
