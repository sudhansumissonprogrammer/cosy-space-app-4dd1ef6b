# 🚀 Complete White-Label E-Commerce SaaS — Full Setup & Knowledge Guide

> **For Remix/White-Label Buyers** | Version 2.0 | March 2026

---

## TABLE OF CONTENTS

1. [Platform Overview](#1-platform-overview)
2. [Architecture Deep Dive](#2-architecture-deep-dive)
3. [Complete Feature List](#3-complete-feature-list)
4. [Database Schema & RLS Security](#4-database-schema--rls-security)
5. [Edge Functions Reference](#5-edge-functions-reference)
6. [Cloudflare Worker Setup (New Domain)](#6-cloudflare-worker-setup-new-domain)
7. [Secrets & API Keys](#7-secrets--api-keys)
8. [Authentication System](#8-authentication-system)
9. [Payment Integration (Razorpay)](#9-payment-integration-razorpay)
10. [WhatsApp Marketing Suite](#10-whatsapp-marketing-suite)
11. [Theme System](#11-theme-system)
12. [Checkout & Order Flow](#12-checkout--order-flow)
13. [SEO & Social Sharing](#13-seo--social-sharing)
14. [Admin Panel](#14-admin-panel)
15. [Security Hardening](#15-security-hardening)
16. [Subscription & Pricing Model](#16-subscription--pricing-model)
17. [Storage Buckets](#17-storage-buckets)
18. [Step-by-Step New Deployment](#18-step-by-step-new-deployment)
19. [Business Valuation Guide](#19-business-valuation-guide)

---

## 1. PLATFORM OVERVIEW

A **multi-tenant e-commerce SaaS** where sellers create and manage online stores without any coding. Built for the **Indian D2C market** with native UPI, Razorpay, COD, and WhatsApp ordering.

### Key Highlights
- **Zero-code store creation** — live in under 5 minutes
- **10 mobile-first themes** — instant switching
- **India-first payments** — Razorpay, UPI (GPay, PhonePe, Paytm), COD
- **WhatsApp commerce** — order via WhatsApp with one tap
- **Dual WhatsApp marketing** — managed platform mode + own API mode
- **Multi-tenant** — single deployment, unlimited stores
- **PWA** — installable app-like experience
- **Express checkout** — phone-first guest checkout with pincode auto-fill

---

## 2. ARCHITECTURE DEEP DIVE

### Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui + Radix UI |
| State | TanStack React Query |
| Routing | React Router v6 |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Payments | Razorpay (Orders, UPI Intent, Verification) |
| Email | Resend API via PGMQ queue pattern |
| DNS/CDN | Cloudflare (Workers for subdomain routing) |
| PWA | vite-plugin-pwa |

### Request Flow
```
User visits brand.yourdomain.com
  → Cloudflare Worker intercepts (wildcard DNS)
  → If social crawler: injects OG meta tags from og-meta edge function
  → If /sitemap.xml or /robots.txt: proxies to edge functions
  → Otherwise: proxies to origin app
  → Client reads window.location.hostname → extracts slug
  → Calls get_storefront_data RPC → renders store with theme
```

### Three User Interfaces
1. **Admin Panel** (`/admin/*`) — Platform owner manages all users, stores, orders
2. **Seller Dashboard** (`/dashboard/*`) — Store owners manage their store
3. **Storefront** (`/store/:slug/*` or `slug.domain.com`) — Buyer-facing shop

### Key File Structure
```
src/
├── components/
│   ├── admin/              # Admin panel components
│   ├── dashboard/          # Seller dashboard widgets
│   ├── storefront/         # Storefront UI (shared across themes)
│   └── ui/                 # shadcn/ui library
├── contexts/
│   ├── AuthContext.tsx      # Platform auth (sellers)
│   ├── StorefrontAuthContext.tsx  # Storefront auth (buyers)
│   ├── CartContext.tsx      # Shopping cart state
│   └── WishlistContext.tsx  # Wishlist state
├── layouts/
│   ├── AdminLayout.tsx
│   ├── DashboardLayout.tsx
│   ├── StorefrontLayout.tsx       # Theme 1 (default)
│   ├── StorefrontLayoutV2.tsx     # Theme 2
│   └── ... (up to V11)
├── pages/
│   ├── admin/              # Admin pages
│   ├── Storefront*.tsx     # Storefront pages per theme
│   └── *.tsx               # Seller + auth pages
├── lib/
│   ├── subdomain.ts        # Subdomain detection logic
│   ├── imageCompression.ts
│   └── whatsappAutomation.ts
└── integrations/supabase/
    ├── client.ts           # Auto-generated, DO NOT EDIT
    └── types.ts            # Auto-generated, DO NOT EDIT

supabase/
├── functions/              # Edge functions (auto-deploy)
│   ├── auth-proxy/
│   ├── create-guest-account/
│   ├── notify-order/
│   ├── og-meta/
│   ├── place-order/
│   ├── razorpay-order/
│   ├── razorpay-verify/
│   ├── razorpay-upi-intent/
│   ├── razorpay-payment-status/
│   ├── robots-txt/
│   ├── share-page/
│   ├── sitemap/
│   ├── track-view/
│   ├── whatsapp-send/
│   ├── whatsapp-templates/
│   ├── whatsapp-webhook/
│   ├── process-email-queue/
│   └── auth-email-hook/
└── config.toml             # Edge function JWT settings

docs/
├── cloudflare-worker-unified.js  # Ready-to-deploy Cloudflare Worker
└── COMPLETE-SETUP-GUIDE.md       # This file
```

---

## 3. COMPLETE FEATURE LIST

### Seller Dashboard Features
| Feature | Description |
|---|---|
| Store Creation | One-click setup with slug-based URLs |
| Product Management | CRUD with images, variants, SKUs, categories, bulk upload |
| Order Management | Shopify-style order numbers (#1001+), status lifecycle, delete with confirmation |
| Shipping Labels | 4×6 inch thermal label generation |
| Customer Management | Customer list with order history |
| Coupon System | Percentage/fixed discounts with expiry, min order, max uses |
| Analytics | Page views, order stats, revenue charts |
| Shipping Config | Flat rate, free shipping thresholds |
| Tax Config | Inclusive/exclusive tax with custom rates |
| Payment Config | Per-store Razorpay keys, COD toggle, UPI options |
| Theme Selector | 10 themes with live preview |
| Theme Customization | Colors, fonts, button styles per store |
| SEO Settings | Meta title, description, OG images |
| Facebook Pixel | Built-in pixel tracking |
| WhatsApp Marketing | Dual-mode (managed + own API), bulk messaging, templates, automations |
| Customer Leads | Phone-based lead capture |
| Abandoned Carts | Track and recover via WhatsApp |
| Share Store | Social sharing with dynamic OG previews |
| Domain Settings | Subdomain-based routing |
| Store Policies | Return, shipping, privacy, terms pages |

### Storefront (Buyer-Facing) Features
| Feature | Description |
|---|---|
| 10 Mobile-First Themes | Minimal, Bold, App-style, Luxury, Professional, etc. |
| Express Checkout | Phone-first, pincode auto-fill via India Post API |
| Guest Checkout | Pseudo-email generation for anonymous buyers |
| Product Quick View | Modal preview without page navigation |
| Cart & Side Cart | Slide-out cart with upsell suggestions |
| Customer Accounts | Signup/login, order history, saved addresses |
| Wishlist | Save products, persist across sessions |
| Best Sellers Carousel | Auto-curated from best-selling products |
| Full-Text Search | Search overlay with instant results |
| PWA | Installable app with offline support |
| Order Tracking | Track orders by order number |
| SEO | JSON-LD, meta tags, dynamic sitemaps, robots.txt |

### Admin Panel Features
| Feature | Description |
|---|---|
| Overview Dashboard | Total stores, users, orders, revenue, recent activity |
| Unified Users & Stores | Single view of all accounts with store metadata |
| User Management | Block/unblock platform users |
| Store Management | Suspend/unsuspend stores |
| Order Overview | All orders across all stores |
| Platform Analytics | Stores/users/revenue by month |
| Subscription Management | Plan management per user |
| Platform Settings | Platform name, default currency |
| WhatsApp Admin | Global message monitoring, platform broadcasts, template library |

---

## 4. DATABASE SCHEMA & RLS SECURITY

### All Tables

| Table | Purpose | RLS |
|---|---|---|
| `stores` | Store profiles, settings, owner reference | Owner CRUD, public read (non-suspended), admin full |
| `products` | Product catalog per store | Owner CRUD, public read (active), admin read |
| `product_images` | Multiple images per product | Owner CRUD, public read |
| `product_variants` | Size/color variants with pricing | Owner CRUD, public read (active) |
| `categories` | Product categories per store | Owner CRUD, public read |
| `orders` | Order records with status tracking | Owner CRUD, buyer read own, admin read, public insert (active store) |
| `order_items` | Line items per order | Owner CRUD, buyer read own, admin read |
| `customers` | Customer records per store | Owner CRUD, admin read |
| `storefront_customers` | Authenticated storefront buyers | User CRUD own, owner read, admin full |
| `customer_addresses` | Saved addresses per customer | Customer CRUD own, owner read |
| `customer_wishlists` | Wishlist items per customer | Customer CRUD own |
| `coupons` | Discount codes per store | Owner CRUD, public read (active valid) |
| `abandoned_carts` | Abandoned cart tracking | Public insert (non-suspended store), owner manage |
| `customer_leads` | Phone-based lead capture | Public insert (non-suspended store), owner read/delete |
| `whatsapp_orders` | WhatsApp order records | Public insert (non-suspended store), owner CRUD |
| `page_views` | Analytics page view tracking | Public insert (non-suspended store), owner read |
| `store_payment_config` | Razorpay keys per store (SECRET) | Owner CRUD, admin full |
| `store_payment_config_public` | VIEW — hides razorpay_key_secret | Public read |
| `store_shipping_config` | Shipping rates per store | Owner CRUD, public read |
| `store_tax_config` | Tax settings per store | Owner CRUD, public read |
| `store_theme_config` | Theme customization per store | Owner CRUD, public read |
| `stores_public` | VIEW — hides owner_email, owner_id | Public read |
| `profiles` | User profiles (platform users) | User CRUD own, admin full |
| `user_roles` | Role-based access (admin/user) | Admin managed |
| `plans` | Subscription plans | Public read (active), admin manage |
| `subscriptions` | User subscriptions | Owner read own, admin manage |
| `platform_config` | Global settings (name, currency, WhatsApp creds) | Public read, admin manage |
| `whatsapp_config` | Per-store WhatsApp API settings | Owner CRUD, admin manage |
| `whatsapp_messages` | WhatsApp message log | Owner CRUD, admin read |
| `whatsapp_templates` | WhatsApp message templates | Owner CRUD, admin manage |
| `whatsapp_bulk_campaigns` | Bulk campaign records | Owner CRUD |
| `whatsapp_scheduled` | Scheduled messages | Owner CRUD |
| `whatsapp_optouts` | Opt-out phone numbers | Owner read, auto-managed |
| `email_send_log` | Email delivery tracking | Service role only |
| `email_send_state` | Email queue configuration | Service role only |
| `email_unsubscribe_tokens` | Email unsubscribe tokens | Service role only |
| `suppressed_emails` | Suppressed email addresses | Service role only |

### Critical Security Functions (SECURITY DEFINER)
```sql
-- Check if user owns a store
is_store_owner(_store_id uuid) → boolean

-- Check if user is blocked
is_user_blocked() → boolean

-- Check if store is active (not suspended)
is_store_active(_store_id uuid) → boolean

-- Check admin role
has_role(_user_id uuid, _role app_role) → boolean

-- Check storefront customer identity
is_storefront_customer(_customer_id uuid) → boolean

-- Prevent self-unblock (trigger)
prevent_self_unblock() — rejects block status changes by non-admins

-- Secure payment config retrieval (hides secret key)
get_store_payment_config(_store_id uuid) → json

-- Optimized storefront data (strips owner_email, owner_id)
get_storefront_data(_slug text) → json

-- Product limit check
check_product_limit(_user_id uuid) → json

-- Admin stats & analytics
get_admin_stats() → json
get_admin_analytics() → json
get_admin_users_stores() → json
```

### Auto-Created on Signup (Trigger: `handle_new_user`)
- Creates a `profiles` row
- Auto-assigns the free plan subscription

---

## 5. EDGE FUNCTIONS REFERENCE

| Function | JWT | Purpose |
|---|---|---|
| `auth-proxy` | — | Proxy auth requests |
| `auth-email-hook` | No | Custom email templates (Resend) |
| `create-guest-account` | No | Create guest checkout accounts |
| `notify-order` | No | Send order notifications |
| `place-order` | — | Process order placement |
| `razorpay-order` | No | Create Razorpay payment order |
| `razorpay-verify` | No | Verify Razorpay payment signature |
| `razorpay-upi-intent` | No | Generate UPI deep link |
| `razorpay-payment-status` | No | Check payment status |
| `og-meta` | No | Return store OG metadata as JSON |
| `share-page` | — | Serve OG-rich HTML for social crawlers |
| `robots-txt` | No | Dynamic robots.txt per store |
| `sitemap` | No | Dynamic XML sitemap per store |
| `track-view` | — | Record page view analytics |
| `process-email-queue` | Yes | PGMQ email queue processor (~120/min) |
| `whatsapp-send` | No | Send WhatsApp messages via Meta API |
| `whatsapp-templates` | No | Manage WhatsApp templates |
| `whatsapp-webhook` | No | Receive WhatsApp webhooks |

### Edge Function Rules
- Code lives in `supabase/functions/<name>/index.ts`
- All functions need CORS headers
- Use `supabase.auth.getUser()` (NOT `auth.getClaims()`)
- Never call via path like `/api/function-name` — use `supabase.functions.invoke()`
- Never execute raw SQL — use typed client APIs
- Email system uses PGMQ pattern: `enqueue_email` RPC → `process-email-queue` function

---

## 6. CLOUDFLARE WORKER SETUP (NEW DOMAIN)

### Step 1: Change Your Domain
Replace `storivo.in` with your domain everywhere:

**Files to update:**
1. `src/lib/subdomain.ts` — Change `ROOT_DOMAIN`
2. `docs/cloudflare-worker-unified.js` — Change `ROOT_DOMAIN`

### Step 2: Cloudflare DNS Configuration

| Record | Type | Name | Value | Proxy |
|---|---|---|---|---|
| Root | A | `@` | Your hosting IP | DNS Only (grey) ☁️ |
| WWW | A | `www` | Your hosting IP | DNS Only (grey) ☁️ |
| Wildcard | A | `*` | `192.0.2.1` (dummy) | Proxied (orange) 🟠 |

**Why this setup:**
- Root + www: Grey cloud so Lovable/your host can provision SSL
- Wildcard: Orange cloud so Cloudflare Worker intercepts subdomain traffic
- The dummy IP (`192.0.2.1`) is never hit — the Worker handles all requests

### Step 3: Deploy Cloudflare Worker

1. Go to **Cloudflare Dashboard → Workers & Pages → Create Worker**
2. Name it: `your-brand-router`
3. Paste the code from `docs/cloudflare-worker-unified.js`
4. **Update these values in the code:**
   - `ROOT_DOMAIN` → your domain
   - `SUPABASE_URL` → your Supabase project URL
   - `SUPABASE_ANON_KEY` → your Supabase anon key

### Step 4: Add Worker Routes

Go to **Your Zone → Workers Routes** and add:

| Route | Worker |
|---|---|
| `*.yourdomain.com/*` | `your-brand-router` |
| `yourdomain.com/store/*` | `your-brand-router` |

### Step 5: SSL Settings

- Set **SSL/TLS encryption mode** to **Full (strict)**
- If getting "Error 1000": Make sure wildcard A record uses a non-Cloudflare IP (use `192.0.2.1`)

### Worker Capabilities
The unified Cloudflare Worker handles:
1. **301 Redirects**: `yourdomain.com/store/myshop` → `myshop.yourdomain.com`
2. **OG Rewriting**: Detects social crawlers → injects store-specific Open Graph tags
3. **SEO Files**: Routes `/sitemap.xml` and `/robots.txt` to edge functions
4. **Normal Proxy**: All other requests pass through to origin

---

## 7. SECRETS & API KEYS

### Currently Configured Secrets
| Secret | Purpose |
|---|---|
| `LOVABLE_API_KEY` | Lovable AI integration |
| `RESEND_API_KEY` | Email sending via Resend |
| `SUPABASE_URL` | Backend URL |
| `SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-level backend access |
| `SUPABASE_DB_URL` | Direct database connection |
| `SUPABASE_PUBLISHABLE_KEY` | Frontend publishable key |

### For New Deployment, You Need:
1. **Supabase project** → Get URL, anon key, service role key
2. **Resend account** → Get API key for email
3. **Razorpay account** (per store) → Each seller enters their own keys
4. **Meta WhatsApp Business API** (optional) → For platform-managed WhatsApp

### Frontend Environment Variables (.env)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

---

## 8. AUTHENTICATION SYSTEM

### Two Separate Auth Systems

#### 1. Platform Auth (Store Owners/Sellers)
- Email/password signup with email verification
- Password reset flow
- Routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`
- Context: `AuthContext.tsx`
- On signup: auto-creates profile + free plan subscription (via `handle_new_user` trigger)

#### 2. Storefront Auth (Buyers)
- Email/password with **auto-confirm** (no email verification)
- Guest checkout via `create-guest-account` edge function
- Per-store customer profiles in `storefront_customers` table
- Routes: `/store/:slug/login`, `/store/:slug/signup`
- Context: `StorefrontAuthContext.tsx`
- Pseudo-email for guests: `[phone]@phone.guest`

#### 3. Admin Auth
- Separate login at `/admin/login`
- Role checked via `user_roles` table with `has_role()` function
- Protected by `AdminRoute.tsx` component

### Creating an Admin User
```sql
INSERT INTO user_roles (user_id, role) VALUES ('user-uuid-here', 'admin');
```

---

## 9. PAYMENT INTEGRATION (RAZORPAY)

### How It Works
- Each store owner enters their own Razorpay credentials in Dashboard → Payments
- Stored in `store_payment_config` table (secret hidden via secure RPC)
- Edge functions handle the payment lifecycle

### Payment Flow
1. **Order Created** → `razorpay-order` edge function creates Razorpay order
2. **Payment UI** → Shiprocket-style card grid (GPay, PhonePe, Paytm, UPI)
3. **SDK Config** → `show_default_blocks: false` to suppress default tabs
4. **Verification** → `razorpay-verify` confirms payment signature
5. **Status Check** → `razorpay-payment-status` for async status

### Supported Payment Methods
- **UPI Intent** — Direct app launch (GPay, PhonePe, Paytm)
- **Cards, Net Banking, Wallets** — Via "More payment options" section
- **Cash on Delivery (COD)** — Manual fulfillment

### Payment UI Design
- 4-column grid of rounded cards with circular icon backgrounds
- Official payment provider logos in `public/icons/`
- Selection shadow effect on active payment method

---

## 10. WHATSAPP MARKETING SUITE

### Dual-Mode Architecture

#### Mode 1: "Platform Marketing" (Managed)
- Uses platform-level WhatsApp credentials from `platform_config` table
- Zero setup for sellers — just enable and use
- 5-tab dashboard: Automations, Segments, Bulk, Templates, Stats

#### Mode 2: "Own Business API"
- Seller enters their own Meta WhatsApp Business API credentials
- Stored in `whatsapp_config` table per store
- 8-tab expanded suite

### Credential Resolution
Edge functions automatically resolve credentials:
1. Check store's `whatsapp_config` → use if exists
2. Fallback to `platform_config` → platform-managed mode

### Features
- **Bulk Messaging** — With 0.5s delay between sends (Meta rate limiting)
- **Template Management** — Create, submit for Meta approval, track status
- **Automated Responses** — Session messages (24h window, no template needed)
- **Opt-Out Compliance** — Auto-processes "STOP" keywords
- **Admin Panel** — Global message monitoring, platform broadcasts

### Meta API Limits
- 250 business-initiated messages/day (unverified accounts)
- Session messages (within 24h of customer message) = unlimited
- Marketing/bulk = requires Meta-approved templates

---

## 11. THEME SYSTEM

### Available Themes
| ID | Name | Style |
|---|---|---|
| `theme-1` | Classic | Clean grid layout |
| `theme-2` | Modern | Bold typography, dark accents |
| `theme-3` | App Style | Mobile-app feel with bottom nav |
| `theme-4` | Luxury | Elegant, serif fonts |
| `theme-5` | Starter | Simple, beginner-friendly |
| `theme-6` | Professional | Business-oriented |
| `theme-7` | Starter V2 | Enhanced starter |
| `theme-8` | Mobile App | Purple/blue pill-style bottom tabs |
| `theme-9` | Discovery Feed | Social media-style feed |
| `theme-10` | Fashion Runway | Fashion e-commerce style |

### Per-Store Customization (`store_theme_config`)
| Property | Default | Description |
|---|---|---|
| `primary_color` | `#b8873c` | Main brand color |
| `accent_color` | `#000000` | Secondary accent |
| `background_color` | `#f7f5f0` | Page background |
| `text_color` | `#1a1a1a` | Body text |
| `heading_font` | `Alegreya SC` | Heading typeface |
| `body_font` | `Inter` | Body typeface |
| `button_style` | `rounded` | Options: rounded, pill, sharp |
| `marquee_gradient` | Gold gradient | Top announcement bar |

### Architecture
- Layout: `src/layouts/StorefrontLayout[Version].tsx`
- Home: `src/pages/StorefrontHome[Version].tsx`
- Shared: Product cards, cart, search, footer are shared across all themes
- Theme selected via `stores.theme` column, rendered dynamically

---

## 12. CHECKOUT & ORDER FLOW

### Express Checkout (Optimized)
- **Phone-first** — phone number is the primary identifier
- **Guest checkout** — auto-creates account with `[phone]@phone.guest`
- **Pincode auto-fill** — India Post API fetches city/state from pincode
- **Distraction-free UI** — no header clutter, back-arrow with exit confirmation
- **Express Buy bar** — sticky bar on product pages for returning users
- **Typography** — Montserrat, 13px base, 11px placeholders
- **Order-placed event** — disables exit confirmation after successful transaction

### Order Lifecycle
```
Confirmed → Shipped → Delivered
                  └→ Cancelled
```
- Order numbers: Shopify-style sequential (#1001, #1002, ...)
- Shipping labels: 4×6 inch thermal-optimized
- Delete: Available for owners/admins with AlertDialog confirmation

---

## 13. SEO & SOCIAL SHARING

### Built-in SEO
- **JSON-LD** structured data via `useJsonLd` hook
- **Meta tags** via `useMetaTags` hook
- **Dynamic sitemaps** — per-store XML sitemaps via edge function
- **Dynamic robots.txt** — per-store via edge function
- **Canonical URLs** — injected by Cloudflare Worker

### Social Media Previews
- **Problem**: Cloudflare WAF blocks social crawlers on subdomains
- **Solution**: `share-page` edge function serves OG-rich HTML to crawlers
- **Crawler detection**: WhatsApp, Facebook, Twitter, Telegram, LinkedIn, etc.
- **Human redirect**: Instant meta-refresh + JS redirect to actual store
- **Image handling**: Shopify URLs auto-converted from WebP → progressive JPEG
- **Cache busting**: Dynamic version timestamp prevents stale previews

### Cloudflare Worker OG Rewriting
The unified Worker also handles OG rewriting:
1. Detects social crawler User-Agent
2. Fetches store metadata from `og-meta` edge function
3. Strips existing meta tags
4. Injects store-specific OG/Twitter tags
5. Returns rewritten HTML

---

## 14. ADMIN PANEL

### Access
- URL: `/admin/login`
- Requires `admin` role in `user_roles` table
- Protected by `AdminRoute.tsx`

### Dashboard (get_admin_stats RPC)
- Total users, stores, products, orders, revenue
- Suspended stores count, blocked users count
- Recent 5 signups, recent 5 orders

### Unified Users & Stores (get_admin_users_stores RPC)
- All users with their store metadata
- Product counts, order counts per store
- Block/unblock users, suspend/unsuspend stores

### Analytics (get_admin_analytics RPC)
- Stores created by month
- Revenue by month
- Users by month

### Platform Settings
- `platform_config` table (single row)
- Platform name, default currency
- WhatsApp credentials for managed mode

---

## 15. SECURITY HARDENING

### Data Protection
- **PII Access**: Customer names, phones, addresses restricted to store owners + purchasing customer
- **Owner Info**: `stores_public` view hides `owner_email` and `owner_id`
- **Payment Keys**: `get_store_payment_config` RPC hides `razorpay_key_secret`
- **Blocked Users**: `is_user_blocked()` check on all write operations
- **Self-Unblock Prevention**: `prevent_self_unblock` trigger — only admins can change block status

### RLS Patterns
- Store owners: `is_store_owner(store_id) AND NOT is_user_blocked()`
- Admin: `has_role(auth.uid(), 'admin')`
- Public writes: Only to non-suspended stores `is_store_active(store_id)`
- Subscriptions: Insert restricted (auto-created by trigger only)

### Security Functions (All SECURITY DEFINER)
All security functions use `SECURITY DEFINER` with `SET search_path TO 'public'` to prevent path injection.

---

## 16. SUBSCRIPTION & PRICING MODEL

### Tiers
| Plan | Price | Product Limit |
|---|---|---|
| Free | ₹0/month | 10 products |
| Starter | ₹499-699/month | 50 products |
| Pro | ₹999/month | Unlimited (NULL) |
| Business | ₹1,999/month | Unlimited + priority support |

### How It Works
- Plans stored in `plans` table
- Subscriptions in `subscriptions` table
- Auto-assigned free plan on signup (via `handle_new_user` trigger)
- `check_product_limit` RPC enforces limits
- NULL `product_limit` = unlimited (rendered as ∞)

---

## 17. STORAGE BUCKETS

| Bucket | Public | Purpose |
|---|---|---|
| `store-logos` | Yes | Store logo images |
| `store-banners` | Yes | Store banner/hero images |
| `product-images` | Yes | Product photos |
| `whatsapp-media` | Yes | WhatsApp media files |

All buckets are public for storefront display. Max file size: 16MB.

---

## 18. STEP-BY-STEP NEW DEPLOYMENT

### For a completely new white-label instance:

#### Phase 1: Supabase Setup
1. Create new Supabase project
2. Run all migrations from `supabase/migrations/` in order
3. Note: URL, anon key, service role key
4. Set up storage buckets: `store-logos`, `store-banners`, `product-images`, `whatsapp-media`

#### Phase 2: Secrets Configuration
Set these Edge Function secrets:
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
RESEND_API_KEY (for emails)
```

#### Phase 3: Branding Changes
1. `index.html` — Update `<title>`, favicon references
2. `public/favicon.ico` — Replace with your icon
3. `public/pwa-192x192.png`, `pwa-512x512.png` — Replace PWA icons
4. `vite.config.ts` — Update PWA plugin: `name`, `short_name`, `theme_color`
5. `src/pages/Index.tsx` — Redesign landing page
6. `src/pages/Login.tsx`, `Signup.tsx` — Update branding
7. `src/pages/AdminLogin.tsx` — Update admin branding
8. `src/components/storefront/StorefrontFooter.tsx` — Change "Powered by"
9. `src/index.css` — Update CSS color variables
10. `src/lib/subdomain.ts` — Change `ROOT_DOMAIN`

#### Phase 4: Domain & Cloudflare
1. Buy your domain
2. Add to Cloudflare (free plan works)
3. Set DNS records (see Section 6)
4. Deploy Cloudflare Worker (update domain + Supabase credentials)
5. Add Worker routes
6. Set SSL to Full (strict)

#### Phase 5: Deploy Frontend
```bash
npm run build
# Deploy dist/ to Lovable, Vercel, Netlify, or any static host
```

#### Phase 6: Create Admin User
1. Sign up normally on the platform
2. Insert admin role:
```sql
INSERT INTO user_roles (user_id, role) VALUES ('your-user-uuid', 'admin');
```

#### Phase 7: Configure Platform
1. Login to admin panel (`/admin/login`)
2. Go to Settings → Set platform name, currency
3. (Optional) Set WhatsApp credentials for managed mode

#### Phase 8: Insert Plans
```sql
INSERT INTO plans (name, slug, price, currency, product_limit) VALUES
('Free', 'free', 0, 'INR', 10),
('Starter', 'starter', 699, 'INR', 50),
('Pro', 'pro', 999, 'INR', NULL),
('Business', 'business', 1999, 'INR', NULL);
```

---

## 19. BUSINESS VALUATION GUIDE

### Asset Value (Pre-Revenue)
| Asset | Worth |
|---|---|
| Full codebase (10 themes, payments, WhatsApp, admin) | ₹8-15L |
| Multi-tenant architecture | ₹3-5L |
| Security hardening (RLS, triggers) | ₹2-3L |
| **Total Platform Value** | **₹15-25L** |

### Revenue Projections
| Customers | Avg Plan | MRR | ARR | Valuation (8x) |
|---|---|---|---|---|
| 30 | ₹499 | ₹15K | ₹1.8L | ₹14L |
| 30 | ₹699 | ₹21K | ₹2.5L | ₹20L |
| 100 | ₹699 | ₹70K | ₹8.4L | ₹67L |
| 300 | ₹699 | ₹2.1L | ₹25L | ₹2Cr |

### Growth Strategy
1. Bootstrap to ₹2L+ MRR before seeking equity
2. Add high-margin AI features (chatbots, bot calling)
3. White-label agency contracts (₹30K-75K/month each)
4. Transaction fee layer (1.5-2% on payments)

---

*© 2026 — White-Label E-Commerce SaaS Platform. Complete Knowledge Guide.*
