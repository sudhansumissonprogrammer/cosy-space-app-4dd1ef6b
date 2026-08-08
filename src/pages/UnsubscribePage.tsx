import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setMessage("No unsubscribe token found in the link.");
      return;
    }

    let cancelled = false;
    const validate = async () => {
      try {
        const response = await fetch(
          `${supabase.supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          {
            headers: {
              apikey: supabase.supabaseKey,
              "Content-Type": "application/json",
            },
          }
        );
        if (cancelled) return;
        if (response.ok) {
          setStatus("valid");
          setMessage("You can unsubscribe from our emails by confirming below.");
        } else {
          const error = await response.text();
          setStatus("invalid");
          setMessage(error || "This unsubscribe link is invalid or has already been used.");
        }
      } catch (err) {
        if (cancelled) return;
        setStatus("invalid");
        setMessage("Could not verify the link. Please try again.");
      }
    };

    validate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error || !data?.success) {
        throw new Error(error?.message || "Unsubscribe failed");
      }
      setStatus("done");
      setMessage("You have been unsubscribed successfully.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-card border rounded-xl p-6 shadow-sm text-center space-y-5">
        <div className="flex justify-center">
          {status === "loading" ? (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          ) : status === "done" ? (
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          ) : (
            <AlertCircle className="h-12 w-12 text-primary" />
          )}
        </div>

        <h1 className="text-xl font-semibold text-foreground">
          {status === "done" ? "Unsubscribed" : "Email preferences"}
        </h1>
        <p className="text-sm text-muted-foreground">{message}</p>

        {status === "valid" && (
          <Button onClick={handleConfirm} className="w-full" size="lg">
            Confirm unsubscribe
          </Button>
        )}

        {(status === "invalid" || status === "error") && (
          <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
