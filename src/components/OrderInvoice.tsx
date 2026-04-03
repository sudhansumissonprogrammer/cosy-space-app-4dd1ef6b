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

  const items = order.order_items || [];
  const currency = order.currency || store?.currency || "INR";
  const currencySymbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;
  const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.total || 0), 0);

  const handlePrint = useCallback(() => {
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
<html><head><title>Label ${order.order_number ? '#' + (1000 + order.order_number) : '#' + order.id.slice(0, 8).toUpperCase()}</title>
<link href="https://fonts.googleapis.com/css2?family=Changa:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: 100mm 150mm; margin: 3mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Changa', sans-serif;
    font-weight: 400;
    color: #000;
    line-height: 1.4;
    font-size: 9px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .label { width: 94mm; padding: 2mm 0; }

  /* Header */
  .label-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 3mm;
    border-bottom: 1.5px solid #000;
    margin-bottom: 3mm;
  }
  .brand-row { display: flex; align-items: center; gap: 2mm; }
  .brand-logo { height: 40px; width: auto; object-fit: contain; }
  .brand-contact { font-size: 7.5px; color: #444; margin-top: 2px; }
  .inv-tag { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
  .inv-id { font-size: 8px; color: #555; margin-top: 1px; text-align: right; }

  /* Sections */
  .row { display: flex; gap: 3mm; margin-bottom: 2.5mm; }
  .col { flex: 1; }
  .sec-label { font-size: 7px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 1mm; }
  .sec-val { font-size: 9px; color: #111; line-height: 1.5; }
  .sec-val strong { font-weight: 600; }
  .sec-val-right { text-align: right; }

  .badge {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 2px;
    font-size: 7.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    border: 1px solid #000;
  }
   .badge-pending { background: #fff3cd; color: #856404; border-color: #856404; }
   .badge-confirmed { background: #d1ecf1; color: #0c5460; border-color: #0c5460; }
   .badge-shipped { background: #cce5ff; color: #004085; border-color: #004085; }
   .badge-delivered { background: #d4edda; color: #155724; border-color: #155724; }
   .badge-cancelled { background: #f8d7da; color: #721c24; border-color: #721c24; }
   .badge-partially_paid { background: #e8daef; color: #6c3483; border-color: #6c3483; }

  /* Divider */
  .divider { border: none; border-top: 1px dashed #aaa; margin: 2.5mm 0; }

  /* Items Table */
  .items-tbl { width: 100%; border-collapse: collapse; }
  .items-tbl th {
    font-size: 7.5px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #fff;
    background: #1a1a1a;
    padding: 3px 4px;
    text-align: left;
  }
  .items-tbl th.r { text-align: right; }
  .items-tbl th.c { text-align: center; }
  .items-tbl td {
    font-size: 8.5px;
    padding: 3px 4px;
    border-bottom: 0.5px solid #ddd;
    color: #222;
  }
  .items-tbl td.r { text-align: right; font-variant-numeric: tabular-nums; }
  .items-tbl td.c { text-align: center; }
  .items-tbl td.name { font-weight: 600; max-width: 40mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .items-tbl tr:nth-child(even) { background: #f5f5f5; }

  /* Totals */
  .totals { display: flex; justify-content: flex-end; margin-top: 1.5mm; }
  .totals-tbl { width: 45mm; border-collapse: collapse; }
  .totals-tbl td { padding: 2px 4px; font-size: 8.5px; color: #444; }
  .totals-tbl td.r { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; color: #111; }
  .totals-tbl .grand td {
    font-size: 10px;
    font-weight: 600;
    color: #000;
    border-top: 1.5px solid #000;
    padding-top: 2mm;
  }

  /* Footer */
  .label-footer {
    margin-top: 3mm;
    padding-top: 2mm;
    border-top: 1px solid #ccc;
    text-align: center;
  }
  .footer-txt { font-size: 7.5px; color: #888; }
  .footer-bold { font-size: 8.5px; font-weight: 700; color: #222; margin-bottom: 1px; }
</style>
</head><body>
<div class="label">
  <!-- Header -->
  <div class="label-header">
    <div>
      <div class="brand-row">
        ${store?.logo_url ? `<img src="${store.logo_url}" class="brand-logo" crossorigin="anonymous" />` : ""}
      </div>
      <div class="brand-contact">${[store?.location, store?.city, store?.state].filter(Boolean).join(", ")}${store?.owner_email ? ` | ${store.owner_email}` : ""}</div>
    </div>
    <div>
      <div class="inv-tag">Invoice</div>
      <div class="inv-id">${order.order_number ? '#' + (1000 + order.order_number) : '#' + order.id.slice(0, 8).toUpperCase()}</div>
    </div>
  </div>

  <!-- Ship To + Order Info -->
  <div class="row">
    <div class="col">
      <div class="sec-label">Ship To</div>
      <div class="sec-val">
        <strong>${order.customer_name || "Customer"}</strong><br/>
        ${order.customer_phone ? `${order.customer_phone}<br/>` : ""}
        ${order.street_address ? `${[order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}` : ""}
      </div>
    </div>
    <div class="col">
      <div class="sec-label sec-val-right">Order Info</div>
      <div class="sec-val sec-val-right">
        ${format(new Date(order.created_at), "dd MMM yyyy, hh:mm a")}<br/>
        <strong>${(order.payment_method || "cod").toUpperCase()}</strong>
        &nbsp;<span class="badge badge-${order.status}">${order.status}</span>
      </div>
    </div>
  </div>

  <hr class="divider"/>

  <!-- Items -->
  <table class="items-tbl">
    <thead>
      <tr>
        <th style="width:7%">#</th>
        <th>Item</th>
        <th class="c" style="width:10%">Qty</th>
        <th class="r" style="width:18%">Price</th>
        <th class="r" style="width:20%">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item: any, idx: number) => `
        <tr>
          <td>${idx + 1}</td>
          <td class="name">${item.product_name}</td>
          <td class="c">${item.quantity || 1}</td>
          <td class="r">${currencySymbol}${Number(item.unit_price || item.total / (item.quantity || 1)).toFixed(2)}</td>
          <td class="r">${currencySymbol}${Number(item.total).toFixed(2)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <table class="totals-tbl">
      <tr><td>Subtotal</td><td class="r">${currencySymbol}${subtotal.toFixed(2)}</td></tr>
      ${Number(order.total) !== subtotal ? `<tr><td>${(Number(order.total) - subtotal) < 0 ? 'Discount' : 'Shipping/Tax'}</td><td class="r">${currencySymbol}${(Number(order.total) - subtotal).toFixed(2)}</td></tr>` : ""}
      <tr class="grand"><td>Total</td><td class="r">${currencySymbol}${Number(order.total).toFixed(2)}</td></tr>
      ${order.payment_type === "partial" ? `
      <tr><td style="color:#6c3483;font-weight:600;">Advance Paid</td><td class="r" style="color:#155724;font-weight:600;">${currencySymbol}${Number(order.advance_paid || 0).toFixed(2)}</td></tr>
      <tr><td style="color:#6c3483;font-weight:600;">Balance Due (COD)</td><td class="r" style="font-weight:600;">${currencySymbol}${Number(order.balance_due || 0).toFixed(2)}</td></tr>
      ` : ""}
    </table>
  </div>

  ${order.tracking_number ? `
  <hr class="divider"/>
  <div class="row">
    <div class="col">
      <div class="sec-label">Tracking</div>
      <div class="sec-val" style="font-family:monospace;font-size:8px;">${order.tracking_number}</div>
    </div>
  </div>` : ""}

  <!-- Footer -->
  <div class="label-footer">
    <div class="footer-bold">Thank you!</div>
    <div class="footer-txt">Computer generated — no signature required</div>
  </div>
</div>
</body></html>`);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    };
  }, [order, store, currencySymbol, subtotal]);

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-300",
    confirmed: "bg-cyan-100 text-cyan-800 border-cyan-300",
    shipped: "bg-blue-100 text-blue-800 border-blue-300",
    delivered: "bg-emerald-100 text-emerald-800 border-emerald-300",
    cancelled: "bg-red-100 text-red-800 border-red-300",
    partially_paid: "bg-purple-100 text-purple-800 border-purple-300",
  };

  return (
    <div className="space-y-4">
      {/* Compact Preview (matches 4x6 label feel) */}
      <div ref={printRef} className="rounded-lg border border-border bg-card p-4 space-y-3 max-w-[380px] mx-auto text-xs" style={{ fontFamily: "'Changa', sans-serif", fontWeight: 400 }}>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b-2 border-foreground">
          <div className="flex items-center gap-2">
            {store?.logo_url && (
              <img src={store.logo_url} alt="Store logo" className="h-10 w-auto object-contain" />
            )}
            <div>
              <p className="text-[9px] text-muted-foreground leading-tight">
                {[store?.location, store?.city, store?.state].filter(Boolean).join(", ")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold tracking-widest text-foreground">INVOICE</p>
            <p className="text-[8px] text-muted-foreground">{order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8).toUpperCase()}`}</p>
          </div>
        </div>

        {/* Ship To + Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[8px] font-medium uppercase tracking-widest text-muted-foreground mb-0.5">Ship To</p>
            <p className="text-[11px] font-semibold text-foreground">{order.customer_name || "Customer"}</p>
            {order.customer_phone && <p className="text-[9px] text-muted-foreground">{order.customer_phone}</p>}
            {order.street_address && (
              <p className="text-[9px] text-muted-foreground leading-tight">
                {[order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Details</p>
            <p className="text-[9px] text-muted-foreground">
              {format(new Date(order.created_at), "dd MMM yyyy, hh:mm a")}
            </p>
            <p className="text-[9px] text-muted-foreground">
              <span className="font-semibold text-foreground">{(order.payment_method || "cod").toUpperCase()}</span>
            </p>
            <span className={`inline-block mt-0.5 rounded px-1.5 py-px text-[8px] font-bold uppercase border ${statusColor[order.status] || "bg-muted text-muted-foreground border-border"}`}>
              {order.status}
            </span>
          </div>
        </div>

        {/* Items */}
        <div className="overflow-hidden rounded border border-border">
          <table className="w-full">
            <thead>
              <tr className="bg-foreground text-background">
                <th className="px-1.5 py-1 text-left text-[7px] font-medium uppercase tracking-wider w-5">#</th>
                <th className="px-1.5 py-1 text-left text-[7px] font-medium uppercase tracking-wider">Item</th>
                <th className="px-1.5 py-1 text-center text-[7px] font-medium uppercase tracking-wider w-8">Qty</th>
                <th className="px-1.5 py-1 text-right text-[7px] font-medium uppercase tracking-wider w-16">Price</th>
                <th className="px-1.5 py-1 text-right text-[7px] font-medium uppercase tracking-wider w-16">Amt</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => (
                <tr key={item.id || idx} className={idx % 2 === 1 ? "bg-muted/30" : ""}>
                  <td className="px-1.5 py-1 text-[9px] text-muted-foreground">{idx + 1}</td>
                  <td className="px-1.5 py-1 text-[9px] font-medium text-foreground truncate max-w-[120px]">{item.product_name}</td>
                  <td className="px-1.5 py-1 text-[9px] text-center text-muted-foreground">{item.quantity || 1}</td>
                  <td className="px-1.5 py-1 text-[9px] text-right tabular-nums text-muted-foreground">
                    {currencySymbol}{Number(item.unit_price || item.total / (item.quantity || 1)).toFixed(2)}
                  </td>
                  <td className="px-1.5 py-1 text-[9px] text-right tabular-nums font-medium text-foreground">
                    {currencySymbol}{Number(item.total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-40 space-y-0.5">
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{currencySymbol}{subtotal.toFixed(2)}</span>
            </div>
            {Number(order.total) !== subtotal && (
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>{(Number(order.total) - subtotal) < 0 ? 'Discount' : 'Shipping/Tax'}</span>
                <span className="tabular-nums">{currencySymbol}{(Number(order.total) - subtotal).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-foreground pt-1 text-[11px] font-semibold text-foreground">
              <span>Total</span>
              <span className="tabular-nums">{currencySymbol}{Number(order.total).toFixed(2)}</span>
            </div>
            {order.payment_type === "partial" && (
              <>
                <div className="flex justify-between text-[9px] mt-1">
                  <span className="text-purple-700 dark:text-purple-400 font-semibold">Advance Paid</span>
                  <span className="tabular-nums text-emerald-600 font-semibold">{currencySymbol}{Number(order.advance_paid || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-purple-700 dark:text-purple-400 font-semibold">Balance Due (COD)</span>
                  <span className="tabular-nums font-semibold text-foreground">{currencySymbol}{Number(order.balance_due || 0).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tracking */}
        {order.tracking_number && (
          <div className="rounded border-l-2 border-primary/50 bg-primary/5 px-2 py-1.5">
            <p className="text-[7px] font-bold uppercase tracking-widest text-muted-foreground">Tracking</p>
            <p className="text-[9px] text-foreground font-mono">{order.tracking_number}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border pt-2 text-center">
          <p className="text-[9px] font-medium text-foreground">Thank you!</p>
          <p className="text-[7px] text-muted-foreground">Computer generated — no signature required</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 max-w-[380px] mx-auto">
        <Button onClick={handlePrint} className="flex-1 gap-2" size="sm">
          <Printer className="h-3.5 w-3.5" />
          Print Label
        </Button>
        <Button variant="outline" onClick={onClose} size="sm" className="gap-2">
          <X className="h-3.5 w-3.5" />
          Close
        </Button>
      </div>
    </div>
  );
}
