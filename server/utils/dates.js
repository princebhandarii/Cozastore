// India has no DST: IST is always UTC+5:30. Dashboards group by IST calendar days.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// UTC ms of the start (00:00 IST) of the IST day containing `date`.
export const istDayStart = (date = new Date()) =>
  Math.floor((date.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;

export const istDateKey = (ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

// Turns sparse per-day rows into a complete series (missing days = zeros).
export const fillDailySeries = (startMs, days, rows) => {
  const byDate = new Map(rows.map((r) => [r._id, r]));
  return Array.from({ length: days }, (_, i) => {
    const date = istDateKey(startMs + i * DAY_MS);
    const row = byDate.get(date);
    return { date, revenue: row?.revenue || 0, orders: row?.orders || 0 };
  });
};

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
