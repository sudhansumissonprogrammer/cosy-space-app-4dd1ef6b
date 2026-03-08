import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

export default function Placeholder() {
  const location = useLocation();
  const name = location.pathname.split("/").pop() || "Page";
  const title = name.charAt(0).toUpperCase() + name.slice(1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <Card>
        <CardContent className="flex min-h-[400px] items-center justify-center">
          <p className="text-muted-foreground">This module is coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
