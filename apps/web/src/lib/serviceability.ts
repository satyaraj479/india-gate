import {
  DEFAULT_DELIVERY_FEE_CENTS,
  FREE_DELIVERY_ABOVE_CENTS,
  MIN_DELIVERY_ORDER_CENTS,
} from "./config";

/**
 * Delivery serviceability by Singapore postcode.
 *
 * Singapore postcodes are six digits whose first two identify the postal
 * district, which is a good enough proxy for a delivery zone at this scale and
 * needs no geocoding call. Zones are data, not code, because operations
 * changes them far more often than engineers deploy.
 *
 * When this app runs against the platform API, `checkServiceability` becomes a
 * call to `POST /outlets/{id}/serviceability` and the zone table moves to the
 * database. The return type is identical, so nothing upstream changes.
 */

export interface DeliveryZone {
  id: string;
  name: string;
  /** Leading two digits of the six-digit postcode. */
  sectors: string[];
  feeCents: number;
  etaMinutes: number;
  minOrderCents: number;
  freeDeliveryAboveCents: number | null;
}

export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: "zone-core",
    name: "Little India, Rochor & Bugis",
    sectors: ["20", "21", "22", "18", "19"],
    feeCents: 299,
    etaMinutes: 30,
    minOrderCents: MIN_DELIVERY_ORDER_CENTS,
    freeDeliveryAboveCents: 4500,
  },
  {
    id: "zone-central",
    name: "Central & Orchard",
    sectors: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "23", "24"],
    feeCents: DEFAULT_DELIVERY_FEE_CENTS,
    etaMinutes: 45,
    minOrderCents: MIN_DELIVERY_ORDER_CENTS,
    freeDeliveryAboveCents: FREE_DELIVERY_ABOVE_CENTS,
  },
  {
    id: "zone-east",
    name: "Geylang, Katong & the East Coast",
    sectors: ["38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51", "52"],
    feeCents: 699,
    etaMinutes: 55,
    minOrderCents: 3500,
    freeDeliveryAboveCents: 8000,
  },
  {
    id: "zone-west",
    name: "Queenstown, Clementi & Jurong East",
    sectors: ["12", "13", "14", "15", "16", "58", "59", "60", "61", "62", "63", "64"],
    feeCents: 799,
    etaMinutes: 60,
    minOrderCents: 3500,
    freeDeliveryAboveCents: 8000,
  },
  {
    id: "zone-north",
    name: "Toa Payoh, Bishan & Ang Mo Kio",
    sectors: ["31", "32", "33", "53", "54", "55", "56", "57"],
    feeCents: 599,
    etaMinutes: 50,
    minOrderCents: 3000,
    freeDeliveryAboveCents: 7000,
  },
];

export type ServiceabilityResult =
  | {
      deliverable: true;
      zone: DeliveryZone;
      postalCode: string;
    }
  | {
      deliverable: false;
      reason: "INVALID_FORMAT" | "OUT_OF_RANGE";
      message: string;
      postalCode: string;
    };

const POSTCODE_PATTERN = /^\d{6}$/;

export const normalisePostalCode = (raw: string): string =>
  raw.replace(/\D/g, "").slice(0, 6);

export const checkServiceability = (raw: string): ServiceabilityResult => {
  const postalCode = normalisePostalCode(raw);

  if (!POSTCODE_PATTERN.test(postalCode)) {
    return {
      deliverable: false,
      reason: "INVALID_FORMAT",
      message: "Singapore postcodes are six digits — for example 218123.",
      postalCode,
    };
  }

  const sector = postalCode.slice(0, 2);
  const zone = DELIVERY_ZONES.find((z) => z.sectors.includes(sector));

  if (!zone) {
    return {
      deliverable: false,
      reason: "OUT_OF_RANGE",
      message:
        "We do not deliver to this postcode yet. Self-pickup from Little India is available on every order.",
      postalCode,
    };
  }

  return { deliverable: true, zone, postalCode };
};
