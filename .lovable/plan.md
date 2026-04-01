## Plan: Enhanced Default About Us Page with Rich Template

### Problem

The current AI-generated `about_us` text is a short 5-7 line paragraph. The user wants a rich, structured About Us page (like the Madhtara example) with sections for Welcome, Our Mission, Why Choose Us, Our Promise, and Contact — all dynamically populated from store data.

### Changes

#### 1. Update AI Prompt to Generate Richer About Us Content

**File:** `supabase/functions/generate-store-content/index.ts`

- Change the `about_us` field in the AI prompt to request structured, multi-section content (Welcome intro, Mission statement, Why Choose Us with emoji bullet points, Our Promise, Contact info placeholder)
- Increase `about_us` max length from 2000 to 4000 chars
- The AI will generate content using the store name and description, making each store's About Us unique

#### 2. Redesign the Default About Us Page with Rich Template

**File:** `src/pages/StorefrontAboutUs.tsx`

Replace `DefaultAboutContent` with a new rich template that:

- Shows the **uploaded image** at the top (already works, keeping it)
- Renders `about_us_text` with proper formatting (headings, paragraphs, emoji bullets) using a smart parser that detects section headers and bullet points
- When `about_us_text` is empty, falls back to a dynamically generated template using store data (name, description, location, WhatsApp, social links)
- The fallback template mirrors the Madhtara example structure:
  - **ABOUT US** — Welcome section using store description
  - **Our Mission** — Generic mission statement with store name
  - **Why Choose Us?** — 4 bullet points with emojis (Authentic Designs, Quality, Reliable Delivery, Customer Support)
  - **Our Promise** — Trust statement with store name
  - **Contact Us** — WhatsApp number, location, social links from store data
- When **Custom HTML is ON** → hide all default content, show only custom HTML (already works, keeping it)

#### 3. Smart Text Renderer for Stored About Us Content

**File:** `src/pages/StorefrontAboutUs.tsx`

Add a `RichTextRenderer` component that parses the stored `about_us_text` and:

- Detects lines starting with common heading patterns (e.g., "Our Mission", "Why Choose Us") → renders as `<h2>`
- Detects lines starting with emoji bullets (✨, 💎, 🚚, 💬) → renders as styled list items
- Renders other lines as paragraphs
- This makes AI-generated multi-section text look properly formatted

### What stays unchanged

- Image upload in editor — kept as is, image displays on top
- Custom HTML toggle — when enabled, replaces entire page content
- Store isolation — all data scoped by `store_id`
- Contact Us page — no changes

### Technical Details

- The `about_us_text` column already supports up to 4000+ chars (text type)
- No database migration needed
- Existing stores keep their current `about_us_text`; the new template is only the fallback when text is empty
- New stores get richer AI-generated text automatically **ABOUT US**
  Welcome to **Madhtara** — where **style meets tradition**.  
  We are passionate about bringing you beautifully crafted jewellery and accessories that celebrate timeless elegance, artistry, and culture. Based in **Saharanpur**, our collection is inspired by India’s rich heritage and designed for today’s modern generation.
  At **Madhtara**, we believe jewellery isn’t just an accessory — it’s a story.  
  Every piece we offer is carefully selected for its quality, craftsmanship, and unique design, so you can express yourself with confidence and grace. Whether you’re dressing for a festive celebration, a wedding, or a casual day out, Madhtara adds that special sparkle to every moment.
  ---
  ### **Our Mission**
  To make premium-quality jewellery accessible and affordable for everyone, blending traditional charm with contemporary style. We aim to bring artistry to your doorstep with trusted service, authentic designs, and an unmatched shopping experience.
  ---
  ### **Why Choose Madhtara?**
  - ✨ **Authentic & Handpicked Designs:** Every item is sourced and crafted with precision and care.
  - 💎 **Quality You Can Trust:** We prioritise durability, beauty, and attention to detail.
  - 🚚 **Reliable Delivery:** Fast and safe shipping across India.
  - 💬 **Customer Support:** Our friendly team is always ready to assist you.
  ---
  ### **Our Promise**
  We promise to deliver products that reflect our dedication to quality, creativity, and trust. Your satisfaction is at the heart of everything we do — because at **Madhtara**, you’re not just buying jewellery; you’re becoming part of our story.
  ---
  ### **Contact Us**
  📧 **Email:** [madhtara2025@gmail.com](mailto:madhtara2025@gmail.com)  
  📞 **Phone:** +91 8126721276  
  🏠 **Address:** Sarafa Bazar, Lakshmi Market, Saharanpur, India
  Follow us on social media and stay updated with our latest collections, offers, and trends. no donet genrate conten thismuch from ai only use this content but put some varibale add that from 3-4 liine description generate by ai so for every store it will diffennt strictly dont generate all prfrom ai
- &nbsp;