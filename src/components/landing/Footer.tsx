import { MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/shopbanao-logo.png";

const Footer = () => {
  const productLinks: { label: string; href: string }[] = [
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Themes", href: "/#themes" },
    { label: "FAQ", href: "/#faq" },
  ];
  const companyLinks: { label: string; to: string }[] = [
    { label: "About Us", to: "/about-us" },
    { label: "Contact Us", to: "/contact-us" },
  ];
  const legalLinks: { label: string; to: string }[] = [
    { label: "Privacy Policy", to: "/privacy-policy" },
    { label: "Terms & Conditions", to: "/terms" },
    { label: "Refund & Cancellation", to: "/refund-policy" },
    { label: "Shipping Policy", to: "/shipping-policy" },
  ];

  return (
    <footer className="bg-foreground text-primary-foreground py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
          <div className="lg:col-span-2">
            <div className="flex items-center -space-x-1 mb-4">
              <img src={logo} alt="ShopBanao" className="h-14 w-auto" />
              <span className="text-2xl text-primary-foreground" style={{ fontFamily: "'Alegreya SC', serif", fontWeight: 700 }}>ShopBanao</span>
            </div>
            <p className="font-medium text-sm text-primary-foreground/60 leading-relaxed max-w-sm">Build your online store with zero commission. Your store, your domain, your rules.</p>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs text-primary-foreground/50 mb-4">Product</h4>
            <div className="space-y-2">
              {productLinks.map((l) => (
                <a key={l.label} href={l.href} className="block font-medium text-sm text-primary-foreground/70 hover:text-bauhaus-yellow transition-colors duration-200">{l.label}</a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs text-primary-foreground/50 mb-4">Company</h4>
            <div className="space-y-2">
              {companyLinks.map((l) => (
                <Link key={l.label} to={l.to} className="block font-medium text-sm text-primary-foreground/70 hover:text-bauhaus-yellow transition-colors duration-200">{l.label}</Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs text-primary-foreground/50 mb-4">Legal</h4>
            <div className="space-y-2">
              {legalLinks.map((l) => (
                <Link key={l.label} to={l.to} className="block font-medium text-sm text-primary-foreground/70 hover:text-bauhaus-yellow transition-colors duration-200">{l.label}</Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs text-primary-foreground/50 mb-4">Contact</h4>
            <div className="space-y-3">
              <a href="https://wa.me/919692282485" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-bauhaus-yellow text-foreground font-bold uppercase tracking-wider text-xs px-4 py-2.5 border-2 border-primary-foreground/30 hover:bg-bauhaus-yellow/90 transition-colors duration-200">
                <MessageCircle className="h-4 w-4" /> WhatsApp Us
              </a>
              <p className="font-medium text-sm text-primary-foreground/60">shopbanaoofficial@gmail.com</p>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t-2 border-primary-foreground/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-medium text-xs text-primary-foreground/40">© 2025 ShopBanao. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <span className="font-medium text-xs text-primary-foreground/40">Made with</span>
            <span className="text-bauhaus-red">■</span>
            <span className="text-bauhaus-blue">●</span>
            <span className="text-bauhaus-yellow">▲</span>
            <span className="font-medium text-xs text-primary-foreground/40">in India</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
