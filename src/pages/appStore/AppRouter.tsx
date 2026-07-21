import { useParams } from "react-router-dom";
import { Suspense } from "react";
import { getApp } from "@/lib/appStore/registry";
import { Loader2 } from "lucide-react";

/**
 * Generic per-app config router. URL: /dashboard/stores/:storeSlug/apps/:appId
 */
export default function AppRouter() {
  const { appId } = useParams<{ appId: string }>();
  const app = appId ? getApp(appId) : undefined;

  if (!app) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold">App not found</h1>
        <p className="text-sm text-muted-foreground mt-1">This add-on doesn't exist.</p>
      </div>
    );
  }

  if (!app.ConfigComponent) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold">{app.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">This app is coming soon.</p>
      </div>
    );
  }

  const Cfg = app.ConfigComponent;
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <Cfg />
    </Suspense>
  );
}
