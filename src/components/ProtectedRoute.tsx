import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  // Render nothing while auth resolves so the index.html #inline-skel spinner
  // stays visible until the real dashboard content paints (otherwise an empty
  // full-screen div would trip waitForPaint and kill the loader prematurely).
  if (loading) {
    return null;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
