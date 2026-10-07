import { describe, it, expect } from "@jest/globals";

// Invoice computation engine modeled after Phase 6 billing logic
function calculateInvoiceTotals({ items, taxPercent = 18, discountAmount = 0, payments = [] }) {
  // 1. Calculate line items total
  const calculatedItems = items.map((item) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unitPrice) || 0;
    return {
      ...item,
      quantity: qty,
      unitPrice: price,
      total: qty * price,
    };
  });

  const subtotal = calculatedItems.reduce((sum, item) => sum + item.total, 0);

  // 2. Tax computation
  const taxAmount = Number(((subtotal * (Number(taxPercent) || 0)) / 100).toFixed(2));

  // 3. Discount subtraction
  const discount = Math.min(Number(discountAmount) || 0, subtotal + taxAmount);

  // 4. Net total amount
  const totalAmount = Number((subtotal + taxAmount - discount).toFixed(2));

  // 5. Total paid and balance
  const paidAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const balanceAmount = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));

  let status = "issued";
  if (paidAmount >= totalAmount && totalAmount > 0) {
    status = "paid";
  } else if (paidAmount > 0 && paidAmount < totalAmount) {
    status = "partial";
  } else if (paidAmount === 0) {
    status = "issued";
  }

  return {
    items: calculatedItems,
    subtotal,
    taxPercent,
    taxAmount,
    discountAmount: discount,
    totalAmount,
    paidAmount,
    balanceAmount,
    status,
  };
}

describe("Phase 6 Billing & Invoice Mathematics Tests", () => {
  it("should calculate correct line item totals and subtotal", () => {
    const items = [
      { description: "General Consultation", quantity: 1, unitPrice: 500 },
      { description: "Blood Pressure Check", quantity: 2, unitPrice: 100 },
      { description: "CBC Test", quantity: 1, unitPrice: 350 },
    ];

    const result = calculateInvoiceTotals({ items, taxPercent: 0, discountAmount: 0 });
    expect(result.subtotal).toBe(1050); // 500 + 200 + 350
    expect(result.items[1].total).toBe(200);
  });

  it("should accurately compute 18% GST tax amount", () => {
    const items = [{ description: "Cardiology Consultation", quantity: 1, unitPrice: 1000 }];
    const result = calculateInvoiceTotals({ items, taxPercent: 18, discountAmount: 0 });

    expect(result.subtotal).toBe(1000);
    expect(result.taxAmount).toBe(180);
    expect(result.totalAmount).toBe(1180);
  });

  it("should accurately apply discounts and reduce total net payable", () => {
    const items = [{ description: "Executive Checkup", quantity: 1, unitPrice: 2000 }];
    const result = calculateInvoiceTotals({ items, taxPercent: 10, discountAmount: 200 });

    // subtotal = 2000, tax = 200 (10%), total before discount = 2200, discount = 200
    expect(result.subtotal).toBe(2000);
    expect(result.taxAmount).toBe(200);
    expect(result.discountAmount).toBe(200);
    expect(result.totalAmount).toBe(2000);
  });

  it("should correctly classify invoice status as 'partial' when paid amount is less than total", () => {
    const items = [{ description: "Treatment Package", quantity: 1, unitPrice: 1000 }];
    const payments = [{ amount: 500, method: "cash" }];
    const result = calculateInvoiceTotals({ items, taxPercent: 0, discountAmount: 0, payments });

    expect(result.totalAmount).toBe(1000);
    expect(result.paidAmount).toBe(500);
    expect(result.balanceAmount).toBe(500);
    expect(result.status).toBe("partial");
  });

  it("should classify invoice status as 'paid' and zero balance when full payment is recorded", () => {
    const items = [{ description: "Pediatric Consultation", quantity: 1, unitPrice: 600 }];
    const payments = [
      { amount: 400, method: "upi" },
      { amount: 200, method: "cash" },
    ];
    const result = calculateInvoiceTotals({ items, taxPercent: 0, discountAmount: 0, payments });

    expect(result.totalAmount).toBe(600);
    expect(result.paidAmount).toBe(600);
    expect(result.balanceAmount).toBe(0);
    expect(result.status).toBe("paid");
  });
});
