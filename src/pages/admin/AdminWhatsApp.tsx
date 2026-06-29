import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Megaphone, FileCheck, BarChart3, Settings, Library, Send, UserX } from "lucide-react";
import { AdminChatTab } from "@/components/admin/whatsapp/AdminChatTab";
import { AdminBulkTab } from "@/components/admin/whatsapp/AdminBulkTab";
import { AdminTemplatesTab } from "@/components/admin/whatsapp/AdminTemplatesTab";
import { AdminStatsTab } from "@/components/admin/whatsapp/AdminStatsTab";
import { AdminPlatformTab } from "@/components/admin/whatsapp/AdminPlatformTab";
import { AdminPlatformTemplatesTab } from "@/components/admin/whatsapp/AdminPlatformTemplatesTab";
import { AdminPlatformCampaignsTab } from "@/components/admin/whatsapp/AdminPlatformCampaignsTab";
import { AdminOptOutsTab } from "@/components/admin/whatsapp/AdminOptOutsTab";
import { useWhatsAppMode } from "@/hooks/useWhatsAppMode";

export default function AdminWhatsApp() {
  const { isPlatformOnly } = useWhatsAppMode();
  const [activeTab, setActiveTab] = useState("platform");
  useDocumentTitle("WhatsApp · Admin");

  // Phase 1 surface — platform tabs only. Phase 2 surface kept in code, gated.
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-green-600" />
          WhatsApp Hub
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isPlatformOnly
            ? "Phase 1 — Shared ShopBanao WhatsApp platform. One number sends for every store."
            : "Monitor all store conversations, send bulk messages, manage templates"}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={isPlatformOnly ? "w-full grid grid-cols-4" : "w-full grid grid-cols-8"}>
          <TabsTrigger value="platform" className="text-[11px]"><Settings className="h-3 w-3 mr-1" /> Platform</TabsTrigger>
          <TabsTrigger value="ptemplates" className="text-[11px]"><Library className="h-3 w-3 mr-1" /> Templates</TabsTrigger>
          <TabsTrigger value="pcampaigns" className="text-[11px]"><Send className="h-3 w-3 mr-1" /> Campaigns</TabsTrigger>
          <TabsTrigger value="optouts" className="text-[11px]"><UserX className="h-3 w-3 mr-1" /> Opt-outs</TabsTrigger>
          {!isPlatformOnly && <>
            <TabsTrigger value="chat" className="text-[11px]"><MessageSquare className="h-3 w-3 mr-1" /> Chat</TabsTrigger>
            <TabsTrigger value="bulk" className="text-[11px]"><Megaphone className="h-3 w-3 mr-1" /> Bulk</TabsTrigger>
            <TabsTrigger value="templates" className="text-[11px]"><FileCheck className="h-3 w-3 mr-1" /> Merchant TPL</TabsTrigger>
            <TabsTrigger value="stats" className="text-[11px]"><BarChart3 className="h-3 w-3 mr-1" /> Stats</TabsTrigger>
          </>}
        </TabsList>

        <TabsContent value="platform" className="mt-4"><AdminPlatformTab /></TabsContent>
        <TabsContent value="ptemplates" className="mt-4"><AdminPlatformTemplatesTab /></TabsContent>
        <TabsContent value="pcampaigns" className="mt-4"><AdminPlatformCampaignsTab /></TabsContent>
        <TabsContent value="optouts" className="mt-4"><AdminOptOutsTab /></TabsContent>

        {!isPlatformOnly && <>
          <TabsContent value="chat" className="mt-4"><AdminChatTab /></TabsContent>
          <TabsContent value="bulk" className="mt-4"><AdminBulkTab /></TabsContent>
          <TabsContent value="templates" className="mt-4"><AdminTemplatesTab /></TabsContent>
          <TabsContent value="stats" className="mt-4"><AdminStatsTab /></TabsContent>
        </>}
      </Tabs>
    </div>
  );
}
