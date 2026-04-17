import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SendInvoiceArgs {
  order: any;
  store: any;
  ownerEmail?: string;
}

/**
 * Generate a PDF invoice for an order, upload it to Supabase storage,
 * and send the public URL to the customer via WhatsApp as a document.
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
    const pdf = buildInvoicePdf(order, store, ownerEmail);
    const pdfBlob = pdf.output("blob");

    // ── 2. Upload to storage (whatsapp-media bucket) ──
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

    // ── 3. Create a signed URL valid for 7 days ──
    const { data: signed, error: signedErr } = await supabase.storage
      .from("whatsapp-media")
      .createSignedUrl(fileName, 60 * 60 * 24 * 7);

    if (signedErr || !signed?.signedUrl) {
      return { success: false, error: `Could not generate file URL: ${signedErr?.message || "unknown"}` };
    }

    // ── 4. Send via WhatsApp ──
    const currency = order.currency || store?.currency || "INR";
    const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;
    const caption = `Hi ${order.customer_name || "there"}! 👋\n\nHere's your invoice for order #${orderShort} from ${store.name}.\n\nTotal: ${symbol}${Number(order.total).toFixed(0)}\n\nThank you for shopping with us! 🙏`;

    const { data, error } = await supabase.functions.invoke("whatsapp-send", {
      body: {
        store_id: store.id,
        recipient_phone: order.customer_phone,
        recipient_name: order.customer_name || null,
        message_body: caption,
        message_type: "invoice",
        order_id: order.id,
        media_url: signed.signedUrl,
        media_type: "document",
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    if (data?.error) {
      return { success: false, error: data.error };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send invoice" };
  }
}

/* ───────────────── PDF Builder ───────────────── */
function buildInvoicePdf(order: any, store: any, ownerEmail?: string): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  const items = order.order_items || [];
  const currency = order.currency || store?.currency || "INR";
  const symbol = currency === "INR" ? "Rs." : currency === "USD" ? "$" : currency;
  const subtotal = items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const orderShort = order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8).toUpperCase()}`;

  // Header — store name & invoice tag
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(store?.name || "Invoice", margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const storeAddr = [store?.location, store?.city, store?.state].filter(Boolean).join(", ");
  if (storeAddr) doc.text(storeAddr, margin, 28);
  if (ownerEmail) doc.text(ownerEmail, margin, 33);

  // Invoice tag (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text("INVOICE", pageW - margin, 22, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(orderShort, pageW - margin, 28, { align: "right" });
  doc.setFontSize(9);
  doc.text(formatDate(order.created_at), pageW - margin, 33, { align: "right" });

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, 38, pageW - margin, 38);

  // Bill To
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text("BILL TO", margin, 47);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  let y = 53;
  doc.text(order.customer_name || "Customer", margin, y);
  if (order.customer_phone) { y += 5; doc.text(order.customer_phone, margin, y); }
  const addr = [order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ");
  if (addr) {
    y += 5;
    const lines = doc.splitTextToSize(addr, 90);
    doc.text(lines, margin, y);
    y += (lines.length - 1) * 5;
  }

  // Payment & status (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text("PAYMENT", pageW - margin, 47, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text((order.payment_method || "cod").toUpperCase(), pageW - margin, 53, { align: "right" });
  doc.text(`Status: ${order.status}`, pageW - margin, 58, { align: "right" });

  // Items table
  const tableY = Math.max(y + 8, 72);
  autoTable(doc, {
    startY: tableY,
    head: [["#", "Item", "Qty", "Price", "Amount"]],
    body: items.map((it: any, idx: number) => [
      String(idx + 1),
      it.product_name,
      String(it.quantity || 1),
      `${symbol}${Number(it.unit_price || it.total / (it.quantity || 1)).toFixed(2)}`,
      `${symbol}${Number(it.total).toFixed(2)}`,
    ]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [25, 25, 25], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "right", cellWidth: 30 },
      4: { halign: "right", cellWidth: 30 },
    },
    margin: { left: margin, right: margin },
  });

  // Totals
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

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text("Thank you for your purchase!", pageW / 2, doc.internal.pageSize.getHeight() - 15, { align: "center" });
  doc.setFontSize(7);
  doc.text("Computer-generated invoice — no signature required.", pageW / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });

  return doc;
}

function formatDate(d: string): string {
  try {
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}
