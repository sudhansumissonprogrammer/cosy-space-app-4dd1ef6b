import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AuthShell,
  BauhausCard,
  BauhausField,
  BauhausButton,
} from "@/components/onboarding/BauhausAuth";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully!");
      navigate("/dashboard");
    }
  };

  return (
    <AuthShell
      eyebrow="Final step"
      title={<>Set New<br />Password</>}
      subtitle="Choose a strong password. You'll be signed straight into your dashboard."
      panelTitle={"New key.\nSame shop.\nKeep selling."}
      panelPoints={["Minimum 6 characters", "Applies to all devices", "Takes effect instantly"]}
    >
      <BauhausCard corner="blue">
        <form onSubmit={handleUpdate} className="space-y-5">
          <BauhausField
            id="password"
            label="New password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            maxLength={128}
            autoComplete="new-password"
          />
          <BauhausField
            id="confirm-password"
            label="Confirm password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            maxLength={128}
            autoComplete="new-password"
          />
          <BauhausButton type="submit" variant="red" className="w-full" loading={loading} disabled={loading}>
            Update password
          </BauhausButton>
        </form>
      </BauhausCard>
    </AuthShell>
  );
}
