import { useRef, useCallback } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

interface OrderInvoiceProps {
  order: any;
  store: any;
  onClose: () => void;
}

export default function OrderInvoice({ order, store, onClose }: OrderInvoiceProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    const content = printRef.current;
    if (!content) return;

    // Create an iframe for reliable printing (avoids popup blockers)
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html><head><title>Invoice #${order.id.slice(0, 8).toUpperCase()}</title>
<style>
  @page { size: A4; margin: 20mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .invoice { max-width: 680px; margin: 0 auto; padding: 0; }

  /* Header */
  .invoice-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 20px;
    border-bottom: 3px solid #1a1a1a;
    margin-bottom: 24px;
  }
  .brand-section { flex: 1; }
  .brand-logo { height: 52px; width: auto; object-fit: contain; margin-bottom: 8px; display: block; }
  .brand-name { font-size: 22px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px; }
  .brand-address { font-size: 11px; color: #666; margin-top: 4px; line-height: 1.6; }

  .invoice-title-section { text-align: right; }
  .invoice-title { font-size: 32px; font-weight: 800; color: #1a1a1a; letter-spacing: 2px; text-transform: uppercase; }
  .invoice-number { font-size: 12px; color: #888; margin-top: 4px; font-weight: 500; }

  /* Info Grid */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 28px;
  }
  .info-block {}
  .info-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #999; margin-bottom: 6px; }
  .info-value { font-size: 13px; color: #333; line-height: 1.7; }
  .info-value strong { color: #1a1a1a; font-weight: 600; }

  /* Status Badge */
  .status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: #f0f0f0;
    color: #555;
  }
  .status-pending { background: #fff3cd; color: #856404; }
  .status-confirmed { background: #d1ecf1; color: #0c5460; }
  .status-shipped { background: #cce5ff; color: #004085; }
  .status-delivered { background: #d4edda; color: #155724; }
  .status-cancelled { background: #f8d7da; color: #721c24; }

  /* Items Table */
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  .items-table thead th {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: #fff;
    background: #1a1a1a;
    padding: 10px 12px;
    text-align: left;
  }
  .items-table thead th:last-child,
  .items-table thead th:nth-child(3),
  .items-table thead th:nth-child(4) { text-align: right; }
  .items-table tbody td {
    font-size: 13px;
    padding: 11px 12px;
    border-bottom: 1px solid #eee;
    color: #333;
  }
  .items-table tbody td:last-child,
  .items-table tbody td:nth-child(3),
  .items-table tbody td:nth-child(4) { text-align: right; font-variant-numeric: tabular-nums; }
  .items-table tbody tr:nth-child(even) { background: #fafafa; }
  .items-table tbody td:first-child { font-weight: 500; color: #1a1a1a; }

  /* Totals */
  .totals-section {
    display: flex;
    justify-content: flex-end;
    margin-top: 0;
  }
  .totals-table { width: 260px; border-collapse: collapse; }
  .totals-table td { padding: 8px 12px; font-size: 13px; color: #555; }
  .totals-table td:last-child { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; color: #1a1a1a; }
  .totals-table .grand-total td {
    font-size: 16px;
    font-weight: 800;
    color: #1a1a1a;
    border-top: 2px solid #1a1a1a;
    padding-top: 12px;
  }

  /* Footer */
  .invoice-footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e5e5e5;
    text-align: center;
  }
  .footer-thanks { font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
  .footer-note { font-size: 10px; color: #999; }

  .notes-section { margin-top: 24px; padding: 12px 16px; background: #f9f9f9; border-radius: 6px; border-left: 3px solid #ddd; }
  .notes-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 4px; }
  .notes-text { font-size: 12px; color: #555; }
</style>
</head><body>
<div class="invoice">
  <!-- Header -->
  <div class="invoice-header">
    <div class="brand-section">
      ${store?.logo_url ? `<img src="${store.logo_url}" class="brand-logo" alt="${store?.name || 'Store'}" crossorigin="anonymous" />` : ""}
      <div class="brand-name">${store?.name || "Store"}</div>
      <div class="brand-address">
        ${[store?.location, store?.city, store?.state].filter(Boolean).join(", ")}
        ${store?.owner_email ? `<br/>${store.owner_email}` : ""}
      </div>
    </div>
    <div class="invoice-title-section">
      <div class="invoice-title">Invoice</div>
      <div class="invoice-number">#${order.id.slice(0, 8).toUpperCase()}</div>
    </div>
  </div>

  <!-- Info Grid -->
  <div class="info-grid">
    <div class="info-block">
      <div class="info-label">Bill To</div>
      <div class="info-value">
        <strong>${order.customer_name || "Walk-in Customer"}</strong>
        ${order.customer_phone ? `<br/>${order.customer_phone}` : ""}
        ${order.street_address ? `<br/>${[order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}` : ""}
      </div>
    </div>
    <div class="info-block" style="text-align: right;">
      <div class="info-label">Invoice Details</div>
      <div class="info-value">
        <strong>Date:</strong> ${format(new Date(order.created_at), "dd MMM yyyy")}<br/>
        <strong>Time:</strong> ${format(new Date(order.created_at), "hh:mm a")}<br/>
        <strong>Payment:</strong> ${(order.payment_method || "cod").toUpperCase()}<br/>
        <span class="status-badge status-${order.status}">${order.status}</span>
      </div>
    </div>
  </div>

  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:10%">#</th>
        <th style="width:45%">Item</th>
        <th style="width:10%">Qty</th>
        <th style="width:17%">Price</th>
        <th style="width:18%">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${(order.order_items || []).map((item: any, idx: number) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.product_name}</td>
          <td style="text-align:center">${item.quantity || 1}</td>
          <td>${currencySymbol} ${Number(item.unit_price || item.total / (item.quantity || 1)).toFixed(2)}</td>
          <td>${currencySymbol} ${Number(item.total).toFixed(2)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-section">
    <table class="totals-table">
      <tr>
        <td>Subtotal</td>
        <td>${currencySymbol} ${subtotal.toFixed(2)}</td>
      </tr>
      ${order.total !== subtotal ? `<tr>
        <td>Shipping / Tax</td>
        <td>${currencySymbol} ${(Number(order.total) - subtotal).toFixed(2)}</td>
      </tr>` : ""}
      <tr class="grand-total">
        <td>Total</td>
        <td>${currencySymbol} ${Number(order.total).toFixed(2)}</td>
      </tr>
    </table>
  </div>

  ${order.notes ? `
  <div class="notes-section">
    <div class="notes-label">Notes</div>
    <div class="notes-text">${order.notes}</div>
  </div>` : ""}

  ${order.tracking_number ? `
  <div class="notes-section" style="margin-top:12px; border-left-color: #4a90d9;">
    <div class="notes-label">Tracking</div>
    <div class="notes-text">${order.tracking_number}${order.tracking_url ? ` — <a href="${order.tracking_url}">${order.tracking_url}</a>` : ""}</div>
  </div>` : ""}

  <!-- Footer -->
  <div class="invoice-footer">
    <div class="footer-thanks">Thank you for your purchase!</div>
    <div class="footer-note">This is a computer-generated invoice and does not require a signature.</div>
  </div>
</div>
</body></html>`);
    doc.close();

    // Wait for images to load before printing
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    };
  }, [order, store]);

  const items = order.order_items || [];
  const currency = order.currency || store?.currency || "INR";
  const currencySymbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;
  const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.total || 0), 0);

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    confirmed: "bg-cyan-100 text-cyan-800",
    shipped: "bg-blue-100 text-blue-800",
    delivered: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div ref={printRef} className="rounded-lg border border-border bg-card p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            {store?.logo_url && (
              <img src={store.logo_url} alt={store.name} className="h-12 w-auto object-contain" />
            )}
            <h2 className="text-lg font-bold text-foreground">{store?.name || "Store"}</h2>
            <p className="text-xs text-muted-foreground">
              {[store?.location, store?.city, store?.state].filter(Boolean).join(", ")}
            </p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-extrabold tracking-wider text-foreground">INVOICE</h1>
            <p className="text-xs text-muted-foreground mt-1">#{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        <div className="h-px bg-foreground" />

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Bill To</p>
            <p className="text-sm font-semibold text-foreground">{order.customer_name || "Walk-in Customer"}</p>
            {order.customer_phone && <p className="text-xs text-muted-foreground">{order.customer_phone}</p>}
            {order.street_address && (
              <p className="text-xs text-muted-foreground">
                {[order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Details</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Date:</span> {format(new Date(order.created_at), "dd MMM yyyy, hh:mm a")}
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Payment:</span> {(order.payment_method || "cod").toUpperCase()}
            </p>
            <span className={`inline-block mt-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor[order.status] || "bg-muted text-muted-foreground"}`}>
              {order.status}
            </span>
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-foreground text-background">
                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider w-8">#</th>
                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider">Item</th>
                <th className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider w-12">Qty</th>
                <th className="px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider w-24">Price</th>
                <th className="px-3 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => (
                <tr key={item.id || idx} className={idx % 2 === 1 ? "bg-muted/30" : ""}>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-foreground">{item.product_name}</td>
                  <td className="px-3 py-2.5 text-xs text-center text-muted-foreground">{item.quantity || 1}</td>
                  <td className="px-3 py-2.5 text-xs text-right tabular-nums text-muted-foreground">
                    {currencySymbol} {Number(item.unit_price || item.total / (item.quantity || 1)).toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right tabular-nums font-medium text-foreground">
                    {currencySymbol} {Number(item.total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{currencySymbol} {subtotal.toFixed(2)}</span>
            </div>
            {Number(order.total) !== subtotal && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Shipping / Tax</span>
                <span className="tabular-nums">{currencySymbol} {(Number(order.total) - subtotal).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-foreground pt-2 text-sm font-extrabold text-foreground">
              <span>Total</span>
              <span className="tabular-nums">{currencySymbol} {Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="rounded-md border-l-[3px] border-muted-foreground/30 bg-muted/30 px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
            <p className="text-xs text-muted-foreground">{order.notes}</p>
          </div>
        )}

        {/* Tracking */}
        {order.tracking_number && (
          <div className="rounded-md border-l-[3px] border-primary/50 bg-primary/5 px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Tracking</p>
            <p className="text-xs text-foreground font-mono">{order.tracking_number}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border pt-4 text-center">
          <p className="text-sm font-semibold text-foreground">Thank you for your purchase!</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">This is a computer-generated invoice and does not require a signature.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handlePrint} className="flex-1 gap-2">
          <Printer className="h-4 w-4" />
          Print / Download PDF
        </Button>
        <Button variant="outline" onClick={onClose} className="gap-2">
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
    </div>
  );
}
