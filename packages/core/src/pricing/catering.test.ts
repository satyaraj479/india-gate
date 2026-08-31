import { describe, expect, it } from "vitest";
import { cents } from "../money";
import {
  quoteCatering,
  resolveTier,
  type CateringPackageDefinition,
} from "./catering";

const pkg: CateringPackageDefinition = {
  id: "pkg-1",
  name: "Wedding Deluxe",
  currency: "SGD",
  minimumPax: 30,
  maximumPax: 300,
  paxStep: 10,
  basePricePerPaxCents: cents(3200),
  tiers: [
    { minPax: 30, maxPax: 59, pricePerPaxCents: cents(2800), label: "30–59" },
    { minPax: 60, maxPax: 119, pricePerPaxCents: cents(2400), label: "60–119" },
    { minPax: 120, maxPax: null, pricePerPaxCents: cents(2100), label: "120+" },
  ],
  courses: [
    {
      id: "c-starters",
      stepIndex: 0,
      name: "Starters",
      isRequired: true,
      minSelections: 2,
      maxSelections: 4,
      includedSelections: 2,
      allowDuplicates: false,
      options: [
        { id: "o-medu", productName: "Medu Vada", surchargePerPaxCents: cents(0), isActive: true },
        { id: "o-gobi", productName: "Gobi 65", surchargePerPaxCents: cents(0), isActive: true },
        { id: "o-prawn", productName: "Prawn Varuval", surchargePerPaxCents: cents(400), isActive: true },
        { id: "o-old", productName: "Discontinued Bonda", surchargePerPaxCents: cents(0), isActive: false },
      ],
    },
    {
      id: "c-biryani",
      stepIndex: 1,
      name: "Biryani",
      isRequired: true,
      minSelections: 1,
      maxSelections: 2,
      includedSelections: 1,
      allowDuplicates: false,
      options: [
        { id: "o-veg-b", productName: "Veg Biryani", surchargePerPaxCents: cents(0), isActive: true },
        { id: "o-mutton-b", productName: "Mutton Biryani", surchargePerPaxCents: cents(600), isActive: true },
      ],
    },
  ],
  addOns: [
    { id: "a-chafing", name: "Chafing dishes", pricingModel: "PER_UNIT", priceCents: cents(1500) },
    { id: "a-cutlery", name: "Cutlery set", pricingModel: "PER_PAX", priceCents: cents(120) },
  ],
  setupFeeCents: cents(15000),
  perStaffFeeCents: cents(9000),
  depositPercentBps: 3000,
  taxRateBps: 900,
  taxInclusive: true,
};

const baseSelections = [
  { courseId: "c-starters", optionIds: ["o-medu", "o-gobi"] },
  { courseId: "c-biryani", optionIds: ["o-veg-b"] },
];

describe("resolveTier", () => {
  it("picks the band containing the headcount", () => {
    expect(resolveTier(pkg, 45).pricePerPaxCents).toBe(2800);
    expect(resolveTier(pkg, 60).pricePerPaxCents).toBe(2400);
    expect(resolveTier(pkg, 500).pricePerPaxCents).toBe(2100);
  });

  it("falls back to the package base price when no band matches", () => {
    expect(resolveTier(pkg, 10).pricePerPaxCents).toBe(3200);
  });
});

describe("quoteCatering", () => {
  it("prices a valid minimum booking", () => {
    const q = quoteCatering(pkg, { pax: 60, selections: baseSelections });

    expect(q.validation.isComplete).toBe(true);
    expect(q.pricePerPaxCents).toBe(2400);
    // 60 × 2400 = 144_000, plus the 15_000 setup fee.
    expect(q.subtotalCents).toBe(60 * 2400 + 15000);
    expect(q.totalCents).toBe(159000);
    expect(q.depositDueCents).toBe(47700); // 30%
    expect(q.balanceDueCents).toBe(159000 - 47700);
  });

  it("keeps GST inside the total when the menu is tax-inclusive", () => {
    const q = quoteCatering(pkg, { pax: 60, selections: baseSelections });
    // 159_000 × 9 / 109 = 13_128.4 → 13_128, and the total is unchanged.
    expect(q.taxCents).toBe(13128);
    expect(q.totalCents).toBe(159000);
  });

  it("charges a per-pax surcharge for a premium dish", () => {
    const q = quoteCatering(pkg, {
      pax: 60,
      selections: [
        { courseId: "c-starters", optionIds: ["o-medu", "o-gobi"] },
        { courseId: "c-biryani", optionIds: ["o-mutton-b"] },
      ],
    });
    expect(q.validation.isComplete).toBe(true);
    // 60 guests × 600 surcharge on the mutton biryani.
    expect(q.subtotalCents).toBe(60 * 2400 + 15000 + 60 * 600);
  });

  it("bills extra dishes beyond includedSelections at the per-pax rate", () => {
    const q = quoteCatering(pkg, {
      pax: 60,
      selections: [
        // Three starters when two are included.
        { courseId: "c-starters", optionIds: ["o-medu", "o-gobi", "o-prawn"] },
        { courseId: "c-biryani", optionIds: ["o-veg-b"] },
      ],
    });
    const expected =
      60 * 2400 + // base
      15000 + // setup
      60 * 400 + // prawn's own premium surcharge
      60 * 1 * 2400; // one extra starter slot
    expect(q.subtotalCents).toBe(expected);
  });

  it("rejects a headcount below the package minimum", () => {
    const q = quoteCatering(pkg, { pax: 20, selections: baseSelections });
    expect(q.validation.isComplete).toBe(false);
    expect(q.validation.errors.map((e) => e.code)).toContain("BELOW_MINIMUM_PAX");
  });

  it("rejects a headcount off the pax step", () => {
    const q = quoteCatering(pkg, { pax: 65, selections: baseSelections });
    expect(q.validation.errors.map((e) => e.code)).toContain("PAX_NOT_ON_STEP");
  });

  it("reports the course that has too few selections", () => {
    const q = quoteCatering(pkg, {
      pax: 60,
      selections: [
        { courseId: "c-starters", optionIds: ["o-medu"] },
        { courseId: "c-biryani", optionIds: ["o-veg-b"] },
      ],
    });
    expect(q.validation.isComplete).toBe(false);
    const starters = q.validation.courses.find((c) => c.courseId === "c-starters");
    expect(starters?.isSatisfied).toBe(false);
    expect(starters?.selectedCount).toBe(1);
  });

  it("rejects more selections than the course allows", () => {
    const q = quoteCatering(pkg, {
      pax: 60,
      selections: [
        {
          courseId: "c-starters",
          optionIds: ["o-medu", "o-gobi", "o-prawn", "o-medu", "o-gobi"],
        },
        { courseId: "c-biryani", optionIds: ["o-veg-b"] },
      ],
    });
    const codes = q.validation.errors.map((e) => e.code);
    expect(codes).toContain("COURSE_MAX_EXCEEDED");
    expect(codes).toContain("DUPLICATE_NOT_ALLOWED");
  });

  it("flags a dish that has been taken off the menu", () => {
    const q = quoteCatering(pkg, {
      pax: 60,
      selections: [
        { courseId: "c-starters", optionIds: ["o-medu", "o-old"] },
        { courseId: "c-biryani", optionIds: ["o-veg-b"] },
      ],
    });
    expect(q.validation.errors.map((e) => e.code)).toContain("OPTION_UNAVAILABLE");
  });

  it("adds per-pax and per-unit add-ons on the right multiplier", () => {
    const q = quoteCatering(pkg, {
      pax: 60,
      selections: baseSelections,
      addOns: [
        { addOnId: "a-cutlery", quantity: 1 }, // PER_PAX → ×60
        { addOnId: "a-chafing", quantity: 4 }, // PER_UNIT → ×4
      ],
      staffCount: 2,
    });
    const expected =
      60 * 2400 + 15000 + 60 * 120 + 4 * 1500 + 2 * 9000;
    expect(q.subtotalCents).toBe(expected);
  });

  it("never returns a negative total when a discount exceeds the subtotal", () => {
    const q = quoteCatering(pkg, {
      pax: 60,
      selections: baseSelections,
      discountCents: cents(10_000_000),
    });
    expect(q.totalCents).toBe(0);
    expect(q.depositDueCents).toBe(0);
  });
});
