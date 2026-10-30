import { toCanonicalIndianPhone } from "./phoneUtils";

export function needsCheckoutPhoneScreen(store: { id?: string; slug?: string }, phone: string): boolean {
  void store;
  return !toCanonicalIndianPhone(phone);
}
export function checkoutAddressReady(fields: { phone: string; fullName: string; pincode: string; streetAddress: string; city: string; state: string }): boolean {
  return !!toCanonicalIndianPhone(fields.phone) && !!fields.fullName.trim() && /^\d{6}$/.test(fields.pincode) && fields.streetAddress.trim().length > 0 && !!fields.city.trim() && !!fields.state.trim();
}