import { useState, useEffect } from "react";
import { X } from "lucide-react";

const WA_LINK = "https://wa.me/919692282485?text=Hi!%20I%20want%20to%20get%20my%20online%20store%20built";

const ExitIntentPopup = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const cooldownUntil = sessionStorage.getItem("exit_cooldown");
    if (cooldownUntil && Date.now() < Number(cooldownUntil)) return;

    const handleMouseLeave = (e: MouseEvent) => {
      const cooldown = sessionStorage.getItem("exit_cooldown");
      if (cooldown && Date.now() < Number(cooldown)) return;
      if (e.clientY <= 0) {
        setShow(true);
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative bg-bauhaus-white border-4 border-foreground shadow-bauhaus-lg max-w-md w-[92%] p-8 text-center">
        <button
          onClick={() => {
            sessionStorage.setItem("exit_cooldown", String(Date.now() + 2 * 60 * 1000));
            setShow(false);
          }}
          className="absolute top-3 right-3 text-foreground hover:opacity-70"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={3} />
        </button>

        <div className="w-14 h-14 bg-bauhaus-red border-4 border-foreground rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🎁</span>
        </div>

        <h3 className="font-black uppercase text-2xl tracking-tight text-foreground mb-2">
          Wait! Don't Leave Yet
        </h3>
        <p className="text-muted-foreground font-medium text-sm mb-6">
          Get your professional online store built for just ₹10,000 — custom domain, payments & everything included. Ready in 48 hours.
        </p>

        <a
          href={WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setShow(false)}
          className="block w-full bg-bauhaus-red text-bauhaus-white font-black uppercase tracking-wider text-sm py-3.5 border-3 border-foreground shadow-[4px_4px_0px_0px_hsl(var(--foreground))] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all duration-150"
        >
          Get Started — Talk to Us →
        </a>

        <p className="text-xs text-muted-foreground mt-3 font-medium">
          One-time ₹10,000 • Ready in 48 hours • Ongoing support
        </p>
      </div>
    </div>
  );
};

export default ExitIntentPopup;
