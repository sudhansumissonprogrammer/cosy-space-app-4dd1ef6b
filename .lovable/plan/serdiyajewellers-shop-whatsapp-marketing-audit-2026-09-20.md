# Serdiyajewellers.shop WhatsApp Marketing Audit

## Goal
Produce a detailed PDF covering WhatsApp activity, marketing spend, and revenue attributable to successful abandoned-cart messages for Serdiyajewellers.shop only.

## Attribution rule
- Normalize both WhatsApp and order phones to the same valid Indian 10-digit number.
- Consider only outgoing abandoned-cart messages recorded as sent, delivered, or read.
- Match an order placed from the same phone within 10 hours after a marketing message.
- If several eligible messages exist, assign the order to the nearest earlier message.
- Require a successful order-confirmation message for the matched order/phone shortly after checkout.
- Count each order once and classify cancelled/RTO value separately from retained revenue.

## Report contents
- Executive summary: billed marketing spend, attributed retained revenue, ROAS, and order counts.
- Full message funnel: attempted/successful/failed/delivered/read messages, contacts, replies, billing categories, and failure causes.
- Revenue analysis by month, response-time band, and template.
- Reconciliation of gross placed value versus retained non-cancelled/RTO revenue and collected advance.
- Data-quality findings and clearly stated limitations.
- Privacy-safe detailed order appendix using masked phone numbers.

## Verification
- Independently reconcile billing totals from conversation rows and monthly subtotals.
- Recalculate attributed totals using aggregate and order-level queries.
- Confirm the order-confirmation requirement independently.
- Validate PDF page rendering and arithmetic before delivery.
