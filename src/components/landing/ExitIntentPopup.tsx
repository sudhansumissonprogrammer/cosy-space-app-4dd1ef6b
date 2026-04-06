import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ExitIntentPopup = () => {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem("exit_shown")) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        sessionStorage.setItem("exit_shown", "1");
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
          onClick={() => setShow(false)}
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
          Start your free 7-day trial today — zero commission, no credit card needed. Your store can be live in 10 minutes.
        </p>

        <button
          onClick={() => {
            setShow(false);
            navigate("/signup");
          }}
          className="w-full bg-bauhaus-red text-bauhaus-white font-black uppercase tracking-wider text-sm py-3.5 border-3 border-foreground shadow-[4px_4px_0px_0px_hsl(var(--foreground))] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all duration-150"
        >
          Start Free Trial →
        </button>

        <p className="text-xs text-muted-foreground mt-3 font-medium">
          No credit card • Cancel anytime • 0% commission
        </p>
      </div>
    </div>
  );
};

export default ExitIntentPopup;
