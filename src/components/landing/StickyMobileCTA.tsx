import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

const StickyMobileCTA = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-sm border-t-2 border-foreground px-4 py-3 safe-bottom">
      <a
        href="/signup"
        className="flex items-center justify-center gap-2 w-full bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-sm py-3.5 border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200"
      >
        Start Free Trial <ArrowRight className="h-4 w-4" />
      </a>
    </div>
  );
};

export default StickyMobileCTA;
