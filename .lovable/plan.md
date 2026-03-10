

## Customer Accounts for Storefronts

### What We're Building
A customer authentication system for each storefront — similar to Shopify — where end customers (shoppers) can sign up, log in, and access their order history, saved addresses, and persistent wishlists.

### Key Design Decisions
- **Separate from merchant auth**: Store owners use the existing auth system. Customers use the same auth infrastructure but are distinguished by a `storefront_customers` table tied to a specific store.
- **One account per store**: A customer signing up on Store A is a separate record from Store B (like Shopify).
- **No email verification required**: Storefront customers get auto-confirmed for frictionless checkout.

### Database Changes

1. **New `storefront_customers` table**
   - `id`, `user_id` (references auth.users), `store_id`, `name`, `phone`, `email`, `created_at`
   - Unique constraint on `(user_id, store_id)` — one profile per store
   - RLS: customers can read/update their own row; store owners can view their store's customers

2. **New `customer_addresses` table**
   - `id`, `storefront_customer_id`, `label` (Home/Work), `full_name`, `phone`, `street_address`, `city`, `state`, `pincode`, `is_default`, `created_at`
   - RLS: customers can CRUD their own addresses

3. **Update `orders` table**
   - Add `storefront_customer_id` column (nullable, references `storefront_customers`)
   - Links placed orders to logged-in customers

4. **Auto-confirm signup** for storefront customers via auth config

### Frontend Changes

1. **Customer Auth Context** (`src/contexts/StorefrontAuthContext.tsx`)
   - Wraps storefront routes with customer session state
   - Provides `signUp`, `signIn`, `signOut`, `customer` object

2. **Customer Login/Signup Pages**
   - `/store/:slug/login` and `/store/:slug/signup`
   - Simple email + password forms styled to match the storefront theme

3. **Customer Account Page** (`/store/:slug/account`)
   - Tabs: **Orders**, **Addresses**, **Wishlist**
   - Orders tab: lists past orders with status
   - Addresses tab: add/edit/delete saved addresses with "set as default"
   - Wishlist tab: shows saved products (migrates from localStorage to database)

4. **Update StorefrontLayout**
   - Add user icon in navbar (shows login/account link)
   - Wrap with `StorefrontAuthProvider`

5. **Update CheckoutPage**
   - Auto-fill name, phone, address from saved customer data
   - Link order to `storefront_customer_id` when logged in

6. **Persist Wishlist to Database**
   - When logged in, sync wishlist to a new `customer_wishlists` table instead of localStorage

### Routes Added
```
/store/:slug/login
/store/:slug/signup
/store/:slug/account
/store/:slug/account/orders
/store/:slug/account/addresses
```

### Technical Notes
- Uses the same auth system (edge function `auth-proxy`) — customers and merchants share the auth infrastructure but are separated by the `storefront_customers` table
- The storefront auth context is independent from the merchant `AuthContext`
- Customer sessions persist across page reloads via the existing session management

