---
name: Onboarding business type + AI store copy
description: CreateStore asks "What do you sell?" (chips + free text) and AI-writes description, About Us and SEO meta
type: feature
---

- `stores.business_type` (text, nullable) stores the merchant's selected category from CreateStore chips (BUSINESS_TYPES list).
- Free-text "in your words" input maps to `stores.description` input at creation.
- On store creation, `generate-store-content` edge fn is called with `{store_name, store_description, business_type, owner_name}` (12s race timeout). Output fills `description`, `meta_title`, `meta_description`, `about_us_text`, and the `store_pages` About Us row.
- Static fallback copy (built from business type + founder name) is used if AI fails/times out — creation must never stall.
- AI prompt rule: never invent awards/years/customer counts; if products are imitation/plated, say so plainly (no real-gold implication).
