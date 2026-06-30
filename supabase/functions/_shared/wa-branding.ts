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
    .select("name, language, variables, buttons, is_active, meta_status, paused, pause_reason, header_type, header_media_url, template_group")
    .eq("name", name)
    .maybeSingle();

  return data;
}

// Within a template_group, swap to the sibling matching the requested locale.
// Falls back to the original template when no approved sibling exists.
export async function pickLocaleVariant(admin: any, tpl: any, locale: string | null | undefined) {
  if (!tpl || !locale) return tpl;
  const group = tpl.template_group || tpl.name;
  const lang = String(locale).toLowerCase().split(/[-_]/)[0];
  if (tpl.language && tpl.language.toLowerCase().startsWith(lang)) return tpl;
  const { data: sibs } = await admin
    .from("platform_wa_templates")
    .select("name, language, variables, buttons, is_active, meta_status, paused, pause_reason, header_type, header_media_url, template_group")
    .eq("template_group", group)
    .eq("is_active", true);
  const match = (sibs || []).find((s: any) =>
    s.language && s.language.toLowerCase().startsWith(lang) &&
    (s.meta_status || "").toLowerCase() === "approved" && !s.paused
  );
  return match || tpl;
}



// Meta rejects template body parameters that contain newlines, tabs, or more
// than 4 consecutive spaces (errors #132000 / #132012). Empty strings also
// fail validation. We normalize all params here so a merchant store name like
// "Hridaya\nJewellers" or a pasted customer name doesn't burn our quality
// rating with hard rejects.
export function sanitizeWaParam(v: unknown, maxLen = 200): string {
  let s = v == null ? "" : String(v);
  // Strip ALL control chars (incl. \n \r \t \v \f and U+0000–U+001F / U+007F).
  s = s.replace(/[\u0000-\u001F\u007F]+/g, " ");
  // Collapse 5+ spaces (Meta cap is 4 consecutive).
  s = s.replace(/ {5,}/g, "    ");
  s = s.trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trim();
  // Meta forbids empty body params. Fall back to a single space (rendered invisibly).
  if (!s) s = " ";
  return s;
}

export function resolveTemplateParams(
  template: { variables: string[] | null } | null,
  store: any,
  extras: BrandingExtras,
): string[] {
  const vars = template?.variables ?? [];
  return vars.map((key) => {
    const k = (key || "").replace(/^\{\{|\}\}$/g, "").trim();
    let raw: unknown = "";
    if (k in extras && extras[k] != null) raw = extras[k];
    else {
      const def = VAR_DEFAULTS[k];
      if (def) raw = def(store);
    }
    return sanitizeWaParam(raw);
  });
}
