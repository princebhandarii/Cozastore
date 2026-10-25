import test from "node:test";
import assert from "node:assert/strict";
import { fiscalYear, formatInvoiceNumber, computeGst, isInvoiceAvailable } from "../utils/invoice.js";

test("Indian fiscal year runs April to March", () => {
  assert.equal(fiscalYear(new Date(2026, 3, 1)), "2026-27");
  assert.equal(fiscalYear(new Date(2026, 8, 28)), "2026-27");
  assert.equal(fiscalYear(new Date(2027, 2, 31)), "2026-27");
  assert.equal(fiscalYear(new Date(2027, 3, 1)), "2027-28");
  assert.equal(fiscalYear(new Date(2099, 5, 1)), "2099-00");
});

test("invoice numbers are zero-padded", () => {
  assert.equal(formatInvoiceNumber("2026-27", 7), "INV/2026-27/000007");
});

test("no tax lines when the GST rate is 0", () => {
  assert.equal(computeGst({ totalAmount: 1000, ratePercent: 0, sellerState: "X", buyerState: "X" }), null);
});

test("tax-inclusive split adds back up to the total", () => {
  const g = computeGst({ totalAmount: 1120, ratePercent: 12, sellerState: "Gujarat", buyerState: "Gujarat" });
  assert.equal(g.taxable, 1000);
  assert.equal(g.tax, 120);
  assert.equal(g.cgst + g.sgst, 120);
  assert.equal(g.igst, 0);
});

test("different state -> IGST; unknown seller state -> IGST", () => {
  assert.equal(computeGst({ totalAmount: 1120, ratePercent: 12, sellerState: "Tamil Nadu", buyerState: "Gujarat" }).igst, 120);
  assert.equal(computeGst({ totalAmount: 1120, ratePercent: 12, sellerState: "", buyerState: "Gujarat" }).igst, 120);
});

test("odd totals never lose a paisa", () => {
  const g = computeGst({ totalAmount: 3418, ratePercent: 12, sellerState: "Gujarat", buyerState: "Gujarat" });
  assert.equal(Math.round((g.taxable + g.cgst + g.sgst) * 100), 341800);
});

test("invoice only for orders that were confirmed and not cancelled", () => {
  const t = (...s) => s.map((status) => ({ status }));
  assert.equal(isInvoiceAvailable({ status: "PENDING_PAYMENT", timeline: t("PENDING_PAYMENT") }), false);
  assert.equal(isInvoiceAvailable({ status: "PENDING_COD_CONFIRMATION", timeline: t("PENDING_PAYMENT", "PENDING_COD_CONFIRMATION") }), false);
  assert.equal(isInvoiceAvailable({ status: "SHIPPED", timeline: t("PENDING_PAYMENT", "CONFIRMED", "SHIPPED") }), true);
  assert.equal(isInvoiceAvailable({ status: "CANCELLED", timeline: t("PENDING_PAYMENT", "CONFIRMED", "CANCELLED") }), false);
  assert.equal(isInvoiceAvailable({ status: "DELIVERED", timeline: t("CONFIRMED", "DELIVERED") }), true);
});
