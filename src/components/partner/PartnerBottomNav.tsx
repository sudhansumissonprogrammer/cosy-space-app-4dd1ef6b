import { NavLink } from "react-router-dom";
import { LayoutDashboard, Wallet, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/partners/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/partners/dashboard/wallet", label: "Wallet", icon: Wallet, end: false },
  { to: "/partners/dashboard/withdrawals", label: "Withdraw", icon: ArrowDownToLine, end: false },
];

export function PartnerBottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-3">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition-colors", isActive && "bg-primary/10")}>
                  <t.icon className="h-4 w-4" />
                </span>
                <span>{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
