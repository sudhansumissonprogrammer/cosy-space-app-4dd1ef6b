# White-Label E-Commerce Platform — Technical Documentation & Deployment Guide

> **Version**: 1.0 | **Last Updated**: March 2026

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Architecture](#2-architecture)
3. [Feature List](#3-feature-list)
4. [Tech Stack](#4-tech-stack)
5. [Deployment Guide](#5-deployment-guide)
6. [Branding & Customization](#6-branding--customization)
7. [Database Schema](#7-database-schema)
8. [Authentication](#8-authentication)
9. [Payments Integration](#9-payments-integration)
10. [Theme System](#10-theme-system)
11. [Edge Functions](#11-edge-functions)
12. [Environment Variables](#12-environment-variables)
13. [DNS & Custom Domains](#13-dns--custom-domains)
14. [Admin Panel](#14-admin-panel)
15. [API Reference](#15-api-reference)
16. [Troubleshooting](#16-troubleshooting)
17. [Support & SLA](#17-support--sla)

---

## 1. Platform Overview

A fully-featured, multi-tenant e-commerce SaaS platform that enables end-users (store owners) to create, manage, and run online stores without technical knowledge. The platform is designed for the Indian market with native support for UPI, Razorpay, COD, and WhatsApp ordering.

### Key Value Propositions
- **Zero-code store creation** — sellers go live in under 5 minutes
- **10 mobile-first themes** — instant switching, no reload
- **India-first payments** — Razorpay, UPI, GPay, PhonePe, COD
- **WhatsApp commerce** — order via WhatsApp with one tap
- **Multi-tenant architecture** — single deployment, unlimited stores
- **PWA support** — app-like experience on mobile

---

## 2. Architecture

```
┌─────────────────────────────────────────────────┐
│                  Frontend (React + Vite)         │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Admin     │  │ Dashboard│  │ Storefront   │  │
│  │ Panel     │  │ (Seller) │  │ (Buyer)      │  │
│  └───────────┘  └──────────┘  └──────────────┘  │
└─────────────────────┬───────────────────────────┘
                      │
              ┌───────▼───────┐
              │   Supabase    │
              │  ┌──────────┐ │
              │  │ Auth     │ │
              │  │ Database │ │
              │  │ Storage  │ │
              │  │ Edge Fn  │ │
              │  │ Realtime │ │
              │  └──────────┘ │
              └───────────────┘
                      │
              ┌───────▼───────┐
              │  Razorpay API │
              └───────────────┘
```

### Request Flow
1. User visits `brand.yourdomain.com`
2. Cloudflare Worker proxies to main app
3. Client detects subdomain → fetches store data
4. Supabase RLS ensures data isolation per store
5. Storefront renders with store-specific theme/products

---

## 3. Feature List

### Seller Dashboard
| Feature | Description |
|---|---|
| Store Creation | One-click store setup with slug-based URLs |
| Product Management | CRUD with images, variants, SKUs, categories |
| Bulk Upload | CSV-based bulk product import |
| Order Management | View, update status, add tracking |
| Customer Management | Customer list with order history |
| Coupon System | Percentage/fixed discounts with expiry |
| Analytics | Page views, order stats, revenue charts |
| Shipping Config | Flat rate, free shipping thresholds |
| Tax Config | Inclusive/exclusive tax with custom rates |
| Payment Config | Razorpay setup, COD toggle, UPI options |
| Theme Selector | 10 themes with live preview |
| Theme Customization | Colors, fonts, button styles per store |
| SEO Settings | Meta title, description, OG images |
| Facebook Pixel | Built-in pixel tracking |
| WhatsApp Integration | Floating WhatsApp button, order via WhatsApp |
| Customer Leads | Phone-based lead capture |
| Abandoned Carts | Track and recover abandoned carts |
| Share Store | Social sharing dialog |
| Domain Settings | Custom domain configuration |
| Store Policies | Return, shipping, privacy, terms pages |

### Storefront (Buyer-Facing)
| Feature | Description |
|---|---|
| 10 Mobile-First Themes | Minimal, Bold, App-style, Luxury, etc. |
| Product Catalog | Grid/list with search & category filters |
| Product Detail | Image gallery, variants, accordion details |
| Cart & Checkout | Side cart, full checkout with address |
| Customer Accounts | Signup/login, order history, saved addresses |
| Wishlist | Save products, persist across sessions |
| Best Sellers | Carousel of best-selling products |
| Search | Full-text search with overlay |
| PWA | Installable app with offline support |
| SEO | JSON-LD, meta tags, sitemaps, robots.txt |

### Admin Panel (Platform Owner)
| Feature | Description |
|---|---|
| Overview Dashboard | Total stores, users, orders, revenue |
| User Management | View, block/unblock users |
| Store Management | View, suspend/unsuspend stores |
| Order Overview | All orders across all stores |
| Analytics | Platform-wide analytics |
| Subscription Management | Plan management per user |

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui, Radix UI |
| State | TanStack React Query |
| Routing | React Router v6 |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Payments | Razorpay (Orders, UPI Intent, Verification) |
| Hosting | Lovable (or any static host + Supabase) |
| DNS | Cloudflare (subdomain routing via Workers) |
| PWA | vite-plugin-pwa |

---

## 5. Deployment Guide

### Prerequisites
- Node.js 18+ and npm/bun
- A Supabase project (free tier works for development)
- A Razorpay account (for payment processing)
- A domain name
- Cloudflare account (for subdomain routing)

### Step 1: Clone & Install

```bash
git clone <your-repo-url>
cd <project-folder>
npm install
```

### Step 2: Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Run all migrations from `supabase/migrations/` in order:
   ```bash
   supabase db push
   ```
3. Note your project URL and anon key

### Step 3: Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbG...your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### Step 4: Edge Function Secrets

Set these secrets in your Supabase project:

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxx
supabase secrets set RAZORPAY_KEY_SECRET=xxx
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Step 5: Deploy Edge Functions

```bash
supabase functions deploy auth-proxy
supabase functions deploy create-guest-account
supabase functions deploy notify-order
supabase functions deploy razorpay-order
supabase functions deploy razorpay-verify
supabase functions deploy razorpay-upi-intent
supabase functions deploy razorpay-payment-status
supabase functions deploy robots-txt
supabase functions deploy sitemap
supabase functions deploy track-view
```

### Step 6: Build & Deploy Frontend

```bash
npm run build
```

Deploy the `dist/` folder to any static hosting:
- **Vercel**: `vercel --prod`
- **Netlify**: Drag & drop `dist/`
- **Cloudflare Pages**: Connect repo
- **Custom server**: Serve `dist/` with nginx

### Step 7: DNS Configuration

See [Section 13](#13-dns--custom-domains) for full DNS setup.

---

## 6. Branding & Customization

### Platform Branding (Your Brand)

| Item | Location | How to Change |
|---|---|---|
| Platform name | `index.html` `<title>` | Edit `<title>` tag |
| Favicon | `public/favicon.ico` | Replace file |
| PWA icons | `public/pwa-192x192.png`, `public/pwa-512x512.png` | Replace files |
| PWA manifest | `vite.config.ts` → PWA plugin config | Edit `name`, `short_name`, `theme_color` |
| Landing page | `src/pages/Index.tsx` | Redesign as needed |
| Login/Signup | `src/pages/Login.tsx`, `Signup.tsx` | Update branding |
| Admin login | `src/pages/AdminLogin.tsx` | Update branding |
| Footer | `src/components/storefront/StorefrontFooter.tsx` | Remove/replace "Powered by" |
| Colors | `src/index.css` → CSS variables | Update HSL values |
| Fonts | `index.html` → Google Fonts link | Change font imports |

### Store-Level Branding (Per Seller)

Each store owner can customize:
- Store name, logo, banner
- Theme selection (1 of 10)
- Color palette (primary, accent, background, text)
- Heading & body fonts
- Button styles (rounded, pill, sharp)
- Marquee gradient
- WhatsApp number
- Social media links
- SEO metadata
- Store policies

These are stored in `stores` and `store_theme_config` tables.

---

## 7. Database Schema

### Core Tables

| Table | Purpose |
|---|---|
| `stores` | Store profiles, settings, owner reference |
| `products` | Product catalog per store |
| `product_images` | Multiple images per product |
| `product_variants` | Size/color variants with pricing |
| `categories` | Product categories per store |
| `orders` | Order records with status tracking |
| `order_items` | Line items per order |
| `customers` | Customer records per store |
| `storefront_customers` | Authenticated storefront buyers |
| `customer_addresses` | Saved addresses per customer |
| `customer_wishlists` | Wishlist items per customer |
| `coupons` | Discount codes per store |
| `abandoned_carts` | Abandoned cart tracking |
| `customer_leads` | Phone-based lead capture |
| `whatsapp_orders` | WhatsApp order records |
| `page_views` | Analytics page view tracking |
| `store_payment_config` | Razorpay keys per store |
| `store_shipping_config` | Shipping rates per store |
| `store_tax_config` | Tax settings per store |
| `store_theme_config` | Theme customization per store |
| `profiles` | User profiles (platform users) |
| `user_roles` | Role-based access (admin/user) |
| `plans` | Subscription plans |
| `subscriptions` | User subscriptions |

### Row-Level Security (RLS)

All tables have RLS enabled. Key patterns:
- **Store owners** can only CRUD their own store's data
- **Storefront customers** can only access their own orders/addresses
- **Public read** on products/categories/stores for storefront display
- **Admin role** checked via `has_role()` security definer function
- **Payment secrets** hidden via a public view (`store_payment_config_public`)

---

## 8. Authentication

### Two Authentication Systems

1. **Platform Auth** (Store Owners)
   - Email/password signup & login
   - Email verification required
   - Password reset flow
   - Routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`
   - Context: `AuthContext.tsx`

2. **Storefront Auth** (Buyers)
   - Email/password with auto-confirm
   - Per-store customer profiles
   - Routes: `/store/:slug/login`, `/store/:slug/signup`
   - Context: `StorefrontAuthContext.tsx`

### Admin Access
- Separate admin login at `/admin/login`
- Role checked via `user_roles` table
- Protected by `AdminRoute.tsx` component

---

## 9. Payments Integration

### Razorpay Setup

Each store owner configures their own Razorpay credentials:

1. Store owner enters Razorpay Key ID & Secret in Dashboard → Payments
2. Stored encrypted in `store_payment_config` table
3. Edge functions use these for order creation & verification

### Payment Methods Supported
- **Razorpay Checkout** — Full payment gateway
- **UPI Intent** — Direct UPI app launch (GPay, PhonePe, Paytm)
- **Cash on Delivery (COD)** — Manual fulfillment

### Edge Functions
| Function | Purpose |
|---|---|
| `razorpay-order` | Create Razorpay order |
| `razorpay-verify` | Verify payment signature |
| `razorpay-upi-intent` | Generate UPI intent link |
| `razorpay-payment-status` | Check payment status |

---

## 10. Theme System

### Available Themes

| ID | Name | Style |
|---|---|---|
| `default` | Classic | Clean grid layout |
| `theme-2` | Modern | Bold typography, dark accents |
| `theme-3` | App Style | Mobile-app feel with bottom nav |
| `theme-4` | Luxury | Elegant, serif fonts |
| `theme-5` | Starter | Simple, beginner-friendly |
| `theme-6` | Professional | Business-oriented |
| `theme-7` | Starter V2 | Enhanced starter |
| `theme-8` | Mobile App | Purple/blue pill-style bottom tabs |
| `theme-9` | Discovery Feed | Social media-style feed |
| `theme-10` | Fashion Runway | Fashion e-commerce style |

### Theme Architecture

Each theme has:
- **Layout**: `src/layouts/StorefrontLayout[Version].tsx`
- **Home Page**: `src/pages/StorefrontHome[Version].tsx`
- **Shared Components**: Product cards, cart, search, footer etc.

Themes are selected via the `stores.theme` column and rendered dynamically based on the store's configuration.

### Theme Customization

The `store_theme_config` table stores per-store:
- `primary_color`, `accent_color`, `background_color`, `text_color`
- `heading_font`, `body_font`
- `button_style` (rounded, pill, sharp)
- `marquee_gradient`

These are injected as CSS custom properties at runtime.

---

## 11. Edge Functions

| Function | Method | Purpose |
|---|---|---|
| `auth-proxy` | POST | Proxy auth requests |
| `create-guest-account` | POST | Create guest checkout account |
| `notify-order` | POST | Send order notifications |
| `razorpay-order` | POST | Create Razorpay payment order |
| `razorpay-verify` | POST | Verify Razorpay payment |
| `razorpay-upi-intent` | POST | Generate UPI deep link |
| `razorpay-payment-status` | GET | Check payment status |
| `robots-txt` | GET | Dynamic robots.txt per store |
| `sitemap` | GET | Dynamic XML sitemap per store |
| `track-view` | POST | Record page view analytics |

---

## 12. Environment Variables

### Frontend (.env)
```
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<supabase-anon-key>
VITE_SUPABASE_PROJECT_ID=<supabase-project-id>
```

### Edge Function Secrets (Supabase Dashboard)
```
RAZORPAY_KEY_ID=<razorpay-key>
RAZORPAY_KEY_SECRET=<razorpay-secret>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

---

## 13. DNS & Custom Domains

### Subdomain Routing (brand.yourdomain.com)

Uses Cloudflare Workers to route `*.yourdomain.com` to the main app:

1. **A Records** (DNS Only — grey cloud):
   - `@` → Your hosting IP
   - `www` → Your hosting IP

2. **Wildcard A Record** (Proxied — orange cloud):
   - `*` → Your hosting IP

3. **Cloudflare Worker**:
   - Intercepts requests to `*.yourdomain.com`
   - Proxies to main domain preserving `Host` header
   - Client-side JS reads `window.location.hostname` to identify store

4. **SSL**: Set Cloudflare SSL to "Full (strict)"

### Custom Domains Per Store
- Requires Cloudflare Pro plan ($20/mo) for "SSL for Custom Hostnames"
- Currently deferred — subdomain routing handles most use cases

---

## 14. Admin Panel

Access at `/admin/login` with an admin-role account.

### Features
- **Overview**: Total stores, users, orders, revenue
- **Users**: List, block/unblock platform users
- **Stores**: List, suspend/unsuspend stores
- **Orders**: All orders across platform
- **Analytics**: Platform-wide metrics
- **Subscriptions**: Manage user plans

### Creating an Admin User
1. Create a regular account via signup
2. Insert into `user_roles`:
   ```sql
   INSERT INTO user_roles (user_id, role)
   VALUES ('user-uuid-here', 'admin');
   ```

---

## 15. API Reference

All data access goes through Supabase client SDK. Key patterns:

### Fetch Store by Slug
```typescript
const { data } = await supabase
  .from('stores')
  .select('*')
  .eq('slug', slug)
  .single();
```

### Fetch Products
```typescript
const { data } = await supabase
  .from('products')
  .select('*, product_images(*), product_variants(*)')
  .eq('store_id', storeId)
  .eq('is_active', true);
```

### Create Order
```typescript
const { data } = await supabase
  .from('orders')
  .insert({ store_id, total, payment_method, ... })
  .select()
  .single();
```

### RPC Functions
```typescript
// Check product limit
await supabase.rpc('check_product_limit', { _user_id: userId });

// Get storefront data (optimized single query)
await supabase.rpc('get_storefront_data', { _slug: slug });

// Get admin stats
await supabase.rpc('get_admin_stats');
```

---

## 16. Troubleshooting

| Issue | Solution |
|---|---|
| Store not loading | Check `stores.slug` matches subdomain |
| Products not showing | Verify `is_active = true` and correct `store_id` |
| Payment failing | Check Razorpay keys in `store_payment_config` |
| Images not uploading | Verify Supabase Storage bucket policies |
| Admin panel 403 | Ensure user has `admin` role in `user_roles` |
| Theme not applying | Check `stores.theme` value matches theme ID |
| Subdomain not routing | Verify Cloudflare Worker is active and wildcard DNS is proxied |
| RLS errors | Check that user is authenticated and owns the resource |

---

## 17. Support & SLA

| Tier | Response Time | Includes |
|---|---|---|
| **Basic** | 48 hours | Email support, bug fixes |
| **Pro** | 24 hours | Priority support, deployment help |
| **Enterprise** | 4 hours | Dedicated support, custom features |

### Contact
- Email: [your-support-email]
- Documentation: This guide
- Updates: Provided per license agreement

---

## Appendix: File Structure

```
├── public/                    # Static assets, icons, product images
├── src/
│   ├── components/
│   │   ├── admin/             # Admin panel components
│   │   ├── storefront/        # Storefront UI components
│   │   └── ui/                # shadcn/ui component library
│   ├── contexts/              # Auth, Cart, Wishlist contexts
│   ├── hooks/                 # Custom hooks (SEO, pagination, etc.)
│   ├── integrations/          # Supabase client & types
│   ├── layouts/               # Theme layouts (10 variants)
│   ├── lib/                   # Utilities (image compression, subdomain)
│   ├── pages/                 # All page components
│   │   ├── admin/             # Admin panel pages
│   │   └── Storefront*.tsx    # Storefront pages (per theme)
│   └── routes/                # Route definitions
├── supabase/
│   ├── functions/             # Edge functions
│   ├── migrations/            # Database migrations
│   └── config.toml            # Supabase config
└── docs/                      # This documentation
```

---

*© 2026 — White-Label E-Commerce Platform. All rights reserved.*
