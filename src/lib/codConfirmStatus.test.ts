import { describe, expect, it } from "vitest";
import { codConfirmSteps } from "./codConfirmStatus";

const summary = (s: string | null) => codConfirmSteps(s).map((x) => `${x.label}:${x.value}`);

describe("COD confirmation status on dashboard orders", () => {
  it("shows both steps not confirmed while the customer has not replied", () => {
    expect(summary("awaiting")).toEqual(["Order:Not confirmed", "Address:Not confirmed"]);
  });
  it("shows order confirmed but address not confirmed after Confirm My Order", () => {
    expect(summary("address_pending")).toEqual(["Order:Confirmed", "Address:Not confirmed"]);
  });
  it("shows both confirmed after Confirm Address", () => {
    expect(summary("confirmed")).toEqual(["Order:Confirmed", "Address:Confirmed"]);
  });
  it("flags an address change request", () => {
    expect(summary("edit_requested")).toEqual(["Order:Confirmed", "Address:Change requested"]);
  });
  it("flags a cancellation request", () => {
    expect(summary("cancelled")).toEqual(["Order:Customer asked to cancel"]);
  });
  it("shows nothing for orders that never got a COD confirmation", () => {
    expect(summary(null)).toEqual([]);
  });
});
