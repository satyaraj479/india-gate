import { describe, expect, it } from "vitest";
import { allocate, applyBps, cents, extractInclusiveTax, format } from "./money";

describe("allocate", () => {
  it("distributes without losing a cent", () => {
    const parts = allocate(cents(1000), [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
  });

  it("weights by line value", () => {
    const parts = allocate(cents(500), [3000, 1000]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(500);
    expect(parts).toEqual([375, 125]);
  });

  it("returns zeros when every weight is zero", () => {
    expect(allocate(cents(500), [0, 0])).toEqual([0, 0]);
  });
});

describe("applyBps", () => {
  it("is an exact inverse for a discount and its reversal", () => {
    const amount = cents(1_999);
    const discount = applyBps(amount, 1500);
    expect(discount).toBe(300);
    expect(applyBps(cents(-amount), 1500)).toBe(-discount);
  });
});

describe("extractInclusiveTax", () => {
  it("pulls GST out of a tax-inclusive price rather than adding it on", () => {
    // S$10.90 inclusive of 9% GST contains S$0.90, not S$0.98.
    expect(extractInclusiveTax(cents(1090), 900)).toBe(90);
  });
});

describe("format", () => {
  it("renders SGD", () => {
    expect(format(cents(1890), "SGD")).toMatch(/18\.90/);
  });
});
