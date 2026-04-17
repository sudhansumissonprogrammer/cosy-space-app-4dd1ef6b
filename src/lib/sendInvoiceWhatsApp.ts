import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SendInvoiceArgs {
  order: any;
  store: any;
  ownerEmail?: string;
}

/**
 * Generate a PDF invoice, upload to storage, then open WhatsApp (web/app)
 * with a pre-filled message containing the invoice link.
 * Avoids Meta WhatsApp Business API entirely — works for every store.
 */
export async function sendInvoiceToWhatsApp({ order, store, ownerEmail }: SendInvoiceArgs): Promise<{ success: boolean; error?: string }> {
  try {
    if (!order?.customer_phone) {
      return { success: false, error: "Customer phone number missing" };
    }
    if (!store?.id) {
      return { success: false, error: "Store info missing" };
    }

    // ── 1. Build PDF ──
    const pdf = await buildInvoicePdf(order, store, ownerEmail);
    const pdfBlob = pdf.output("blob");

    // ── 2. Upload to storage ──
    const orderShort = order.order_number ? `${1000 + order.order_number}` : order.id.slice(0, 8);
    const fileName = `${store.id}/invoices/invoice-${orderShort}-${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(fileName, pdfBlob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // ── 3. Signed URL (30 days) ──
    const { data: signed, error: signedErr } = await supabase.storage
      .from("whatsapp-media")
      .createSignedUrl(fileName, 60 * 60 * 24 * 30);

    if (signedErr || !signed?.signedUrl) {
      return { success: false, error: `Could not generate file URL: ${signedErr?.message || "unknown"}` };
    }

    // ── 4. Build WhatsApp deep link & open it ──
    const currency = order.currency || store?.currency || "INR";
    const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;
    const message =
      `Hi ${order.customer_name || "there"}! 👋\n\n` +
      `Here's your invoice for order #${orderShort} from *${store.name}*.\n\n` +
      `💰 Total: ${symbol}${Number(order.total).toFixed(0)}\n` +
      `📄 Invoice: ${signed.signedUrl}\n\n` +
      `Thank you for shopping with us! 🙏`;

    const phone = String(order.customer_phone).replace(/[^\d]/g, "");
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    window.open(waUrl, "_blank", "noopener,noreferrer");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send invoice" };
  }
}

/* ───────────────── PDF Builder (mirrors on-screen invoice) ───────────────── */
async function buildInvoicePdf(order: any, store: any, ownerEmail?: string): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  const items = order.order_items || [];
  const currency = order.currency || store?.currency || "INR";
  const symbol = currency === "INR" ? "Rs." : currency === "USD" ? "$" : currency;
  const subtotal = items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const orderShort = order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8).toUpperCase()}`;

  // ── Pre-load images (logo + product thumbs) as data URLs ──
  const logoData = store?.logo_url ? await urlToDataUrl(store.logo_url) : null;
  const itemImages: (string | null)[] = await Promise.all(
    items.map((it: any) => urlToDataUrl(it.products?.image_url || it.image_url || null))
  );

  // ── Header ──
  let headerY = 14;
  const headerHeight = 22;
  
  // Brand header background
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, headerY, pageW - margin * 2, headerHeight, "F");
  
  // Left side: Logo + Store Name
  let logoX = margin + 3;
  if (logoData) {
    try { 
      doc.addImage(logoData, "JPEG", logoX, headerY + 3, 16, 16); 
      logoX += 19;
    } catch {}
  }
  
  // Store name - bold and prominent
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(25, 25, 25);
  doc.text(store?.name || "Invoice", logoX, headerY + 12);
  
  // Store tagline/address below name
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  const storeAddr = [store?.location, store?.city, store?.state].filter(Boolean).join(", ");
  if (storeAddr) {
    doc.text(storeAddr, logoX, headerY + 17);
  }
  
  // Right side: INVOICE label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text("INVOICE", pageW - margin - 3, headerY + 8, { align: "right" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(orderShort, pageW - margin - 3, headerY + 13, { align: "right" });
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(formatDate(order.created_at), pageW - margin - 3, headerY + 17, { align: "right" });

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, headerY + headerHeight + 2, pageW - margin, headerY + headerHeight + 2);

  // ── Ship To + Payment ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("SHIP TO", margin, 41);
  doc.text("PAYMENT", pageW - margin, 41, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(order.customer_name || "Customer", margin, 47);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let y = 52;
  if (order.customer_phone) { doc.text(order.customer_phone, margin, y); y += 4; }
  const addr = [order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ");
  if (addr) {
    const lines = doc.splitTextToSize(addr, 95);
    doc.text(lines, margin, y);
    y += lines.length * 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text((order.payment_method || "cod").toUpperCase(), pageW - margin, 47, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Status: ${order.status}`, pageW - margin, 52, { align: "right" });

  // ── Items table (with image column) ──
  const tableY = Math.max(y + 6, 66);
  autoTable(doc, {
    startY: tableY,
    head: [["#", "Image", "Item", "Qty", "Price", "Amount"]],
    body: items.map((it: any, idx: number) => [
      String(idx + 1),
      "", // image cell — drawn manually
      it.product_name,
      String(it.quantity || 1),
      `${symbol}${Number(it.unit_price || it.total / (it.quantity || 1)).toFixed(2)}`,
      `${symbol}${Number(it.total).toFixed(2)}`,
    ]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2, valign: "middle", minCellHeight: 14 },
    headStyles: { fillColor: [25, 25, 25], textColor: 255, fontStyle: "bold", minCellHeight: 8 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 16, halign: "center" },
      3: { halign: "center", cellWidth: 14 },
      4: { halign: "right", cellWidth: 26 },
      5: { halign: "right", cellWidth: 26 },
    },
    margin: { left: margin, right: margin },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const img = itemImages[data.row.index];
        if (img) {
          const size = 11;
          const x = data.cell.x + (data.cell.width - size) / 2;
          const cy = data.cell.y + (data.cell.height - size) / 2;
          try { doc.addImage(img, "JPEG", x, cy, size, size); } catch {}
        }
      }
    },
  });

  // ── Totals ──
  const finalY = (doc as any).lastAutoTable.finalY + 6;
  const totalsX = pageW - margin - 60;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("Subtotal", totalsX, finalY);
  doc.text(`${symbol}${subtotal.toFixed(2)}`, pageW - margin, finalY, { align: "right" });

  let tY = finalY + 6;
  if (Number(order.total) !== subtotal) {
    const diff = Number(order.total) - subtotal;
    doc.text(diff < 0 ? "Discount" : "Shipping/Tax", totalsX, tY);
    doc.text(`${symbol}${diff.toFixed(2)}`, pageW - margin, tY, { align: "right" });
    tY += 6;
  }

  doc.setDrawColor(20, 20, 20);
  doc.line(totalsX, tY, pageW - margin, tY);
  tY += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text("Total", totalsX, tY);
  doc.text(`${symbol}${Number(order.total).toFixed(2)}`, pageW - margin, tY, { align: "right" });

  if (order.payment_type === "partial") {
    tY += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(108, 52, 131);
    doc.text("Advance Paid", totalsX, tY);
    doc.text(`${symbol}${Number(order.advance_paid || 0).toFixed(2)}`, pageW - margin, tY, { align: "right" });
    tY += 5;
    doc.text("Balance Due (COD)", totalsX, tY);
    doc.text(`${symbol}${Number(order.balance_due || 0).toFixed(2)}`, pageW - margin, tY, { align: "right" });
  }

  // ── Tracking ──
  if (order.tracking_number) {
    tY += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("TRACKING", margin, tY);
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(order.tracking_number, margin, tY + 5);
  }

  // ── Footer ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text("Thank you for your purchase!", pageW / 2, doc.internal.pageSize.getHeight() - 15, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Computer-generated invoice — no signature required.", pageW / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });

  return doc;
}

/** Fetch a remote image and convert it to a JPEG data URL (safe for jsPDF). */
async function urlToDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatDate(d: string): string {
  try {
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}
