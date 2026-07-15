import { describe, expect, it } from "vitest";
import { computeAvailable, heldFromLine } from "@/server/catalog/availability";

describe("computeAvailable (S1.4 AC1 — invariant ketersediaan)", () => {
  it("held=0 → available = stok penuh", () => {
    expect(computeAvailable(3, 0)).toBe(3);
  });

  it("held sebagian → stok − held", () => {
    expect(computeAvailable(5, 2)).toBe(3);
  });

  it("held = stok → 0", () => {
    expect(computeAvailable(4, 4)).toBe(0);
  });

  it("held > stok (koreksi data) → klamp ke 0, tak pernah negatif", () => {
    expect(computeAvailable(2, 5)).toBe(0);
  });
});

describe("heldFromLine", () => {
  it("quantity − quantity_returned", () => {
    expect(heldFromLine(3, 1)).toBe(2);
  });
  it("dikembalikan penuh → 0", () => {
    expect(heldFromLine(3, 3)).toBe(0);
  });
  it("tak pernah negatif", () => {
    expect(heldFromLine(2, 5)).toBe(0);
  });
});
