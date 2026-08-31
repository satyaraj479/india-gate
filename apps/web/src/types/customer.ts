import { z } from "zod";

/**
 * Customer types plus the Zod schemas that validate them.
 *
 * The schema is the source of truth and the TypeScript type is inferred from
 * it, never the other way round. A hand-written interface beside a hand-written
 * validator drifts the first time someone adds a field to one of them.
 */

export const singaporePostalCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Singapore postcodes are 6 digits");

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^(\+65)?[689]\d{7}$/,
        "Enter a valid Singapore mobile number",
      ),
  );

export const customerContactSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().max(60).optional().default(""),
  phone: phoneSchema,
  email: z.string().trim().email("Enter a valid email"),
});

export const deliveryAddressSchema = z.object({
  addressLine1: z.string().trim().min(3, "Required").max(200),
  unitNumber: z.string().trim().max(20).optional().default(""),
  buildingName: z.string().trim().max(120).optional().default(""),
  postalCode: singaporePostalCodeSchema,
  deliveryNotes: z.string().trim().max(300).optional().default(""),
  /** Contactless drop-off; surfaced to the driver app. */
  leaveAtDoor: z.boolean().default(false),
});

export const checkoutFormSchema = z.object({
  contact: customerContactSchema,
  address: deliveryAddressSchema.optional(),
  /** ISO instant, or null for "as soon as possible". */
  scheduledFor: z.string().datetime().nullable().default(null),
  orderNotes: z.string().trim().max(500).optional().default(""),
  marketingOptIn: z.boolean().default(false),
});

export type CustomerContact = z.infer<typeof customerContactSchema>;
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;
export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

export type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  savedAddresses: Array<DeliveryAddress & { id: string; label: string; isDefault: boolean }>;
  gatePoints: number;
  tier: LoyaltyTier;
  createdAt: string;
}
