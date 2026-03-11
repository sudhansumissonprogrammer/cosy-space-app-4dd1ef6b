import { useRef } from "react";
import { format } from "date-fns";

interface OrderInvoiceProps {
  order: any;
  store: any;
  onClose: () => void;
}

export default function OrderInvoice({ order, store, onClose }: OrderInvoiceProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Invoice #${order.id.slice(0, 8)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #111; max-width: 600px; margin: 0 auto; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { text-align: left; padding: 8px 4px; border-bottom: 1px solid #e5e5e5; font-size: 13px; }
        th { font-weight: 600; color: #555; }
        .right { text-align: right; }
        .total-row td { font-weight: 700; border-top: 2px solid #111; font-size: 15px; }
        h1 { margin: 0; font-size: 22px; }
        .meta { color: #666; font-size: 13px; margin: 4px 0; }
        .logo { height: 48px; margin-bottom: 8px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${content.innerHTML}
      <script>window.print(); window.close();</script>
      </body></html>
    `);
    win.document.close();
  };

  const items = order.order_items || [];
  const currency = order.currency || store?.currency || "INR";

  return (
    <div>
      <div ref={printRef}>
        {store?.logo_url && <img src={store.logo_url} alt={store.name} className="logo" style={{ height: 48, marginBottom: 8 }} />}
        <h1>{store?.name || "Store"}</h1>
        <p className="meta">{store?.location || ""} {store?.city || ""} {store?.state || ""}</p>
        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #e5e5e5" }} />
        <p style={{ fontSize: 13, color: "#666" }}>
          <strong>Invoice</strong> #{order.id.slice(0, 8)}<br />
          Date: {format(new Date(order.created_at), "dd MMM yyyy, hh:mm a")}<br />
          Status: {order.status}<br />
          Payment: {order.payment_method?.toUpperCase()}
        </p>
        {order.customer_name && (
          <p style={{ fontSize: 13, marginTop: 12 }}>
            <strong>Customer:</strong> {order.customer_name}<br />
            {order.customer_phone && <>Phone: {order.customer_phone}<br /></>}
            {order.street_address && <>{order.street_address}, {order.city}, {order.state} {order.pincode}</>}
          </p>
        )}
        <table>
          <thead>
            <tr><th>Item</th><th>Qty</th><th className="right">Price</th><th className="right">Total</th></tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id}>
                <td>{item.product_name}</td>
                <td>{item.quantity}</td>
                <td className="right">{currency} {Number(item.unit_price).toFixed(2)}</td>
                <td className="right">{currency} {Number(item.total).toFixed(2)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={3}>Total</td>
              <td className="right">{currency} {Number(order.total).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        {order.notes && <p style={{ fontSize: 12, color: "#888" }}>Notes: {order.notes}</p>}
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          onClick={handlePrint}
          style={{ padding: "8px 20px", background: "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}
        >
          Print / Download PDF
        </button>
        <button
          onClick={onClose}
          style={{ padding: "8px 20px", background: "#f5f5f5", color: "#333", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
