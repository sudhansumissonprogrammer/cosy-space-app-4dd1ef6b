// Resolves merchant branding variables for a template, in the order declared
// by platform_wa_templates.variables[]. Producers should supply a `vars`
// object; we fill anything they didn't with values pulled from `stores`.

export type BrandingExtras = Record<string, string | number | null | undefined>;

const VAR_DEFAULTS: Record<string, (s: any) => string> = {
  store_name: (s) => s?.name || "Our store",
  store_phone: (s) => s?.business_phone || s?.phone || "",
  store_website: (s) => storeUrl(s),
  shop_url: (s) => storeUrl(s),
  customer_name: () => "there",
  tracking_number: () => "",
  courier_name: () => "",
  tracking_url: (s) => storeUrl(s),
};

function storeUrl(s: any): string {
  if (!s) return "https://shopbanao.in";
  if (s.custom_domain) return `https://${s.custom_domain}`;
  if (s.slug) return `https://${s.slug}.shopbanao.in`;
  return "https://shopbanao.in";
}

export async function loadStore(admin: any, storeId: string | null | undefined) {
  if (!storeId) return null;
  const { data } = await admin
    .from("stores")
    .select("id, name, slug, custom_domain, business_phone, phone")
    .eq("id", storeId)
    .maybeSingle();
  return data;
}

export async function loadTemplate(admin: any, name: string) {
  const { data } = await admin
    .from("platform_wa_templates")
    .select("name, language, variables, buttons, is_active, meta_status, paused, pause_reason, header_type, header_media_url")
    .eq("name", name)
    .maybeSingle();

  return data;
}


export function resolveTemplateParams(
  template: { variables: string[] | null } | null,
  store: any,
  extras: BrandingExtras,
): string[] {
  const vars = template?.variables ?? [];
  return vars.map((key) => {
    const k = (key || "").replace(/^\{\{|\}\}$/g, "").trim();
    if (k in extras && extras[k] != null) return String(extras[k]);
    const def = VAR_DEFAULTS[k];
    if (def) return def(store);
    return "";
  });
}
