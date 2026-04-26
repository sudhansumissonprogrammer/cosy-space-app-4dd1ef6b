import { Check, X } from "lucide-react";

const rows = [
  { feature: "Monthly cost", shopbanao: "Free–₹699", shopify: "₹1,500–₹20,000", dukaan: "₹499–₹2,999", whatsapp: "Free but chaotic", shopbanaoType: "check", shopifyType: "bad", dukaanType: "neutral", whatsappType: "bad" },
  { feature: "Commission on every sale", shopbanao: "0% always", shopify: "0.5–2% extra", dukaan: "1–3% per order", whatsapp: "Manual UPI mess", shopbanaoType: "good", shopifyType: "bad", dukaanType: "bad", whatsappType: "bad" },
  { feature: "UPI / GPay / PhonePe", shopbanao: "Built in", shopify: "Complex setup", dukaan: "Yes", whatsapp: "Manual transfer", shopbanaoType: "check", shopifyType: "x", dukaanType: "check", whatsappType: "x" },
  { feature: "Custom domain", shopbanao: "All plans", shopify: "All plans", dukaan: "Paid add-on", whatsapp: "Not possible", shopbanaoType: "check", shopifyType: "check", dukaanType: "bad", whatsappType: "x" },
  { feature: "WhatsApp order alerts", shopbanao: "Instant alerts", shopify: "Needs paid plugin", dukaan: "Limited", whatsapp: "You are WhatsApp", shopbanaoType: "check", shopifyType: "bad", dukaanType: "bad", whatsappType: "x" },
  { feature: "Setup time", shopbanao: "10 minutes", shopify: "Days to weeks", dukaan: "~1 hour", whatsapp: "No real setup", shopbanaoType: "good", shopifyType: "bad", dukaanType: "neutral", whatsappType: "neutral" },
  { feature: "Order tracking for buyers", shopbanao: "Built in", shopify: "Yes", dukaan: "Basic", whatsapp: "No", shopbanaoType: "check", shopifyType: "check", dukaanType: "bad", whatsappType: "x" },
  { feature: "Analytics & revenue charts", shopbanao: "Full dashboard", shopify: "Yes", dukaan: "Limited", whatsapp: "None", shopbanaoType: "check", shopifyType: "check", dukaanType: "neutral", whatsappType: "x" },
  { feature: "Built for Indian market", shopbanao: "100% India-first", shopify: "US-first", dukaan: "Yes", whatsapp: "Yes", shopbanaoType: "check", shopifyType: "x", dukaanType: "check", whatsappType: "check" },
  { feature: "Reviews + coupons included", shopbanao: "Included", shopify: "Paid plugins", dukaan: "Limited", whatsapp: "Not possible", shopbanaoType: "check", shopifyType: "bad", dukaanType: "neutral", whatsappType: "x" },
];

const CellContent = ({ value, type }: { value: string; type: string }) => {
  if (type === "check") return <span className="inline-flex items-center gap-1 text-green-700 font-semibold text-xs sm:text-sm"><Check className="h-3.5 w-3.5" strokeWidth={3} /> {value}</span>;
  if (type === "x") return <span className="inline-flex items-center gap-1 text-bauhaus-red font-semibold text-xs sm:text-sm"><X className="h-3.5 w-3.5" strokeWidth={3} /> {value}</span>;
  if (type === "good") return <span className="text-green-700 font-bold text-xs sm:text-sm">{value}</span>;
  if (type === "bad") return <span className="text-bauhaus-red font-semibold text-xs sm:text-sm">{value}</span>;
  return <span className="text-foreground font-medium text-xs sm:text-sm">{value}</span>;
};

const ComparisonTable = () => {

  return (
    <section className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-foreground">
            ShopBanao vs<br /><span className="text-bauhaus-red">The Alternatives</span>
          </h2>
          <p className="font-medium text-muted-foreground mt-4 max-w-lg mx-auto text-sm sm:text-base">
            See exactly why Indian sellers are choosing ShopBanao over every other option.
          </p>
        </div>
        <div className="border-2 sm:border-4 border-foreground shadow-bauhaus sm:shadow-bauhaus-lg overflow-x-auto">
          <div className="grid grid-cols-5 border-b-2 sm:border-b-4 border-foreground min-w-[640px]">
            <div className="p-3 sm:p-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs text-muted-foreground bg-muted">Feature</div>
            <div className="p-3 sm:p-4 bg-bauhaus-blue text-center border-x-2 border-foreground">
              <span className="font-black uppercase tracking-wider text-xs sm:text-sm text-primary-foreground block">ShopBanao</span>
              <span className="inline-block mt-1 bg-green-600 text-primary-foreground font-bold uppercase tracking-wider text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full">Best choice</span>
            </div>
            <div className="p-3 sm:p-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs text-foreground bg-muted text-center">Shopify</div>
            <div className="p-3 sm:p-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs text-foreground bg-muted text-center border-x-2 border-foreground">Dukaan</div>
            <div className="p-3 sm:p-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs text-foreground bg-muted text-center">WhatsApp only</div>
          </div>
          {rows.map((r, i) => (
            <div key={r.feature} className={`grid grid-cols-5 border-b-2 border-foreground last:border-b-0 min-w-[640px] ${i % 2 === 0 ? "bg-bauhaus-white" : "bg-bauhaus-canvas"}`}>
              <div className="p-3 sm:p-4 font-medium text-xs sm:text-sm text-foreground">{r.feature}</div>
              <div className="p-3 sm:p-4 text-center border-x-2 border-foreground bg-bauhaus-blue/5"><CellContent value={r.shopbanao} type={r.shopbanaoType} /></div>
              <div className="p-3 sm:p-4 text-center"><CellContent value={r.shopify} type={r.shopifyType} /></div>
              <div className="p-3 sm:p-4 text-center border-x-2 border-foreground"><CellContent value={r.dukaan} type={r.dukaanType} /></div>
              <div className="p-3 sm:p-4 text-center"><CellContent value={r.whatsapp} type={r.whatsappType} /></div>
            </div>
          ))}
        </div>
        <p className="text-center text-muted-foreground text-xs mt-4">Prices and features as of 2025. ShopBanao charges 0% commission on all plans, always.</p>

      </div>
    </section>
  );
};

export default ComparisonTable;
