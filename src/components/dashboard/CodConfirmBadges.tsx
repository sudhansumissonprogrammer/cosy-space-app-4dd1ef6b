import { cn } from "@/lib/utils";
import { codConfirmSteps, type CodStepTone } from "@/lib/codConfirmStatus";

const TONE: Record<CodStepTone, string> = {
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  destructive: "bg-destructive/10 text-destructive border-destructive/30",
  muted: "bg-muted text-muted-foreground border-border",
};

/** Customer's WhatsApp COD replies: order + address confirmation chips. */
export default function CodConfirmBadges({ status, className }: { status?: string | null; className?: string }) {
  const steps = codConfirmSteps(status);
  if (!steps.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {steps.map((s) => (
        <span
          key={s.label}
          className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap", TONE[s.tone])}
        >
          {s.label}: {s.value}
        </span>
      ))}
    </div>
  );
}
