import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SendInvoiceArgs {
  order: any;
  store: any;
  ownerEmail?: string;
}

/**
 * Generate a PDF invoice (matches the on-screen 4x6 label design) and share it
 * directly to WhatsApp as a file using the Web Share API. Falls back to
 * uploading + wa.me link when file sharing is unavailable.
 */
export async function sendInvoiceToWhatsApp({ order, store, ownerEmail }: SendInvoiceArgs): Promise<{ success: boolean; error?: string }> {
  try {
    if (!order?.customer_phone) {
      return { success: false, error: "Customer phone number missing" };
    }
    if (!store?.id) {
      return { success: false, error: "Store info missing" };
    }

    // ── Format phone (with +91 default for India) ──
    let phone = String(order.customer_phone).replace(/[^\d]/g, "");
    if (phone.startsWith("91") && phone.length === 12) {
      // already prefixed
    } else if (phone.length === 10) {
      phone = "91" + phone;
    } else if (phone.length < 10) {
      return { success: false, error: "Invalid phone number" };
    }

    // ── Build PDF (mirrors the on-screen label design) ──
    const pdf = await buildInvoicePdf(order, store, ownerEmail);
    const pdfBlob = pdf.output("blob");
    const orderShort = order.order_number ? `${1000 + order.order_number}` : order.id.slice(0, 8).toUpperCase();
    const fileName = `Invoice-${orderShort}.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });

    const currency = order.currency || store?.currency || "INR";
    const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;
    const shortMessage =
      `Hi ${order.customer_name || "there"}! 👋\n\n` +
      `Here's your invoice for order #${orderShort} from *${store.name}*.\n\n` +
      `💰 Total: ${symbol}${Number(order.total).toFixed(0)}\n\n` +
      `Thank you for shopping with us! 🙏`;

    // ── Strategy 1: Web Share API with file (mobile / modern browsers) ──
    const navAny = navigator as any;
    if (navAny.canShare && navAny.canShare({ files: [pdfFile] })) {
      try {
        await navAny.share({
          files: [pdfFile],
          title: `Invoice ${orderShort}`,
          text: shortMessage,
        });
        return { success: true };
      } catch (shareErr: any) {
        // User cancelled — treat as success (don't fall back)
        if (shareErr?.name === "AbortError") return { success: true };
        // Otherwise fall through to upload-link fallback
      }
    }

    // ── Strategy 2: Fallback — upload PDF, share signed URL via wa.me ──
    const uploadPath = `${store.id}/invoices/invoice-${orderShort}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(uploadPath, pdfBlob, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      // Last resort: trigger browser download so the user can attach manually
      triggerDownload(pdfBlob, fileName);
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(shortMessage + "\n\n📎 Invoice PDF downloaded — please attach it in WhatsApp.")}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
      return { success: true };
    }

    const { data: signed } = await supabase.storage
      .from("whatsapp-media")
      .createSignedUrl(uploadPath, 60 * 60 * 24 * 30);

    const linkMessage = signed?.signedUrl
      ? `${shortMessage}\n\n📄 Invoice: ${signed.signedUrl}`
      : shortMessage;

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(linkMessage)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send invoice" };
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {}
}

/* ───────────────── PDF Builder — mirrors on-screen 4x6 label invoice ───────────────── */
async function buildInvoicePdf(order: any, store: any, ownerEmail?: string): Promise<jsPDF> {
  // 100mm x 150mm — same as print label format
  const doc = new jsPDF({ unit: "mm", format: [100, 150] });
  const pageW = 100;
  const pageH = 150;
  const margin = 4;

  const items = order.order_items || [];
  const currency = order.currency || store?.currency || "INR";
  const symbol = currency === "INR" ? "Rs." : currency === "USD" ? "$" : currency;
  const subtotal = items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const orderShort = order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8).toUpperCase()}`;

  // Pre-load logo + product thumbs
  const logoData = store?.logo_url ? await urlToDataUrl(store.logo_url) : null;
  const itemImages: (string | null)[] = await Promise.all(
    items.map((it: any) => urlToDataUrl(it.products?.image_url || it.image_url || null))
  );

  // ── Header ──
  let y = margin + 2;

  // Logo (left) + INVOICE label (right)
  if (logoData) {
    try { doc.addImage(logoData, "JPEG", margin, y, 14, 14); } catch {}
  }

  // Store name (next to logo, or alone if no logo)
  const nameX = logoData ? margin + 16 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(store?.name || "Store", nameX, y + 6);

  // Address line under name
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(110, 110, 110);
  const storeAddr = [store?.location, store?.city, store?.state].filter(Boolean).join(", ");
  if (storeAddr) {
    const addrLine = ownerEmail ? `${storeAddr} | ${ownerEmail}` : storeAddr;
    doc.text(addrLine.slice(0, 60), nameX, y + 10);
  }

  // INVOICE label (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text("INVOICE", pageW - margin, y + 5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(orderShort, pageW - margin, y + 9, { align: "right" });

  // Header divider
  y += 16;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 3;

  // ── Ship To + Order Info ──
  const colW = (pageW - margin * 2) / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(130, 130, 130);
  doc.text("SHIP TO", margin, y);
  doc.text("ORDER INFO", pageW - margin, y, { align: "right" });

  y += 3.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);
  doc.text(order.customer_name || "Customer", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(formatDate(order.created_at), pageW - margin, y, { align: "right" });

  y += 3.5;
  if (order.customer_phone) {
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(order.customer_phone, margin, y);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(20, 20, 20);
  doc.text((order.payment_method || "cod").toUpperCase(), pageW - margin, y, { align: "right" });

  y += 3.5;
  const addr = [order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ");
  if (addr) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(addr, colW - 2);
    doc.text(lines, margin, y);
    y += lines.length * 2.8;
  }

  // Status badge (right side, under payment method)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(60, 60, 60);
  doc.text(`Status: ${String(order.status).toUpperCase()}`, pageW - margin, y, { align: "right" });

  y += 2;
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.setDrawColor(170, 170, 170);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineDashPattern([], 0);
  y += 2;

  // ── Items table (with image column, matching screen) ──
  autoTable(doc, {
    startY: y,
    head: [["#", "Img", "Item", "Qty", "Price", "Amt"]],
    body: items.map((it: any, idx: number) => [
      String(idx + 1),
      "",
      it.product_name,
      String(it.quantity || 1),
      `${symbol}${Number(it.unit_price || it.total / (it.quantity || 1)).toFixed(2)}`,
      `${symbol}${Number(it.total).toFixed(2)}`,
    ]),
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.2, valign: "middle", minCellHeight: 9 },
    headStyles: { fillColor: [25, 25, 25], textColor: 255, fontStyle: "bold", fontSize: 6.5, minCellHeight: 5 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 5, halign: "center" },
      1: { cellWidth: 9, halign: "center" },
      3: { halign: "center", cellWidth: 7 },
      4: { halign: "right", cellWidth: 14 },
      5: { halign: "right", cellWidth: 14 },
    },
    margin: { left: margin, right: margin },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const img = itemImages[data.row.index];
        if (img) {
          const size = 7;
          const x = data.cell.x + (data.cell.width - size) / 2;
          const cy = data.cell.y + (data.cell.height - size) / 2;
          try { doc.addImage(img, "JPEG", x, cy, size, size); } catch {}
        }
      }
    },
  });

  // ── Totals ──
  let finalY = (doc as any).lastAutoTable.finalY + 3;
  const totalsLabelX = pageW - margin - 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text("Subtotal", totalsLabelX, finalY);
  doc.text(`${symbol}${subtotal.toFixed(2)}`, pageW - margin, finalY, { align: "right" });

  if (Number(order.total) !== subtotal) {
    finalY += 4;
    const diff = Number(order.total) - subtotal;
    doc.text(diff < 0 ? "Discount" : "Shipping/Tax", totalsLabelX, finalY);
    doc.text(`${symbol}${diff.toFixed(2)}`, pageW - margin, finalY, { align: "right" });
  }

  finalY += 2;
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.4);
  doc.line(totalsLabelX, finalY, pageW - margin, finalY);
  finalY += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text("Total", totalsLabelX, finalY);
  doc.text(`${symbol}${Number(order.total).toFixed(2)}`, pageW - margin, finalY, { align: "right" });

  if (order.payment_type === "partial") {
    finalY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(108, 52, 131);
    doc.text("Advance Paid", totalsLabelX, finalY);
    doc.text(`${symbol}${Number(order.advance_paid || 0).toFixed(2)}`, pageW - margin, finalY, { align: "right" });
    finalY += 3.5;
    doc.text("Balance Due (COD)", totalsLabelX, finalY);
    doc.text(`${symbol}${Number(order.balance_due || 0).toFixed(2)}`, pageW - margin, finalY, { align: "right" });
  }

  // ── Tracking ──
  if (order.tracking_number) {
    finalY += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text("TRACKING", margin, finalY);
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.setTextColor(20, 20, 20);
    doc.text(order.tracking_number, margin, finalY + 3);
  }

  // ── Footer ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);
  doc.text("Thank you!", pageW / 2, pageH - 6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  doc.text("Computer-generated — no signature required.", pageW / 2, pageH - 3, { align: "center" });

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
