import { MessageCircle } from "lucide-react";
import logo from "@/assets/shopbanao-logo.webp";

const Footer = () => {
  return (
    <footer className="bg-foreground text-primary-foreground py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-12">
          <div>
            <div className="flex items-center -space-x-1 mb-4">
              <img src={logo} alt="ShopBanao" className="h-14 w-auto" />
              <span className="text-2xl text-primary-foreground" style={{ fontFamily: "'Alegreya SC', serif", fontWeight: 700 }}>ShopBanao</span>
            </div>
            <p className="font-medium text-sm text-primary-foreground/60 leading-relaxed">Build your online store with zero commission. Your store, your domain, your rules.</p>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs text-primary-foreground/50 mb-4">Product</h4>
            <div className="space-y-2">
              {["Features", "Pricing", "Integrations", "Themes", "API"].map((l) => (
                <a key={l} href="#" className="block font-medium text-sm text-primary-foreground/70 hover:text-bauhaus-yellow transition-colors duration-200">{l}</a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs text-primary-foreground/50 mb-4">Company</h4>
            <div className="space-y-2">
              {["About Us", "Blog", "Careers", "Contact", "Privacy Policy"].map((l) => (
                <a key={l} href="#" className="block font-medium text-sm text-primary-foreground/70 hover:text-bauhaus-yellow transition-colors duration-200">{l}</a>
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
          <p className="font-medium text-xs text-primary-foreground/40"><p className="font-medium text-xs text-primary-foreground/40">© 2025 ShopBanao. All rights reserved.</p>. All rights reserved.</p>
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
