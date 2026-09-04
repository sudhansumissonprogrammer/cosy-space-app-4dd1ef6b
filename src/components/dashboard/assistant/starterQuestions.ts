/** Page-aware suggested questions for the Store Assistant. */
export function starterQuestions(pathname: string): string[] {
  const p = pathname;
  if (p.includes("/payments")) {
    return [
      "How do I connect Razorpay?",
      "How do I enable COD with an advance payment?",
      "Which payment method should I turn on first?",
      "Analyse my store and tell me what to fix for more sales",
    ];
  }
  if (p.includes("/orders")) {
    return [
      "How do I add a tracking number to an order?",
      "Why are so many orders getting cancelled?",
      "How do I cancel an order and refund the customer?",
      "Analyse my store and tell me what to fix for more sales",
    ];
  }
  if (p.includes("/products") || p.includes("/categories")) {
    return [
      "How do I add my first product?",
      "How do I upload many products at once?",
      "How do I create a category?",
      "Generate a festive campaign image for one of my products",
      "Analyse my store and tell me what to fix for more sales",
    ];
  }
  if (p.includes("/shipping")) {
    return [
      "How do I set free shipping above a cart value?",
      "How do I connect Delhivery for tracking?",
      "Why is India Post tracking not updating?",
      "Analyse my store and tell me what to fix for more sales",
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
      "Why did my conversion rate drop?",
    ];
  }
  if (p.includes("/analytics")) {
    return [
      "Give me this month's summary",
      "Why did my conversion rate drop?",
      "Which traffic source is actually bringing sales?",
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
      "Analyse my store and tell me what to fix for more sales",
    ];
  }
  if (p.includes("/customers") || p.includes("/leads") || p.includes("/reviews")) {
    return [
      "How do I export my customers to Excel?",
      "A customer is asking where their order is — what do I do?",
      "How do I collect more product reviews?",
      "Analyse my store and tell me what to fix for more sales",
    ];
  }
  return [
    "What's left to complete my store setup?",
    "Check my store and tell me what to fix to get more sales",
    "Give me this month's summary",
    "Set up my store step by step",
    "How do I add a payment gateway?",
    "How do I add the Meta Pixel and CAPI?",
    "I get visitors but no sales — what should I fix?",
  ];
}

