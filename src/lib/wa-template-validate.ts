// Shared validator for WhatsApp template builder. Mirrors Meta's most common rejection rules.

export type TplButton =
  | { type: "URL"; text: string; url: string }
  | { type: "QUICK_REPLY"; text: string }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string };

export type TplHeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

export type TplDraft = {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  header_type: TplHeaderType;
  header_text?: string | null;
  header_media_url?: string | null;
  body_text: string;
  footer_text?: string | null;
  buttons?: TplButton[];
};


export type ValidationIssue = { field: string; message: string; level: "error" | "warn" };

const URL_RE = /\bhttps?:\/\/\S+/i;
const PHONE_RE = /\b(?:\+?\d[\s\-]?){8,}\b/;
const NAME_RE = /^[a-z0-9_]+$/;

export function extractVars(text: string): number[] {
  const found = new Set<number>();
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) found.add(Number(m[1]));
  return Array.from(found).sort((a, b) => a - b);
}

export function validateDraft(d: TplDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!d.name) issues.push({ field: "name", message: "Name is required", level: "error" });
  else if (!NAME_RE.test(d.name)) issues.push({ field: "name", message: "Use lowercase letters, numbers, underscores only", level: "error" });
  else if (d.name.length > 512) issues.push({ field: "name", message: "Name too long", level: "error" });

  if (!d.language) issues.push({ field: "language", message: "Language is required", level: "error" });

  if (d.header_type === "TEXT") {
    if (!d.header_text?.trim()) issues.push({ field: "header_text", message: "Header text is required when header type is TEXT", level: "error" });
    else if (d.header_text.length > 60) issues.push({ field: "header_text", message: "Header must be ≤ 60 chars", level: "error" });
    else if (extractVars(d.header_text).length > 1) issues.push({ field: "header_text", message: "Header supports at most 1 variable", level: "error" });
  } else if (d.header_type === "IMAGE" || d.header_type === "VIDEO" || d.header_type === "DOCUMENT") {
    if (!d.header_media_url?.trim()) issues.push({ field: "header_media_url", message: `${d.header_type} header needs a sample media URL (used by Meta for review)`, level: "error" });
    else if (!/^https?:\/\//i.test(d.header_media_url)) issues.push({ field: "header_media_url", message: "Media URL must start with http(s)://", level: "error" });
  }


  if (!d.body_text?.trim()) issues.push({ field: "body_text", message: "Body is required", level: "error" });
  else {
    if (d.body_text.length > 1024) issues.push({ field: "body_text", message: "Body must be ≤ 1024 chars", level: "error" });
    const vars = extractVars(d.body_text);
    for (let i = 0; i < vars.length; i++) {
      if (vars[i] !== i + 1) {
        issues.push({ field: "body_text", message: `Variables must be sequential starting at {{1}} — found gap at {{${vars[i]}}}`, level: "error" });
        break;
      }
    }
    const withoutVars = d.body_text.replace(/\{\{\s*\d+\s*\}\}/g, "");
    if (URL_RE.test(withoutVars)) issues.push({ field: "body_text", message: "Don't put raw URLs in the body — use a URL button instead", level: "warn" });
    if (PHONE_RE.test(withoutVars)) issues.push({ field: "body_text", message: "Don't put raw phone numbers in the body", level: "warn" });
  }

  if (d.footer_text && d.footer_text.length > 60) issues.push({ field: "footer_text", message: "Footer must be ≤ 60 chars", level: "error" });

  if (d.category === "MARKETING") {
    const footerLc = (d.footer_text || "").toLowerCase();
    if (!footerLc.includes("stop") && !footerLc.includes("unsubscribe")) {
      issues.push({ field: "footer_text", message: "Marketing templates should include opt-out language (e.g. 'Reply STOP to unsubscribe')", level: "warn" });
    }
  }

  const btns = d.buttons || [];
  if (btns.length > 2) issues.push({ field: "buttons", message: "Maximum 2 buttons supported in this builder", level: "error" });
  for (const [i, b] of btns.entries()) {
    if (!b.text?.trim()) issues.push({ field: `buttons.${i}.text`, message: "Button text required", level: "error" });
    else if (b.text.length > 25) issues.push({ field: `buttons.${i}.text`, message: "Button text ≤ 25 chars", level: "error" });
    if (b.type === "URL") {
      if (!b.url?.trim()) issues.push({ field: `buttons.${i}.url`, message: "URL required", level: "error" });
      else if (!/^https?:\/\//i.test(b.url)) issues.push({ field: `buttons.${i}.url`, message: "URL must start with http:// or https://", level: "error" });
      else {
        const urlVars = extractVars(b.url);
        if (urlVars.length > 1) issues.push({ field: `buttons.${i}.url`, message: "URL supports at most 1 variable at the end", level: "error" });
        else if (urlVars.length === 1 && urlVars[0] !== 1) issues.push({ field: `buttons.${i}.url`, message: "URL button variable must be {{1}}", level: "error" });
      }
    }
    if (b.type === "PHONE_NUMBER" && !b.phone_number) issues.push({ field: `buttons.${i}.phone_number`, message: "Phone number required", level: "error" });
  }

  return issues;
}

/** Build the Meta Graph API `components` array from a draft. Used by the edge function. */
export function draftToMetaComponents(d: TplDraft): any[] {
  const components: any[] = [];

  if (d.header_type === "TEXT" && d.header_text) {
    const headerVars = extractVars(d.header_text);
    const comp: any = { type: "HEADER", format: "TEXT", text: d.header_text };
    if (headerVars.length === 1) {
      comp.example = { header_text: ["Sample"] };
    }
    components.push(comp);
  } else if ((d.header_type === "IMAGE" || d.header_type === "VIDEO" || d.header_type === "DOCUMENT") && d.header_media_url) {
    components.push({
      type: "HEADER",
      format: d.header_type,
      example: { header_handle: [d.header_media_url] },
    });
  }


  const bodyVars = extractVars(d.body_text);
  const body: any = { type: "BODY", text: d.body_text };
  if (bodyVars.length) {
    body.example = { body_text: [bodyVars.map((_, i) => `Sample${i + 1}`)] };
  }
  components.push(body);

  if (d.footer_text) components.push({ type: "FOOTER", text: d.footer_text });

  const btns = (d.buttons || []).map((b) => {
    if (b.type === "URL") {
      const out: any = { type: "URL", text: b.text, url: b.url };
      if (extractVars(b.url).length === 1) out.example = ["sample-id"];
      return out;
    }
    if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone_number };
    return { type: "QUICK_REPLY", text: b.text };
  });
  if (btns.length) components.push({ type: "BUTTONS", buttons: btns });

  return components;
}

/** Resolve {{1}} {{2}} … with sample values for the live preview. */
export function renderPreview(text: string, samples: string[]): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => samples[Number(n) - 1] ?? `{{${n}}}`);
}
