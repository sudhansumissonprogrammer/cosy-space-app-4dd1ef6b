const press = ["YourStory", "Inc42", "ET Retail", "Moneycontrol", "VCCircle", "Business Standard"];

const FeaturedOn = () => (
  <section className="border-b-4 border-foreground bg-bauhaus-canvas py-10 sm:py-12 px-4">
    <div className="max-w-6xl mx-auto">
      <p className="text-center font-bold uppercase tracking-widest text-xs text-muted-foreground mb-5">As covered in</p>
      <div className="flex flex-wrap items-center justify-center gap-x-8 sm:gap-x-12 gap-y-3">
        {press.map((p) => (
          <span key={p} className="font-black uppercase tracking-tight text-base sm:text-lg text-foreground/55">
            {p}
          </span>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturedOn;
