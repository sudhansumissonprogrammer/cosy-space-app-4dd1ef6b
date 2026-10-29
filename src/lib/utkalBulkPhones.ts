// Extracts unique Indian mobile numbers from an uploaded CSV/TXT list.
// Server re-validates and removes fake/opted-out numbers.
export function parsePhoneList(text: string): { phones: string[]; raw: number } {
  const tokens = text.split(/[\n,;\t\r]+/).map((t) => t.trim()).filter(Boolean);
  const seen = new Set<string>();
  for (const t of tokens) {
    let d = t.replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
    if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
    if (d.length === 10 && /^[6-9]/.test(d)) seen.add("91" + d);
  }
  return { phones: [...seen], raw: tokens.length };
}
