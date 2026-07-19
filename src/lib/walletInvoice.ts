/**
 * Branded ShopBanao wallet recharge / credit-note invoice.
 * Produces a single-page A4 PDF using jsPDF (no html2canvas — keeps bundle small).
 *
 * Used from:
 *  - Store dashboard wallet page (merchant downloads their own recharge invoice)
 *  - Super-admin Manage-Store → Wallet tab (admin downloads invoice for any
 *    recharge or credit-note for a manual admin credit adjustment)
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND = {
  name: "ShopBanao",
  legal: "ShopBanao (Operated by Storivo Technologies)",
  website: "shopbanao.in",
  email: "support@shopbanao.in",
  address: "Bhubaneswar, Odisha, India",
};

const GST_RATE = 0.18; // 18% IGST on SaaS services (recharge = advance for commission service)

export type WalletInvoiceKind = "recharge" | "credit_note";

export interface WalletInvoiceInput {
  kind: WalletInvoiceKind;
  // Source row (recharge row OR ledger row for admin credit)
  id: string;
  createdAt: string | Date;
  amount: number; // gross amount in INR
  paymentMethod?: string | null;
  paymentRef?: string | null;
  notes?: string | null;
  store: {
    name?: string | null;
    slug?: string | null;
    owner_email?: string | null;
    city?: string | null;
    state?: string | null;
    location?: string | null;
    whatsapp_number?: string | null;
  };
}

function inr(n: number) {
  return `₹${n.toFixed(2)}`;
}

function shortId(id: string) {
  return id.replace(/-/g, "").slice(0, 10).toUpperCase();
}

function fmtDate(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function downloadWalletInvoice(input: WalletInvoiceInput) {
  const isCredit = input.kind === "credit_note";
  const docTitle = isCredit ? "Credit Note" : "Tax Invoice";
  const docPrefix = isCredit ? "CN" : "INV";
  const invoiceNo = `${docPrefix}-${shortId(input.id)}`;

  const gross = Number(input.amount);
  // For recharges, treat as advance-with-GST inclusive. For credit notes (admin
  // adjustment) there's no payment / no GST — show flat credited amount.
  const taxable = isCredit ? gross : +(gross / (1 + GST_RATE)).toFixed(2);
  const gst = isCredit ? 0 : +(gross - taxable).toFixed(2);
  const cgst = +(gst / 2).toFixed(2);
  const sgst = +(gst / 2).toFixed(2);

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const M = 40;

  // ── Brand header ────────────────────────────────────────────
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.rect(0, 0, W, 90, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text(BRAND.name, M, 40);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(BRAND.legal, M, 56);
  pdf.text(`${BRAND.website}  ·  ${BRAND.email}`, M, 70);

  // Invoice meta (right)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(docTitle.toUpperCase(), W - M, 40, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`No: ${invoiceNo}`, W - M, 56, { align: "right" });
  pdf.text(`Date: ${fmtDate(input.createdAt)}`, W - M, 70, { align: "right" });

  // ── Bill-to + From boxes ────────────────────────────────────
  pdf.setTextColor(15, 23, 42);
  let y = 120;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Billed To", M, y);
  pdf.text("From", W / 2 + 10, y);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  y += 16;

  const billTo: string[] = [
    input.store.name || "Store",
    input.store.owner_email || "",
    [input.store.city, input.store.state].filter(Boolean).join(", ") ||
      input.store.location || "",
    input.store.whatsapp_number ? `WhatsApp: ${input.store.whatsapp_number}` : "",
    input.store.slug ? `Store: ${input.store.slug}` : "",
  ].filter(Boolean) as string[];

  const from: string[] = [
    BRAND.legal,
    BRAND.address,
    BRAND.email,
    BRAND.website,
  ];

  const colY = y;
  billTo.forEach((line, i) => pdf.text(line, M, colY + i * 13));
  from.forEach((line, i) => pdf.text(line, W / 2 + 10, colY + i * 13));

  y = colY + Math.max(billTo.length, from.length) * 13 + 18;

  // ── Description ─────────────────────────────────────────────
  const description = isCredit
    ? `Wallet credit adjustment by ShopBanao admin${input.notes ? ` — ${input.notes}` : ""}`
    : `Prepaid wallet recharge for commission billing on ShopBanao platform`;

  autoTable(pdf, {
    startY: y,
    head: [["Description", "Qty", "Rate", "Amount"]],
    body: [[description, "1", inr(taxable), inr(taxable)]],
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 9, textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: W - M * 2 - 60 - 70 - 70 },
      1: { halign: "center", cellWidth: 60 },
      2: { halign: "right", cellWidth: 70 },
      3: { halign: "right", cellWidth: 70 },
    },
    margin: { left: M, right: M },
  });

  // ── Totals block ────────────────────────────────────────────
  // @ts-expect-error jspdf-autotable extends doc with lastAutoTable
  y = pdf.lastAutoTable.finalY + 14;
  const labelX = W - M - 180;
  const valueX = W - M;

  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);

  const row = (label: string, value: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.text(label, labelX, y);
    pdf.text(value, valueX, y, { align: "right" });
    y += 14;
  };

  row("Subtotal", inr(taxable));
  if (!isCredit) {
    row(`CGST @ ${(GST_RATE * 50).toFixed(0)}%`, inr(cgst));
    row(`SGST @ ${(GST_RATE * 50).toFixed(0)}%`, inr(sgst));
  }
  pdf.setDrawColor(226, 232, 240);
  pdf.line(labelX, y - 6, valueX, y - 6);
  pdf.setTextColor(15, 23, 42);
  row(isCredit ? "Total credited" : "Total paid", inr(gross), true);

  // ── Payment meta ────────────────────────────────────────────
  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  const meta: string[] = [];
  if (!isCredit) {
    meta.push(`Payment method: ${input.paymentMethod || "Online (Cashfree)"}`);
    if (input.paymentRef) meta.push(`Transaction ref: ${input.paymentRef}`);
    meta.push(`Status: Paid`);
  } else {
    meta.push(`Adjustment type: Admin credit`);
    if (input.paymentRef) meta.push(`Reference: ${input.paymentRef}`);
  }
  meta.forEach((m, i) => pdf.text(m, M, y + i * 13));
  y += meta.length * 13 + 18;

  // ── Notes / footer ──────────────────────────────────────────
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  const footerNote = isCredit
    ? "This credit note acknowledges a non-cash credit added to your ShopBanao wallet. No payment was received. Use of credit is governed by ShopBanao Terms at shopbanao.in/terms."
    : "Amount paid is an advance towards platform commission. GST shown is included in the paid amount. This is a system-generated tax invoice and does not require a signature. Refunds, if any, are governed by the Refund Policy at shopbanao.in/refund-policy.";
  const wrapped = pdf.splitTextToSize(footerNote, W - M * 2);
  pdf.text(wrapped, M, y);

  // Bottom branded strip
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, pdf.internal.pageSize.getHeight() - 28, W, 28, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.text(
    `${BRAND.name}  ·  ${BRAND.website}  ·  ${BRAND.email}`,
    W / 2,
    pdf.internal.pageSize.getHeight() - 11,
    { align: "center" },
  );

  pdf.save(`${invoiceNo}.pdf`);
}
