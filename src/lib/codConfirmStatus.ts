/** WhatsApp COD confirmation progress shown on dashboard orders. */
export type CodStepTone = "success" | "warning" | "destructive" | "muted";
export interface CodStep { label: string; value: string; tone: CodStepTone }

/**
 * Map orders.cod_confirm_status to the two customer steps: order confirmation
 * and delivery-address confirmation. Returns [] when no COD confirmation was
 * ever sent for the order (status NULL), so non-COD orders show nothing.
 */
export function codConfirmSteps(status?: string | null): CodStep[] {
  const notYet = (label: string): CodStep => ({ label, value: "Not confirmed", tone: "warning" });
  const done = (label: string): CodStep => ({ label, value: "Confirmed", tone: "success" });
  switch (status) {
    case "awaiting":
      return [notYet("Order"), notYet("Address")];
    case "address_pending":
      return [done("Order"), notYet("Address")];
    case "edit_requested":
      return [done("Order"), { label: "Address", value: "Change requested", tone: "destructive" }];
    case "confirmed":
      return [done("Order"), done("Address")];
    case "cancelled":
      return [{ label: "Order", value: "Customer asked to cancel", tone: "destructive" }];
    default:
      return [];
  }
}
