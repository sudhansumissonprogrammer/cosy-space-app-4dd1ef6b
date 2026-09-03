/** Page-aware suggested questions for the Store Assistant. */
export function starterQuestions(pathname: string): string[] {
  const p = pathname;
  if (p.includes("/payments")) {
    return [
      "How do I connect Razorpay?",
      "How do I enable COD with an advance payment?",
      "Which payment method should I turn on first?",
    ];
  }
  if (p.includes("/orders")) {
    return [
      "How do I add a tracking number to an order?",
      "Why are so many orders pending or cancelled?",
      "How do I cancel an order and refund the customer?",
    ];
  }
  if (p.includes("/products") || p.includes("/categories")) {
    return [
      "How do I add my first product?",
      "How do I upload many products at once?",
      "How do I create a category?",
    ];
  }
  if (p.includes("/shipping")) {
    return [
      "How do I set free shipping above a cart value?",
      "How do I connect Delhivery for tracking?",
      "Why is India Post tracking not updating?",
    ];
  }
  if (p.includes("/domain")) {
    return [
      "How do I connect my own domain?",
      "My domain is not verifying — what should I check?",
    ];
  }
  if (p.includes("/settings") || p.includes("/pages") || p.includes("/theme")) {
    return [
      "How do I change my store logo and banner?",
      "How do I write my About Us and return policy?",
      "How do I improve my store's SEO?",
    ];
  }
  if (p.includes("/wallet")) {
    return [
      "How does the 2% commission work?",
      "How do I recharge my wallet?",
      "Do I get the commission back if an order is cancelled?",
    ];
  }
  if (p.includes("/whatsapp") || p.includes("/coupons") || p.includes("/abandoned")) {
    return [
      "How do I recover abandoned carts?",
      "How do I create a discount coupon?",
      "Which WhatsApp messages are sent automatically?",
    ];
  }
  return [
    "How do I add a payment gateway?",
    "How do I add my first product?",
    "How do I connect my own domain?",
    "How do I get more sales?",
  ];
}
