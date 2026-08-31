import "server-only";

import type { PaymentProvider } from "./provider";
import { StripePaymentProvider } from "./stripe-provider";
import { RazorpayPaymentProvider } from "./razorpay-provider";

export * from "./provider";

let instance: PaymentProvider | null = null;

/**
 * One gateway is active at a time, chosen by environment. Both adapters are in
 * the tree so the interface is compile-checked against two real
 * implementations rather than one plus a promise that a second would fit.
 */
export const getPaymentProvider = (): PaymentProvider => {
  if (instance) return instance;

  instance =
    process.env.PAYMENT_PROVIDER === "razorpay"
      ? new RazorpayPaymentProvider()
      : new StripePaymentProvider();

  return instance;
};
