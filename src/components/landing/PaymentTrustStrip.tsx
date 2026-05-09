const partners = [
  { name: "UPI", src: "/icons/upi.png" },
  { name: "GPay", src: "/icons/gpay.svg" },
  { name: "PhonePe", src: "/icons/phonepe.svg" },
  { name: "Paytm", src: "/icons/paytm.svg" },
];

const PaymentTrustStrip = () => (
  <section className="border-b-4 border-foreground bg-bauhaus-white py-4 px-4 sm:px-6">
    <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8">
      <span className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground shrink-0">Trusted Payment Partners</span>
      <div className="flex items-center gap-6 sm:gap-10 opacity-60 grayscale">
        {partners.map((p) => (
          <img key={p.name} src={p.src} alt={p.name} className="h-6 sm:h-7 w-auto" loading="lazy" />
        ))}
      </div>
    </div>
  </section>
);

export default PaymentTrustStrip;
