import { z } from "zod";

/**
 * Zod schemas for request bodies.
 *
 * Note the direction of truth: `openapi.yaml` describes *responses*, and
 * `openapi-typescript` generates read types from it. These Zod schemas
 * describe *requests*, and the API's OpenAPI document is generated back out
 * of them at build time by a small script, so the two cannot drift.
 *
 * Doing it the other way round — hand-writing request validators separately
 * from the spec — is how you end up with a documented field the server
 * rejects.
 *
 * Both clients use these for form validation (react-hook-form on web,
 * react-hook-form + the same resolver on mobile), so a field's max length is
 * defined once and enforced in three places.
 */

export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter a valid phone number with country code");

export const addressInputSchema = z.object({
  label: z.string().max(40).optional(),
  type: z.enum(["HOME", "WORK", "EVENT_VENUE", "OTHER"]).default("HOME"),
  recipientName: z.string().max(80).optional(),
  recipientPhone: phoneSchema.optional(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  unitNumber: z.string().max(20).optional(),
  buildingName: z.string().max(120).optional(),
  postalCode: z.string().min(4).max(12),
  city: z.string().max(80).default("Singapore"),
  country: z.string().length(2).default("SG"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  deliveryNotes: z.string().max(300).optional(),
  isDefault: z.boolean().default(false),
});

export const modifierSelectionSchema = z.object({
  modifierOptionId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20).default(1),
});

export const cartItemInputSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  modifiers: z.array(modifierSelectionSchema).max(30).default([]),
  specialInstructions: z.string().max(300).optional(),
});

export const checkoutInputSchema = z.object({
  paymentMethodType: z.enum([
    "CARD",
    "PAYNOW",
    "GRABPAY",
    "APPLE_PAY",
    "GOOGLE_PAY",
    "CASH_ON_DELIVERY",
  ]),
  savedPaymentMethodId: z.string().uuid().optional(),
  expectedTotalCents: z.number().int().min(0),
  guest: z
    .object({
      name: z.string().min(1).max(80),
      phone: phoneSchema,
      email: z.string().email().optional(),
    })
    .optional(),
  returnUrl: z.string().url().optional(),
});

// -- Catering ---------------------------------------------------------------

export const cateringSelectionSchema = z.object({
  courseId: z.string().uuid(),
  optionIds: z.array(z.string().uuid()).max(20),
});

export const cateringQuoteInputSchema = z.object({
  packageId: z.string().uuid(),
  pax: z.number().int().min(1).max(5000),
  serviceStyle: z
    .enum(["DROP_OFF", "BUFFET_SETUP", "LIVE_COUNTER", "FULL_SERVICE"])
    .optional(),
  eventDate: z.string().date().optional(),
  selections: z.array(cateringSelectionSchema).max(20),
  addOns: z
    .array(
      z.object({
        addOnId: z.string().uuid(),
        quantity: z.number().int().min(1).max(200),
      }),
    )
    .max(20)
    .default([]),
  staffCount: z.number().int().min(0).max(50).default(0),
  couponCode: z.string().max(40).optional(),
});

export const cateringBookingInputSchema = cateringQuoteInputSchema.extend({
  eventType: z.enum([
    "WEDDING",
    "BIRTHDAY",
    "CORPORATE",
    "HOUSE_WARMING",
    "RELIGIOUS_FUNCTION",
    "FUNERAL",
    "FESTIVAL",
    "OTHER",
  ]),
  eventDate: z.string().date(),
  // Minutes from local midnight at the outlet. Not an ISO instant: the guest
  // picked "7:30 PM", which is a fact about the venue's wall clock.
  serviceStartMinutes: z.number().int().min(0).max(1439),
  serviceEndMinutes: z.number().int().min(0).max(1620).optional(),
  setupByMinutes: z.number().int().min(0).max(1439).optional(),
  venueName: z.string().max(120).optional(),
  venueAddress: addressInputSchema,
  venueNotes: z.string().max(1000).optional(),
  hasLift: z.boolean().optional(),
  parkingNotes: z.string().max(300).optional(),
  contact: z.object({
    name: z.string().min(1).max(80),
    phone: phoneSchema,
    email: z.string().email().optional(),
  }),
  altContactPhone: phoneSchema.optional(),
  specialRequirements: z.string().max(2000).optional(),
  dietaryNotes: z.string().max(1000).optional(),
  expectedTotalCents: z.number().int().min(0),
});

// -- Reservations -----------------------------------------------------------

export const reservationHoldInputSchema = z.object({
  outletId: z.string().uuid(),
  slotId: z.string().uuid(),
  partySize: z.number().int().min(1).max(200),
  serviceAreaId: z.string().uuid().optional(),
});

export const reservationInputSchema = z.object({
  holdId: z.string().uuid(),
  guestName: z.string().min(1).max(80),
  guestPhone: phoneSchema,
  guestEmail: z.string().email().optional(),
  partySize: z.number().int().min(1).max(200),
  occasion: z.string().max(60).optional(),
  specialRequests: z.string().max(500).optional(),
  highChairCount: z.number().int().min(0).max(10).default(0),
  wheelchairAccess: z.boolean().default(false),
  marketingOptIn: z.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressInputSchema>;
export type CartItemInput = z.infer<typeof cartItemInputSchema>;
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type CateringQuoteInput = z.infer<typeof cateringQuoteInputSchema>;
export type CateringBookingInput = z.infer<typeof cateringBookingInputSchema>;
export type ReservationHoldInput = z.infer<typeof reservationHoldInputSchema>;
export type ReservationInput = z.infer<typeof reservationInputSchema>;
