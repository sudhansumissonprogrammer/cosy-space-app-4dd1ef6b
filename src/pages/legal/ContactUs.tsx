import { Mail, MessageCircle, Phone, MapPin, Clock } from "lucide-react";
import LegalLayout from "./LegalLayout";

const ContactUs = () => (
  <LegalLayout title="Contact Us">
    <p>We'd love to hear from you. Whether you have a question about features, pricing, need a demo, or anything else — our team is ready to help.</p>

    <div className="not-prose grid sm:grid-cols-2 gap-4 my-8">
      <a href="https://wa.me/919692282485" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-5 border-2 border-border rounded-lg hover:border-primary transition-colors">
        <MessageCircle className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-foreground">WhatsApp</div>
          <div className="text-sm text-muted-foreground">+91 96922 82485</div>
          <div className="text-xs text-muted-foreground mt-1">Fastest response</div>
        </div>
      </a>
      <a href="mailto:shopbanaoofficial@gmail.com" className="flex items-start gap-3 p-5 border-2 border-border rounded-lg hover:border-primary transition-colors">
        <Mail className="h-6 w-6 text-primary shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-foreground">Email</div>
          <div className="text-sm text-muted-foreground break-all">shopbanaoofficial@gmail.com</div>
          <div className="text-xs text-muted-foreground mt-1">Replies within 24 hours</div>
        </div>
      </a>
      <a href="tel:+919692282485" className="flex items-start gap-3 p-5 border-2 border-border rounded-lg hover:border-primary transition-colors">
        <Phone className="h-6 w-6 text-primary shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-foreground">Phone</div>
          <div className="text-sm text-muted-foreground">+91 96922 82485</div>
          <div className="text-xs text-muted-foreground mt-1">Mon–Sat, 10 AM – 7 PM IST</div>
        </div>
      </a>
      <div className="flex items-start gap-3 p-5 border-2 border-border rounded-lg">
        <MapPin className="h-6 w-6 text-primary shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-foreground">Address</div>
          <div className="text-sm text-muted-foreground">ShopBanao<br/>Odisha, India</div>
        </div>
      </div>
    </div>

    <h2>Business Hours</h2>
    <p className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Monday – Saturday: 10:00 AM – 7:00 PM IST</p>

    <h2>Support</h2>
    <p>For technical support, billing questions, or onboarding help, WhatsApp is our fastest channel. For partnership inquiries or media, please email us.</p>
  </LegalLayout>
);

export default ContactUs;
