import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
export default function ProductLoadError({ retry, retrying }: { retry: () => void; retrying: boolean }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Unable to load this product</h1>
      <p className="text-muted-foreground">Please try again. Your connection may have been interrupted.</p>
      <Button onClick={retry} disabled={retrying} variant="outline">
        <RotateCcw className="mr-2 h-4 w-4" />{retrying ? "Trying again…" : "Try again"}
      </Button>
    </div>
  );
}
