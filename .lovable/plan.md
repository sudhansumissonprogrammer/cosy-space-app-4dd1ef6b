

# Storivo Marketing Full Feature Parity + Admin WhatsApp Panel

## What We're Building

### 1. Enhanced Customer Segments (product/category/date filters)
Current segments are hardcoded groups (all, repeat, high-value, recent, inactive). We'll add:
- **Product filter**: dropdown of products, shows customers who bought that product
- **Category filter**: dropdown of categories, shows customers who bought from that category  
- **Date filter**: Today, Last 7 days, Last 30 days, Custom date range
- **"Send to Bulk" button**: directly populates the Bulk tab instead of just copying numbers

Implementation: Query `orders` → `order_items` → `products` to join product/category data with customer phones.

### 2. Bulk Messaging with Campaign History
Add a `whatsapp_bulk_campaigns` table to track bulk send history:
- Records: message, recipient count, sent/failed counts, status, timestamps
- UI: "Campaign History" section below the compose area showing past campaigns with delivery stats

### 3. Expand Storivo Mode Dashboard
Currently only 2 tabs (Automations, Stats). Expand to **6 tabs**:
- Automations | Segments | Bulk | Templates | Stats | (same components reused from Own mode)

Templates in Storivo mode will sync against the platform's WABA credentials.

### 4. Admin WhatsApp Panel (New Page)
Create `src/pages/admin/AdminWhatsApp.tsx` with tabs:
- **Chat**: Real-time view of ALL store conversations (grouped by store), using platform credentials. Same WhatsApp-style UI as Own mode ChatTab but querying all stores.
- **Bulk**: Send bulk messages using platform credentials. Manual number entry + CSV upload + Meta approved templates.
- **Templates**: Create, sync, delete templates on the platform's WABA. Same MetaTemplatesTab but for platform level.
- **Stats**: Aggregated message stats across all stores.

Add route `/admin/whatsapp` and nav item in AdminLayout.

## Database Changes

```sql
-- Bulk campaign tracking
CREATE TABLE public.whatsapp_bulk_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  admin_campaign boolean DEFAULT false,
  message_body text,
  template_name text,
  template_params jsonb,
  recipient_count int DEFAULT 0,
  sent_count int DEFAULT 0,
  failed_count int DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.whatsapp_bulk_campaigns ENABLE ROW LEVEL SECURITY;

-- Store owners manage their own campaigns
CREATE POLICY "Store owners can manage own campaigns"
  ON public.whatsapp_bulk_campaigns FOR ALL TO authenticated
  USING (is_store_owner(store_id))
  WITH CHECK (is_store_owner(store_id));

-- Admins manage all campaigns
CREATE POLICY "Admins can manage all campaigns"
  ON public.whatsapp_bulk_campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

## File Changes

| File | Change |
|------|--------|
| `src/pages/WhatsAppMarketing.tsx` | 1. Add product/category/date filters to `SegmentationTab` with "Send to Bulk" button. 2. Add campaign history tracking to `BulkMessagingTab` (insert record on send, show history list). 3. Expand `StorivoModeDashboard` from 2 tabs to 6 (Automations, Segments, Bulk, Templates, Stats). |
| `src/pages/admin/AdminWhatsApp.tsx` | New page with Chat (real-time, all stores), Bulk (manual+CSV+templates), Templates (create/sync/delete), Stats tabs. Chat uses admin service-level queries on `whatsapp_messages` across all stores. |
| `src/routes/AuthRoutes.tsx` | Add lazy import for `AdminWhatsApp`, add route `/admin/whatsapp` |
| `src/layouts/AdminLayout.tsx` | Add "WhatsApp" nav item with MessageSquare icon |
| `supabase/functions/whatsapp-send/index.ts` | Already handles marketing_mode resolution -- no changes needed |
| Migration SQL | Create `whatsapp_bulk_campaigns` table with RLS |

## Implementation Order
1. Database migration (bulk campaigns table)
2. Enhance SegmentationTab with filters + "Send to Bulk"
3. Add campaign history to BulkMessagingTab
4. Expand StorivoModeDashboard to 6 tabs
5. Build AdminWhatsApp page (Chat, Bulk, Templates, Stats)
6. Add admin route + nav item

