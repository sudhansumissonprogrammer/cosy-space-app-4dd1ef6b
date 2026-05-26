import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Megaphone, FileCheck, BarChart3 } from "lucide-react";
import { AdminChatTab } from "@/components/admin/whatsapp/AdminChatTab";
import { AdminBulkTab } from "@/components/admin/whatsapp/AdminBulkTab";
import { AdminTemplatesTab } from "@/components/admin/whatsapp/AdminTemplatesTab";
import { AdminStatsTab } from "@/components/admin/whatsapp/AdminStatsTab";

export default function AdminWhatsApp() {
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-green-600" />
          WhatsApp Hub
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Monitor all store conversations, send bulk messages, manage templates
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="chat" className="text-[11px]"><MessageSquare className="h-3 w-3 mr-1" /> Chat</TabsTrigger>
          <TabsTrigger value="bulk" className="text-[11px]"><Megaphone className="h-3 w-3 mr-1" /> Bulk</TabsTrigger>
          <TabsTrigger value="templates" className="text-[11px]"><FileCheck className="h-3 w-3 mr-1" /> Templates</TabsTrigger>
          <TabsTrigger value="stats" className="text-[11px]"><BarChart3 className="h-3 w-3 mr-1" /> Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4"><AdminChatTab /></TabsContent>
        <TabsContent value="bulk" className="mt-4"><AdminBulkTab /></TabsContent>
        <TabsContent value="templates" className="mt-4"><AdminTemplatesTab /></TabsContent>
        <TabsContent value="stats" className="mt-4"><AdminStatsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
