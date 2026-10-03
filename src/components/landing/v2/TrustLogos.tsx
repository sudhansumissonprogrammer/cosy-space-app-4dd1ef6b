const brands = [
  "Demo Store", "Serdiya", "Hridaya", "Vanya", "Auric", "Maatra", "Kavya",
  "Ujjwal", "Bandhej", "Nirvi", "Ratan", "Saira", "Pooja", "Mehr", "Tilak",
  "Aarna", "Vihaan", "Ishaan", "Aanya", "Reva",
];

const TrustLogos = () => (
  <section className="border-b-4 border-foreground bg-bauhaus-white py-10 sm:py-12">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <p className="text-center font-bold uppercase tracking-widest text-xs text-muted-foreground mb-6">
        Powering 500+ Indian D2C brands
      </p>
      <div className="relative overflow-hidden">
        <div className="flex gap-8 sm:gap-12 animate-[marquee_40s_linear_infinite] whitespace-nowrap">
          {[...brands, ...brands].map((b, i) => (
            <span
              key={i}
              className="font-black uppercase tracking-tight text-xl sm:text-2xl text-foreground/70 hover:text-foreground transition-colors"
              style={{ fontFamily: "'Alegreya SC', serif" }}
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
    <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
  </section>
);

export default TrustLogos;
