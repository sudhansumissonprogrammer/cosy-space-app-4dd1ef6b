import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useState } from "react";
import {
  MessageSquare, Megaphone, FileCheck, BarChart3, Settings, Library,
  Send, UserX, ListChecks, Sparkles, LineChart, ChevronRight, Inbox, Zap, IndianRupee,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AdminChatTab } from "@/components/admin/whatsapp/AdminChatTab";
import { AdminBulkTab } from "@/components/admin/whatsapp/AdminBulkTab";
import { AdminTemplatesTab } from "@/components/admin/whatsapp/AdminTemplatesTab";
import { AdminStatsTab } from "@/components/admin/whatsapp/AdminStatsTab";
import { AdminPlatformTab } from "@/components/admin/whatsapp/AdminPlatformTab";
import { AdminPlatformTemplatesTab } from "@/components/admin/whatsapp/AdminPlatformTemplatesTab";
import { AdminPlatformCampaignsTab } from "@/components/admin/whatsapp/AdminPlatformCampaignsTab";
import { AdminPlatformAnalyticsTab } from "@/components/admin/whatsapp/AdminPlatformAnalyticsTab";
import { AdminQueueTab } from "@/components/admin/whatsapp/AdminQueueTab";
import { AdminAICampaignWriterTab } from "@/components/admin/whatsapp/AdminAICampaignWriterTab";
import { AdminOptOutsTab } from "@/components/admin/whatsapp/AdminOptOutsTab";
import { AdminPricingTab } from "@/components/admin/whatsapp/AdminPricingTab";
import { useWhatsAppMode } from "@/hooks/useWhatsAppMode";

type NavItem = {
  id: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  render: () => JSX.Element;
  badge?: string;
};

type NavGroup = { label: string; items: NavItem[] };

export default function AdminWhatsApp() {
  const { isPlatformOnly } = useWhatsAppMode();
  const [activeTab, setActiveTab] = useState("chat");
  useDocumentTitle("WhatsApp · Admin");

  const groups: NavGroup[] = [
    {
      label: "Operations",
      items: [
        { id: "platform", label: "Platform", desc: "Connection & credentials", icon: Settings, render: () => <AdminPlatformTab /> },
        { id: "chat", label: "Inbox", desc: "Live conversations", icon: Inbox, render: () => <AdminChatTab /> },
        { id: "queue", label: "Queue", desc: "Pending & in-flight sends", icon: ListChecks, render: () => <AdminQueueTab /> },
      ],
    },
    {
      label: "Messaging",
      items: [
        { id: "ptemplates", label: "Templates", desc: "Approved message templates", icon: Library, render: () => <AdminPlatformTemplatesTab /> },
        { id: "ai", label: "AI Writer", desc: "Generate campaign copy", icon: Sparkles, badge: "AI", render: () => <AdminAICampaignWriterTab /> },
        { id: "pcampaigns", label: "Campaigns", desc: "Marketing broadcasts", icon: Send, render: () => <AdminPlatformCampaignsTab /> },
      ],
    },
    {
      label: "Insights",
      items: [
        { id: "analytics", label: "Analytics", desc: "Delivery & engagement", icon: LineChart, render: () => <AdminPlatformAnalyticsTab /> },
        { id: "pricing", label: "Pricing", desc: "Per-conversation charges", icon: IndianRupee, render: () => <AdminPricingTab /> },
        { id: "optouts", label: "Opt-outs", desc: "Blocked recipients", icon: UserX, render: () => <AdminOptOutsTab /> },
      ],
    },
  ];

  if (!isPlatformOnly) {
    groups.push({
      label: "Merchant (legacy)",
      items: [
        { id: "bulk", label: "Bulk", desc: "Per-store broadcast", icon: Megaphone, render: () => <AdminBulkTab /> },
        { id: "templates", label: "Merchant TPL", desc: "Per-store templates", icon: FileCheck, render: () => <AdminTemplatesTab /> },
        { id: "stats", label: "Stats", desc: "Per-store statistics", icon: BarChart3, render: () => <AdminStatsTab /> },
      ],
    });
  }

  const active = groups.flatMap((g) => g.items).find((i) => i.id === activeTab) ?? groups[0].items[0];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 p-5 text-white shadow-lg">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur-sm ring-1 ring-white/20">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-tight sm:text-xl">WhatsApp Hub</h1>
              <p className="mt-0.5 text-[12px] text-white/85 sm:text-sm">
                {isPlatformOnly
                  ? "Shared ShopBanao number sending on behalf of every store."
                  : "Monitor conversations, send broadcasts and manage templates."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-white/15 text-white backdrop-blur-sm hover:bg-white/20">
              <Zap className="mr-1 h-3 w-3" /> {isPlatformOnly ? "Phase 1 · Platform" : "Dual mode"}
            </Badge>
            <Badge className="border-0 bg-emerald-300/25 text-white backdrop-blur-sm hover:bg-emerald-300/30">
              <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-200" /> Live
            </Badge>
          </div>
        </div>
      </Card>

      {/* Body: sidebar nav + content */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Nav */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          {/* Mobile: horizontal scroll */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden">
            {groups.flatMap((g) => g.items).map((item) => {
              const isActive = item.id === activeTab;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "border-green-600 bg-green-600 text-white shadow-sm"
                      : "border-border bg-card text-foreground/80 hover:bg-muted"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Desktop: grouped vertical list */}
          <Card className="hidden p-2 lg:block">
            {groups.map((group, gi) => (
              <div key={group.label} className={cn(gi > 0 && "mt-3")}>
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.id === activeTab;
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => setActiveTab(item.id)}
                          className={cn(
                            "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-all",
                            isActive
                              ? "bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-100"
                              : "text-foreground/80 hover:bg-muted"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                              isActive
                                ? "bg-green-600 text-white"
                                : "bg-muted text-foreground/70 group-hover:bg-background"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-[13px] font-medium">{item.label}</span>
                              {item.badge && (
                                <Badge variant="secondary" className="h-4 px-1 text-[9px] font-semibold">
                                  {item.badge}
                                </Badge>
                              )}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">{item.desc}</span>
                          </span>
                          {isActive && <ChevronRight className="h-3.5 w-3.5 text-green-600" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </Card>
        </aside>

        {/* Content */}
        <section className="min-w-0">
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300">
                  <active.icon className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold leading-none">{active.label}</h2>
                  <p className="mt-1 text-[11px] text-muted-foreground">{active.desc}</p>
                </div>
              </div>
            </div>
            <div className="min-h-[300px]">{active.render()}</div>
          </Card>
        </section>
      </div>
    </div>
  );
}
