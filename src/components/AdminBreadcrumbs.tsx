import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const LABELS: Record<string, string> = {
  admin: "Admin",
  "users-stores": "Users & Stores",
  orders: "Orders",
  subscriptions: "Subscriptions",
  wallets: "Commission Wallets",
  partners: "Partners",
  payouts: "Payouts",
  audit: "Audit",
  whatsapp: "WhatsApp",
  analytics: "Analytics",
  usage: "Usage Monitor",
  "error-logs": "Error Logs",
  "menu-config": "Menu Control",
  settings: "Settings",
};

export function AdminBreadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean); // ["admin", ...]
  if (parts.length === 0 || parts[0] !== "admin") return null;

  const crumbs = parts.map((seg, i) => {
    const href = "/" + parts.slice(0, i + 1).join("/");
    const label = LABELS[seg] ?? seg.replace(/-/g, " ");
    return { href, label, last: i === parts.length - 1 };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex items-center gap-1.5">
            <BreadcrumbItem>
              {c.last ? (
                <BreadcrumbPage className="capitalize">{c.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={c.href} className="capitalize">{c.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {i < crumbs.length - 1 && <BreadcrumbSeparator />}
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
