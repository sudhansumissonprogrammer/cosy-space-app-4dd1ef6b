import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { waPhoneNumber } from "@/lib/phoneUtils";

interface SendInvoiceArgs {
  order: any;
  store: any;
  ownerEmail?: string;
}

const INVOICE_FONT_URL = "/fonts/outfit-variable.ttf";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function installInvoiceFont(doc: jsPDF): Promise<string> {
  try {
    const response = await fetch(INVOICE_FONT_URL);
    if (!response.ok) return "helvetica";
    const base64 = bytesToBase64(new Uint8Array(await response.arrayBuffer()));
    doc.addFileToVFS("Outfit.ttf", base64);
    doc.addFont("Outfit.ttf", "Outfit", "normal");
    doc.addFont("Outfit.ttf", "Outfit", "bold");
    return "Outfit";
  } catch {
    return "helvetica";
  }
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

    // ── Format phone (adds +91 country code when the owner saved a bare number) ──
    const phone = waPhoneNumber(order.customer_phone);
    if (!phone) {
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

/**
 * Generate the invoice PDF and trigger an instant browser download.
 * No modal, no preview — used by the storefront "Download Invoice" button.
 */
export async function downloadInvoicePdf({ order, store, ownerEmail }: SendInvoiceArgs): Promise<{ success: boolean; error?: string }> {
  try {
    const pdf = await buildInvoicePdf(order, store, ownerEmail);
    const orderShort = order.order_number ? `${1000 + order.order_number}` : order.id.slice(0, 8).toUpperCase();
    const fileName = `Invoice-${orderShort}.pdf`;
    triggerDownload(pdf.output("blob"), fileName);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to generate invoice" };
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
export async function buildInvoicePdf(order: any, store: any, ownerEmail?: string): Promise<jsPDF> {
  // 100mm x 150mm — same as print label format
  const doc = new jsPDF({ unit: "mm", format: [100, 150] });
  const pageW = 100;
  const pageH = 150;
  const margin = 4;
  const invoiceFont = await installInvoiceFont(doc);

  const items = order.order_items || [];
  const currency = order.currency || store?.currency || "INR";
  // Note: jsPDF's built-in Helvetica (WinAnsi) does not include ₹ (U+20B9).
  // Use "Rs." for INR inside the PDF to avoid rendering a .notdef glyph.
  const symbol = currency === "INR" ? (invoiceFont === "Outfit" ? "₹" : "Rs.") : currency === "USD" ? "$" : currency;
  const subtotal = items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const orderShort = order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8).toUpperCase()}`;

  // Pre-load the store logo only; product images are intentionally omitted.
  const logoData = store?.logo_url ? await urlToPdfImage(store.logo_url) : null;

  // ── Header ──
  let y = margin + 2;

  // Logo (left) + INVOICE label (right)
  if (logoData) {
    try { doc.addImage(logoData.data, logoData.format, margin, y, 14, 14); } catch {}
  }

  // Store name (next to logo, or alone if no logo)
  const nameX = logoData ? margin + 16 : margin;
  doc.setFont(invoiceFont, "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(store?.name || "Store", nameX, y + 6);

  // Address line under name
  doc.setFont(invoiceFont, "normal");
  doc.setFontSize(6);
  doc.setTextColor(45, 45, 45);
  const storeAddr = [store?.location, store?.city, store?.state].filter(Boolean).join(", ");
  if (storeAddr) {
    const addrLine = ownerEmail ? `${storeAddr} | ${ownerEmail}` : storeAddr;
    doc.text(addrLine.slice(0, 60), nameX, y + 10);
  }

  // INVOICE label (right)
  doc.setFont(invoiceFont, "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text("INVOICE", pageW - margin, y + 5, { align: "right" });
  doc.setFont(invoiceFont, "normal");
  doc.setFontSize(7);
  doc.setTextColor(35, 35, 35);
  doc.text(orderShort, pageW - margin, y + 9, { align: "right" });

  // Header divider
  y += 16;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 3;

  // ── Ship To + Order Info ──
  const colW = (pageW - margin * 2) / 2;

  doc.setFont(invoiceFont, "bold");
  doc.setFontSize(6);
  doc.setTextColor(35, 35, 35);
  doc.text("SHIP TO", margin, y);
  doc.text("ORDER INFO", pageW - margin, y, { align: "right" });

  y += 3.5;
  doc.setFont(invoiceFont, "bold");
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);
  doc.text(order.customer_name || "Customer", margin, y);
  doc.setFont(invoiceFont, "normal");
  doc.setFontSize(7);
  doc.setTextColor(25, 25, 25);
  doc.text(formatDate(order.created_at), pageW - margin, y, { align: "right" });

  y += 3.5;
  if (order.customer_phone) {
    doc.setFontSize(7);
    doc.setTextColor(25, 25, 25);
    doc.text(order.customer_phone, margin, y);
  }
  doc.setFont(invoiceFont, "bold");
  doc.setFontSize(7);
  doc.setTextColor(20, 20, 20);
  doc.text((order.payment_method || "cod").toUpperCase(), pageW - margin, y, { align: "right" });

  y += 3.5;
  const addr = [order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ");
  if (addr) {
    doc.setFont(invoiceFont, "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(25, 25, 25);
    const lines = doc.splitTextToSize(addr, colW - 2);
    doc.text(lines, margin, y);
    y += lines.length * 2.8;
  }

  // Status badge (right side, under payment method)
  doc.setFont(invoiceFont, "bold");
  doc.setFontSize(6);
  doc.setTextColor(20, 20, 20);
  doc.text(`Status: ${String(order.status).toUpperCase()}`, pageW - margin, y, { align: "right" });

  y += 2;
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.setDrawColor(170, 170, 170);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineDashPattern([], 0);
  y += 2;

  // ── Items table ──
  autoTable(doc, {
    startY: y,
    head: [["#", "Item", "Qty", "Price", "Amt"]],
    body: items.map((it: any, idx: number) => [
      String(idx + 1),
      it.product_name,
      String(it.quantity || 1),
      `${symbol} ${Number(it.unit_price || it.total / (it.quantity || 1)).toFixed(2)}`,
      `${symbol} ${Number(it.total).toFixed(2)}`,
    ]),
    styles: { font: invoiceFont, fontSize: 7, cellPadding: 1.2, valign: "middle", textColor: [10, 10, 10], minCellHeight: 7 },
    headStyles: { fillColor: [25, 25, 25], textColor: 255, fontStyle: "bold", fontSize: 6.5, minCellHeight: 5 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 5, halign: "center" },
      2: { halign: "center", cellWidth: 8 },
      3: { halign: "right", cellWidth: 20, fontSize: 6.5 },
      4: { halign: "right", cellWidth: 20, fontSize: 6.5 },
    },
    margin: { left: margin, right: margin },
  });

  // ── Totals ──
  let finalY = (doc as any).lastAutoTable.finalY + 3;
  const totalsLeft = pageW - margin - 48;
  const totalsValueX = pageW - margin;
  const totalsLabelWidth = 29;

  doc.setFont(invoiceFont, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(20, 20, 20);
  doc.text("Subtotal", totalsLeft, finalY);
  doc.text(`${symbol} ${subtotal.toFixed(2)}`, totalsValueX, finalY, { align: "right" });

  if (Number(order.total) !== subtotal) {
    finalY += 4;
    const diff = Number(order.total) - subtotal;
    doc.text(diff < 0 ? "Discount" : "Shipping/Tax", totalsLeft, finalY);
    doc.text(`${symbol} ${diff.toFixed(2)}`, totalsValueX, finalY, { align: "right" });
  }

  finalY += 2;
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.4);
  doc.line(totalsLeft, finalY, totalsValueX, finalY);
  finalY += 4;

  doc.setFont(invoiceFont, "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text("Total", totalsLeft, finalY);
  doc.text(`${symbol} ${Number(order.total).toFixed(2)}`, totalsValueX, finalY, { align: "right" });

  if (order.payment_type === "partial") {
    finalY += 5;
    doc.setFont(invoiceFont, "normal");
    doc.setFontSize(7);
    doc.setTextColor(108, 52, 131);
    doc.text("Advance Paid", totalsLeft, finalY, { maxWidth: totalsLabelWidth });
    doc.text(`${symbol} ${Number(order.advance_paid || 0).toFixed(2)}`, totalsValueX, finalY, { align: "right" });
    finalY += 4;
    doc.setFont(invoiceFont, "bold");
    doc.text("Balance Due (COD)", totalsLeft, finalY, { maxWidth: totalsLabelWidth });
    doc.text(`${symbol} ${Number(order.balance_due || 0).toFixed(2)}`, totalsValueX, finalY, { align: "right" });
  }

  // ── Tracking ──
  if (order.tracking_number) {
    finalY += 6;
    doc.setFont(invoiceFont, "bold");
    doc.setFontSize(6);
    doc.setTextColor(35, 35, 35);
    doc.text("TRACKING", margin, finalY);
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.setTextColor(20, 20, 20);
    doc.text(order.tracking_number, margin, finalY + 3);
  }

  // ── Footer ──
  doc.setFont(invoiceFont, "bold");
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);
  doc.text("Thank you!", pageW / 2, pageH - 6, { align: "center" });
  doc.setFont(invoiceFont, "normal");
  doc.setFontSize(6);
  doc.setTextColor(45, 45, 45);
  doc.text("Computer-generated — no signature required.", pageW / 2, pageH - 3, { align: "center" });

  return doc;
}

/** Fetch a remote image and convert it to a JPEG data URL (safe for jsPDF). */
async function urlToPdfImage(url: string | null | undefined): Promise<{ data: string; format: "JPEG" | "PNG" } | null> {
  if (!url) return null;
  try {
    const normalized = new URL(url, window.location.origin).href;
    const candidates = [normalized];
    if (new URL(normalized).origin !== window.location.origin) {
      candidates.push(`${window.location.origin}/cf-img?url=${encodeURIComponent(normalized)}&w=320&q=82`);
    }
    let res: Response | null = null;
    for (const candidate of candidates) {
      try {
        const attempt = await fetch(candidate, { mode: "cors", credentials: "omit" });
        if (attempt.ok) {
          res = attempt;
          break;
        }
      } catch { /* try the same-origin image proxy next */ }
    }
    if (!res) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    const maxSize = 320;
    const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return { data: canvas.toDataURL("image/jpeg", 0.86), format: "JPEG" };
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
