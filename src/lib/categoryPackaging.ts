import { z } from "zod";
import { UTKAL_PACKAGING_OPTIONS, type PackagingOption } from "./packagingOptions";

export const categoryPackagingSchema = z.object({
  category_id: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  image_url: z.string().url().max(2048).refine(url => url.startsWith("https://cdn.shopbanao.in/"), "Upload a box photo first"),
  surcharge: z.number().finite().min(0).max(10000).refine(n => Math.round(n * 100) === n * 100, "Use at most two decimal places"),
  is_active: z.boolean(),
});

export interface CategoryPackaging {
  id: string;
  store_id: string;
  category_id: string;
  label: string;
  image_url: string;
  surcharge: number;
  is_active: boolean;
}

export function utkalPackagingOptions(setting?: CategoryPackaging | null): PackagingOption[] {
  return UTKAL_PACKAGING_OPTIONS.map(option => option.key === "brandkit" && setting?.is_active
    ? { key: "brandkit", label: setting.label, surcharge: Number(setting.surcharge) }
    : option);
}

export function selectedUtkalPackaging(key: string | null | undefined, setting?: CategoryPackaging | null) {
  const options = utkalPackagingOptions(setting);
  const option = options.find(o => o.key === key && !o.unavailable) ?? options[0];
  return { ...option, settingId: option.key === "brandkit" ? setting?.id : undefined };
}