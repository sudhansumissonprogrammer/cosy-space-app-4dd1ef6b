import { ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/shopbanao-logo.png";

interface LegalLayoutProps {
  title: string;
  updatedOn?: string;
  children: ReactNode;
}

const LegalLayout = ({ title, updatedOn = "20 April 2026", children }: LegalLayoutProps) => {
  useEffect(() => {
    document.title = `${title} | ShopBanao`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="min-h-screen bg-background font-outfit">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center -space-x-1">
            <img src={logo} alt="ShopBanao" className="h-10 w-auto" />
            <span className="text-xl text-foreground" style={{ fontFamily: "'Alegreya SC', serif", fontWeight: 700 }}>ShopBanao</span>
          </Link>
          <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">← Back to Home</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {updatedOn}</p>
        <article className="prose prose-slate max-w-none text-foreground/90 leading-relaxed space-y-5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-foreground [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-base [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_a]:text-primary [&_a]:underline">
          {children}
        </article>
        <div className="mt-12 pt-6 border-t text-sm text-muted-foreground">
          Questions? Email{" "}
          <a href="mailto:shopbanaoofficial@gmail.com" className="text-primary underline">
            shopbanaoofficial@gmail.com
          </a>{" "}
          or WhatsApp{" "}
          <a href="https://wa.me/919692282485" className="text-primary underline">+91 96922 82485</a>.
        </div>
      </main>
    </div>
  );
};

export default LegalLayout;
