const brands = [
  "Overlays", "Serdiya", "Hridaya", "Vanya", "Auric", "Maatra", "Kavya",
  "Ujjwal", "Bandhej", "Nirvi", "Ratan", "Saira", "Pooja", "Mehr", "Tilak",
  "Aarna", "Vihaan", "Ishaan", "Aanya", "Reva",
];

/**
 * Brand marquee. Wordmarks are set in Outfit Black — the Bauhaus system runs
 * a single geometric typeface, so the old serif exception was removed. Each
 * third name carries a small primary-colour square as a rhythm marker.
 */
const TrustLogos = () => (
  <section className="border-b-4 border-foreground bg-bauhaus-white py-10 sm:py-12">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <p className="text-center font-bold uppercase tracking-widest text-xs text-muted-foreground mb-6">
        Powering 500+ Indian D2C brands
      </p>
      <div className="relative overflow-hidden">
        <div className="flex items-center gap-8 sm:gap-12 animate-[marquee_40s_linear_infinite] whitespace-nowrap">
          {[...brands, ...brands].map((b, i) => (
            <span key={i} className="flex items-center gap-3 shrink-0">
              <span className="font-black uppercase tracking-tighter text-xl sm:text-2xl text-foreground/70 hover:text-foreground transition-colors duration-200">
                {b}
              </span>
              <span
                aria-hidden="true"
                className={`h-2 w-2 ${i % 3 === 0 ? "rounded-full bg-bauhaus-red" : i % 3 === 1 ? "bg-bauhaus-blue" : "bg-bauhaus-yellow rotate-45"}`}
              />
            </span>
          ))}
        </div>
      </div>
    </div>
    <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
  </section>
);

export default TrustLogos;
