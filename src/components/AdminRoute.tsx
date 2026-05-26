import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();
  const errorToastedRef = useRef(false);

  const { data: isAdmin, isLoading: roleLoading, error: roleError } = useQuery({
    queryKey: ["admin-role", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user,
    retry: 1,
  });

  useEffect(() => {
    if (roleError && !errorToastedRef.current) {
      errorToastedRef.current = true;
      toast.error("Couldn't verify admin access. Please sign in again.");
    }
  }, [roleError]);

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
