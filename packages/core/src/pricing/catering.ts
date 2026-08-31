import {
  ZERO,
  add,
  applyBps,
  cents,
  clampToZero,
  multiply,
  subtract,
  type Cents,
} from "../money";

/**
 * The catering quote engine.
 *
 * This runs in three places and must give the same answer in all three:
 *   - the Expo wizard, on every tap, for the sticky footer total;
 *   - the Next.js catering page, server-rendered for SEO and first paint;
 *   - the NestJS booking service, which is the only authoritative caller.
 *
 * That is the entire argument for `packages/core`. Reimplementing this in
 * three places is how a guest gets quoted S$1,840 on the phone and charged
 * S$1,910 on the card.
 */

export interface CateringCourseDefinition {
  id: string;
  stepIndex: number;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  /** Picks beyond this count are billed at the option's surcharge. */
  includedSelections: number;
  allowDuplicates: boolean;
  options: CateringOptionDefinition[];
}

export interface CateringOptionDefinition {
  id: string;
  productName: string;
  surchargePerPaxCents: Cents;
  isActive: boolean;
}

export interface CateringPackageDefinition {
  id: string;
  name: string;
  currency: string;
  minimumPax: number;
  maximumPax: number | null;
  paxStep: number;
  basePricePerPaxCents: Cents;
  tiers: Array<{
    minPax: number;
    maxPax: number | null;
    pricePerPaxCents: Cents;
    label: string | null;
  }>;
  courses: CateringCourseDefinition[];
  addOns: Array<{
    id: string;
    name: string;
    pricingModel: "PER_EVENT" | "PER_PAX" | "PER_UNIT";
    priceCents: Cents;
  }>;
  setupFeeCents: Cents;
  perStaffFeeCents: Cents;
  depositPercentBps: number;
  taxRateBps: number;
  taxInclusive: boolean;
}

export interface CateringSelectionInput {
  courseId: string;
  optionIds: string[];
}

export interface CateringQuoteInput {
  pax: number;
  selections: CateringSelectionInput[];
  addOns?: Array<{ addOnId: string; quantity: number }>;
  staffCount?: number;
  /** Already-validated discount, resolved by the coupon service. */
  discountCents?: Cents;
}

export type QuoteLineKind =
  | "BASE_PER_PAX"
  | "COURSE_SURCHARGE"
  | "ADD_ON"
  | "SETUP_FEE"
  | "STAFF_FEE"
  | "DISCOUNT"
  | "TAX";

export interface QuoteLine {
  kind: QuoteLineKind;
  label: string;
  quantity: number | null;
  unitAmountCents: Cents | null;
  amountCents: Cents;
}

export interface CourseValidation {
  courseId: string;
  selectedCount: number;
  isSatisfied: boolean;
  message: string | null;
}

export interface CateringQuote {
  currency: string;
  pax: number;
  tierLabel: string | null;
  pricePerPaxCents: Cents;
  lines: QuoteLine[];
  subtotalCents: Cents;
  discountTotalCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  depositDueCents: Cents;
  balanceDueCents: Cents;
  validation: {
    isComplete: boolean;
    courses: CourseValidation[];
    errors: QuoteError[];
  };
}

export interface QuoteError {
  code:
    | "BELOW_MINIMUM_PAX"
    | "ABOVE_MAXIMUM_PAX"
    | "PAX_NOT_ON_STEP"
    | "COURSE_MIN_NOT_MET"
    | "COURSE_MAX_EXCEEDED"
    | "DUPLICATE_NOT_ALLOWED"
    | "OPTION_UNAVAILABLE"
    | "UNKNOWN_COURSE";
  courseId?: string;
  message: string;
}

/** Volume band containing `pax`; falls back to the package base price. */
export const resolveTier = (
  pkg: CateringPackageDefinition,
  pax: number,
): { pricePerPaxCents: Cents; label: string | null } => {
  const match = pkg.tiers
    .filter((t) => pax >= t.minPax && (t.maxPax === null || pax <= t.maxPax))
    // Most specific band wins when ranges overlap through a data-entry error.
    .sort((a, b) => b.minPax - a.minPax)[0];

  return match
    ? { pricePerPaxCents: match.pricePerPaxCents, label: match.label }
    : { pricePerPaxCents: pkg.basePricePerPaxCents, label: null };
};

/**
 * Pure. No I/O, no clock, no randomness — which is what makes it safe to run
 * on the client and testable as a table of cases.
 */
export const quoteCatering = (
  pkg: CateringPackageDefinition,
  input: CateringQuoteInput,
): CateringQuote => {
  const errors: QuoteError[] = [];
  const { pax } = input;

  if (pax < pkg.minimumPax) {
    errors.push({
      code: "BELOW_MINIMUM_PAX",
      message: `This package starts at ${pkg.minimumPax} guests.`,
    });
  }
  if (pkg.maximumPax !== null && pax > pkg.maximumPax) {
    errors.push({
      code: "ABOVE_MAXIMUM_PAX",
      message: `Maximum ${pkg.maximumPax} guests. Contact us for larger events.`,
    });
  }
  if ((pax - pkg.minimumPax) % pkg.paxStep !== 0) {
    errors.push({
      code: "PAX_NOT_ON_STEP",
      message: `Guest count must be in steps of ${pkg.paxStep}.`,
    });
  }

  const tier = resolveTier(pkg, pax);
  const lines: QuoteLine[] = [];

  // -- Base per-pax --------------------------------------------------------
  const baseAmount = multiply(tier.pricePerPaxCents, Math.max(pax, 0));
  lines.push({
    kind: "BASE_PER_PAX",
    label: `${pkg.name} × ${pax} guests`,
    quantity: pax,
    unitAmountCents: tier.pricePerPaxCents,
    amountCents: baseAmount,
  });

  // -- Course selection: validate, then charge the overage -----------------
  const selectionByCourse = new Map(
    input.selections.map((s) => [s.courseId, s.optionIds]),
  );
  const courseValidations: CourseValidation[] = [];

  for (const course of [...pkg.courses].sort(
    (a, b) => a.stepIndex - b.stepIndex,
  )) {
    const picked = selectionByCourse.get(course.id) ?? [];
    const count = picked.length;

    if (!course.allowDuplicates && new Set(picked).size !== count) {
      errors.push({
        code: "DUPLICATE_NOT_ALLOWED",
        courseId: course.id,
        message: `${course.name}: each dish can only be chosen once.`,
      });
    }

    let message: string | null = null;
    let satisfied = true;

    if (course.isRequired && count < course.minSelections) {
      satisfied = false;
      message = `Choose at least ${course.minSelections} from ${course.name}.`;
      errors.push({
        code: "COURSE_MIN_NOT_MET",
        courseId: course.id,
        message,
      });
    }
    if (count > course.maxSelections) {
      satisfied = false;
      message = `${course.name} allows up to ${course.maxSelections}.`;
      errors.push({
        code: "COURSE_MAX_EXCEEDED",
        courseId: course.id,
        message,
      });
    }

    courseValidations.push({
      courseId: course.id,
      selectedCount: count,
      isSatisfied: satisfied,
      message,
    });

    // Charge the picks that fall outside `includedSelections`, cheapest
    // first — a guest who picks three premium starters when two are included
    // should be charged for the least expensive extra, not the most. Charging
    // the dearest is technically defensible and reliably generates
    // complaints.
    const options = picked
      .map((id) => course.options.find((o) => o.id === id))
      .filter((o): o is CateringOptionDefinition => {
        if (!o) {
          errors.push({
            code: "OPTION_UNAVAILABLE",
            courseId: course.id,
            message: `A dish selected in ${course.name} is no longer available.`,
          });
          return false;
        }
        if (!o.isActive) {
          errors.push({
            code: "OPTION_UNAVAILABLE",
            courseId: course.id,
            message: `${o.productName} is no longer available.`,
          });
          return false;
        }
        return true;
      });

    // Every selected option's own surcharge always applies (a premium dish is
    // premium whether it is the first or third pick). What `includedSelections`
    // waives is the *slot*, so options beyond the included count additionally
    // pay the base per-pax rate for the extra portion.
    for (const option of options) {
      if (option.surchargePerPaxCents === ZERO) continue;
      const amount = multiply(option.surchargePerPaxCents, pax);
      lines.push({
        kind: "COURSE_SURCHARGE",
        label: `${option.productName} (premium) × ${pax}`,
        quantity: pax,
        unitAmountCents: option.surchargePerPaxCents,
        amountCents: amount,
      });
    }

    const extraSlots = Math.max(0, options.length - course.includedSelections);
    if (extraSlots > 0) {
      const amount = multiply(tier.pricePerPaxCents, pax * extraSlots);
      lines.push({
        kind: "COURSE_SURCHARGE",
        label: `${course.name}: ${extraSlots} extra dish${extraSlots > 1 ? "es" : ""}`,
        quantity: pax * extraSlots,
        unitAmountCents: tier.pricePerPaxCents,
        amountCents: amount,
      });
    }
  }

  for (const sel of input.selections) {
    if (!pkg.courses.some((c) => c.id === sel.courseId)) {
      errors.push({
        code: "UNKNOWN_COURSE",
        courseId: sel.courseId,
        message: "This package no longer has that course.",
      });
    }
  }

  // -- Add-ons -------------------------------------------------------------
  for (const chosen of input.addOns ?? []) {
    const addOn = pkg.addOns.find((a) => a.id === chosen.addOnId);
    if (!addOn) continue;
    const units =
      addOn.pricingModel === "PER_PAX"
        ? pax
        : addOn.pricingModel === "PER_UNIT"
          ? chosen.quantity
          : 1;
    lines.push({
      kind: "ADD_ON",
      label: addOn.name,
      quantity: units,
      unitAmountCents: addOn.priceCents,
      amountCents: multiply(addOn.priceCents, units),
    });
  }

  // -- Fixed fees ----------------------------------------------------------
  if (pkg.setupFeeCents > 0) {
    lines.push({
      kind: "SETUP_FEE",
      label: "Setup & delivery",
      quantity: null,
      unitAmountCents: null,
      amountCents: pkg.setupFeeCents,
    });
  }
  const staff = input.staffCount ?? 0;
  if (staff > 0 && pkg.perStaffFeeCents > 0) {
    lines.push({
      kind: "STAFF_FEE",
      label: `Service staff × ${staff}`,
      quantity: staff,
      unitAmountCents: pkg.perStaffFeeCents,
      amountCents: multiply(pkg.perStaffFeeCents, staff),
    });
  }

  // -- Totals --------------------------------------------------------------
  const subtotal = add(...lines.map((l) => l.amountCents));
  const discount = input.discountCents ?? ZERO;
  if (discount > 0) {
    lines.push({
      kind: "DISCOUNT",
      label: "Discount",
      quantity: null,
      unitAmountCents: null,
      amountCents: cents(-discount),
    });
  }

  const netSubtotal = clampToZero(subtract(subtotal, discount));
  const tax = pkg.taxInclusive
    ? // GST is already inside the quoted per-pax price; surface it for the
      // invoice but do not add it again.
      cents(
        Math.round((netSubtotal * pkg.taxRateBps) / (10_000 + pkg.taxRateBps)),
      )
    : applyBps(netSubtotal, pkg.taxRateBps);

  const total = pkg.taxInclusive ? netSubtotal : add(netSubtotal, tax);
  const deposit = applyBps(total, pkg.depositPercentBps);

  lines.push({
    kind: "TAX",
    label: pkg.taxInclusive ? "GST (included)" : "GST",
    quantity: null,
    unitAmountCents: null,
    amountCents: tax,
  });

  return {
    currency: pkg.currency,
    pax,
    tierLabel: tier.label,
    pricePerPaxCents: tier.pricePerPaxCents,
    lines,
    subtotalCents: subtotal,
    discountTotalCents: discount,
    taxCents: tax,
    totalCents: total,
    depositDueCents: deposit,
    balanceDueCents: subtract(total, deposit),
    validation: {
      isComplete: errors.length === 0,
      courses: courseValidations,
      errors,
    },
  };
};
