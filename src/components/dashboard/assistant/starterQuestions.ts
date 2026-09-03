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
      "Why does my store say 'store not found'?",
    ];
  }
  if (p.includes("/tracking") || p.includes("/funnel")) {
    return [
      "How do I add the Meta Pixel step by step?",
      "How do I add the CAPI token?",
      "Where are people dropping off in my funnel?",
    ];
  }
  if (p.includes("/analytics")) {
    return [
      "Why doesn't my revenue match my bank?",
      "Which numbers should I check daily?",
      "I get visitors but no sales — what should I fix?",
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
      "When do I actually get my order money?",
    ];
  }
  if (p.includes("/whatsapp") || p.includes("/coupons") || p.includes("/abandoned")) {
    return [
      "How do I recover abandoned carts?",
      "How do I create a discount coupon?",
      "How do I send a WhatsApp campaign to my customers?",
    ];
  }
  if (p.includes("/customers") || p.includes("/leads") || p.includes("/reviews")) {
    return [
      "How do I export my customers to Excel?",
      "A customer is asking where their order is — what do I do?",
      "How do I collect more product reviews?",
    ];
  }
  return [
    "Set up my store step by step",
    "How do I add a payment gateway?",
    "How do I add the Meta Pixel and CAPI?",
    "I get visitors but no sales — what should I fix?",
  ];
}

