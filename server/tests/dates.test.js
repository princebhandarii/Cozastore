import test from "node:test";
import assert from "node:assert/strict";
import { istDayStart, istDateKey, fillDailySeries, escapeRegex } from "../utils/dates.js";

const DAY = 86400000;

test("IST day starts at 18:30 UTC the previous day", () => {
  // 2026-09-28 10:00 UTC is 15:30 IST on the 28th -> day started 2026-09-27T18:30Z
  assert.equal(new Date(istDayStart(new Date("2026-09-28T10:00:00Z"))).toISOString(), "2026-09-27T18:30:00.000Z");
});

test("just after 18:30 UTC is already the next IST day", () => {
  assert.equal(new Date(istDayStart(new Date("2026-09-28T19:00:00Z"))).toISOString(), "2026-09-28T18:30:00.000Z");
  assert.equal(istDateKey(istDayStart(new Date("2026-09-28T19:00:00Z"))), "2026-09-29");
});

test("date keys are IST calendar dates", () => {
  assert.equal(istDateKey(istDayStart(new Date("2026-09-28T10:00:00Z"))), "2026-09-28");
});

test("fillDailySeries returns every day, oldest first, zero-filled", () => {
  const start = istDayStart(new Date("2026-09-28T10:00:00Z")) - 2 * DAY;
  const out = fillDailySeries(start, 3, [{ _id: "2026-09-27", revenue: 500, orders: 2 }]);
  assert.deepEqual(out, [
    { date: "2026-09-26", revenue: 0, orders: 0 },
    { date: "2026-09-27", revenue: 500, orders: 2 },
    { date: "2026-09-28", revenue: 0, orders: 0 },
  ]);
});

test("escapeRegex neutralises regex metacharacters (search input safety)", () => {
  const rx = new RegExp(escapeRegex("a.*b(c"), "i");
  assert.equal(rx.test("a.*b(c"), true);
  assert.equal(rx.test("aXXb(c"), false);
});
