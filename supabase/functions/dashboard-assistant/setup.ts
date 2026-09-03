// Store setup readiness for the Store Assistant.
//
// A brand-new merchant signs up and asks "what is left to finish my store?".
// This builds the real answer from the store's own data: what is already done,
// what is still missing, why it matters, the exact dashboard page and the
// short how-to steps for each pending item.
//
// Read-only. Booleans and counts only — never keys, tokens or customer data.

export interface SetupTask {
  id: string;
  title: string;
  status: "done" | "pending";
  blocker: boolean; // store cannot take a real order until this is done
  why: string;
  path: string; // {s} = /dashboard/stores/<slug>
  steps: string[];
}

export interface SetupReadiness {
  percent_complete: number;
  can_accept_orders: boolean;
  launch_blockers: string[];
  next_3: SetupTask[];
  done: string[];
  pending: SetupTask[];
}

export async function buildSetupReadiness(admin: any, storeId: string): Promise<SetupReadiness | null> {
  const [storeRes, payRes, shipRes, prodRes, imgProdRes, catRes, pagesRes, ordersRes, pickupRes, themeRes] =
    await Promise.all([
      admin
        .from("stores")
        .select(
          "name, slug, logo_url, banner_url, description, about_us_text, meta_title, whatsapp_number, contact_email, custom_domain, domain_verified, return_policy, shipping_policy, privacy_policy, terms_conditions, facebook_pixel_id, theme",
        )
        .eq("id", storeId)
        .maybeSingle(),
      admin.from("store_payment_config").select("*").eq("store_id", storeId).maybeSingle(),
      admin.from("store_shipping_config").select("*").eq("store_id", storeId).maybeSingle(),
      admin.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("is_active", true),
      admin
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("is_active", true)
        .is("image_url", null),
      admin.from("categories").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      admin.from("store_pages").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      admin.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      admin.from("store_pickup_addresses").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      admin.from("store_theme_config").select("store_id").eq("store_id", storeId).maybeSingle(),
    ]);

  const s = storeRes?.data;
  if (!s) return null;
  const p = payRes?.data ?? {};
  const methods: string[] = Array.isArray(p?.payment_methods) ? p.payment_methods : [];
  const gatewaySaved = !!(p?.razorpay_key_id || p?.cashfree_app_id || p?.payu_merchant_key);
  const products = prodRes?.count ?? 0;
  const noImage = imgProdRes?.count ?? 0;

  const T = (t: Omit<SetupTask, "status"> & { done: boolean }): SetupTask => ({
    id: t.id,
    title: t.title,
    status: t.done ? "done" : "pending",
    blocker: t.blocker,
    why: t.why,
    path: t.path,
    steps: t.steps,
  });

  const tasks: SetupTask[] = [
    T({
      id: "products",
      title: "Add at least 3 products",
      done: products >= 3,
      blocker: products === 0,
      why: "An empty store cannot take an order and looks abandoned to visitors.",
      path: "{s}/products/new",
      steps: [
        "Open Products and tap Add product.",
        "Fill name, selling price and one clear photo.",
        "Save — the product goes live on the storefront immediately.",
      ],
    }),
    T({
      id: "product-images",
      title: "Add a photo to every live product",
      done: products > 0 && noImage === 0,
      blocker: false,
      why: "Products without a photo almost never sell and hurt ad performance.",
      path: "{s}/products",
      steps: [
        "Open Products and look for items showing no image.",
        "Edit the product and upload a square photo in Images.",
        "Save.",
      ],
    }),
    T({
      id: "payments",
      title: "Turn on a payment method",
      done: methods.length > 0 && (gatewaySaved || methods.includes("cod") || methods.includes("upi")),
      blocker: methods.length === 0,
      why: "Without a payment method the checkout has nothing to charge with.",
      path: "{s}/payments",
      steps: [
        "Open Payments.",
        "Turn on COD and UPI to start selling the same day.",
        "Paste Razorpay, Cashfree or PayU keys when you want online payments.",
      ],
    }),
    T({
      id: "shipping",
      title: "Set delivery charges",
      done: !!shipRes?.data,
      blocker: !shipRes?.data,
      why: "Checkout needs a shipping rule, otherwise buyers see wrong or zero delivery charge.",
      path: "{s}/shipping",
      steps: [
        "Open Shipping.",
        "Set a flat delivery charge and a free-shipping cart value.",
        "Save.",
      ],
    }),
    T({
      id: "pickup-address",
      title: "Add your pickup address",
      done: (pickupRes?.count ?? 0) > 0,
      blocker: false,
      why: "Courier bookings and labels need a pickup address with pincode.",
      path: "{s}/shipping",
      steps: ["Open Shipping and go to Pickup address.", "Add full address with pincode and phone.", "Save."],
    }),
    T({
      id: "whatsapp",
      title: "Add your WhatsApp number",
      done: !!s.whatsapp_number,
      blocker: false,
      why: "Order confirmations, cart recovery and buyer questions all run on WhatsApp.",
      path: "{s}/settings",
      steps: ["Open Store settings.", "Enter your WhatsApp number with country code.", "Save."],
    }),
    T({
      id: "branding",
      title: "Upload logo and banner",
      done: !!s.logo_url && !!s.banner_url,
      blocker: false,
      why: "A store with a default logo looks untrusted and lowers conversion.",
      path: "{s}/settings",
      steps: ["Open Store settings.", "Upload logo (square) and home banner.", "Save."],
    }),
    T({
      id: "about",
      title: "Write store description and About Us",
      done: !!s.description && !!s.about_us_text,
      blocker: false,
      why: "Buyers and Google both read this before trusting a new shop.",
      path: "{s}/pages",
      steps: ["Open Pages.", "Fill About Us in 4-5 lines: what you sell and why.", "Save."],
    }),
    T({
      id: "policies",
      title: "Publish return, shipping and privacy policies",
      done: !!s.return_policy && !!s.shipping_policy && !!s.privacy_policy && !!s.terms_conditions,
      blocker: false,
      why: "Payment gateways and Meta ads reject stores without visible policies.",
      path: "{s}/pages",
      steps: ["Open Pages.", "Fill Return, Shipping, Privacy and Terms.", "Save — they appear in the footer."],
    }),
    T({
      id: "categories",
      title: "Create categories",
      done: (catRes?.count ?? 0) > 0,
      blocker: false,
      why: "Categories let buyers browse instead of scrolling one long list.",
      path: "{s}/categories",
      steps: ["Open Categories.", "Add 2-4 categories.", "Assign products to them from the product page."],
    }),
    T({
      id: "theme",
      title: "Pick a theme and arrange the home page",
      done: !!themeRes?.data || !!s.theme,
      blocker: false,
      why: "The default layout is fine, but a chosen theme fits your product type better.",
      path: "{s}/theme",
      steps: ["Open Theme.", "Preview a few themes.", "Apply the one that suits your products."],
    }),
    T({
      id: "seo",
      title: "Set SEO title and description",
      done: !!s.meta_title,
      blocker: false,
      why: "This is the text Google and WhatsApp previews show for your store link.",
      path: "{s}/settings",
      steps: ["Open Store settings and scroll to SEO.", "Write a title under 60 characters.", "Save."],
    }),
    T({
      id: "pixel",
      title: "Connect Meta Pixel (only if you will run ads)",
      done: !!s.facebook_pixel_id,
      blocker: false,
      why: "Without the Pixel, Meta cannot optimise or report your ad sales.",
      path: "{s}/tracking",
      steps: ["Open Tracking.", "Paste your Pixel ID from Meta Events Manager.", "Add the CAPI token for accurate tracking."],
    }),
    T({
      id: "domain",
      title: "Connect your own domain (optional)",
      done: !!s.custom_domain && !!s.domain_verified,
      blocker: false,
      why: "Your free .shopbanao.in link works fine; a custom domain builds more trust.",
      path: "{s}/domain",
      steps: ["Open Domain.", "Enter the domain you bought.", "Add the shown DNS records at your registrar and verify."],
    }),
    T({
      id: "test-order",
      title: "Place one test order yourself",
      done: (ordersRes?.count ?? 0) > 0,
      blocker: false,
      why: "It proves checkout, payment and the WhatsApp confirmation all work before you spend on ads.",
      path: "{s}/orders",
      steps: [
        "Open your store link and buy one cheap product.",
        "Check the order appears in Orders.",
        "Check you received the WhatsApp confirmation.",
      ],
    }),
  ];

  const pending = tasks.filter((t) => t.status === "pending");
  const done = tasks.filter((t) => t.status === "done").map((t) => t.title);
  const blockers = pending.filter((t) => t.blocker);

  // Blockers first, then catalogue/quality items in listed order.
  const next = [...blockers, ...pending.filter((t) => !t.blocker)].slice(0, 3);

  return {
    percent_complete: Math.round((done.length / tasks.length) * 100),
    can_accept_orders: blockers.length === 0,
    launch_blockers: blockers.map((t) => t.title),
    next_3: next,
    done,
    pending,
  };
}
