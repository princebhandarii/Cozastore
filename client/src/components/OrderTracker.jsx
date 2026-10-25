import { motion } from "framer-motion";
import { Check } from "lucide-react";

const STEPS = [
  { key: "CONFIRMED", label: "Order Confirmed" },
  { key: "PROCESSING", label: "Processing" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { key: "DELIVERED", label: "Delivered" },
];

// Renders progress from the order's real status history - a step is "done"
// only if the order actually entered that status (timestamp shown).
export default function OrderTracker({ timeline }) {
  const reached = new Map();
  timeline.forEach((t) => { if (!reached.has(t.status)) reached.set(t.status, t.at); });
  const lastDone = STEPS.reduce((idx, step, i) => (reached.has(step.key) ? i : idx), -1);

  return (
    <ol className="relative">
      {STEPS.map((step, i) => {
        const done = i <= lastDone && reached.has(step.key);
        const current = i === lastDone;
        return (
          <motion.li
            key={step.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            className="relative flex gap-4 pb-8 last:pb-0"
          >
            {i < STEPS.length - 1 && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 bg-[var(--border)]">
                <motion.span
                  className="block w-full bg-ink-950 dark:bg-white"
                  initial={{ height: 0 }}
                  animate={{ height: i < lastDone ? "100%" : 0 }}
                  transition={{ delay: 0.3 + i * 0.12, duration: 0.4 }}
                />
              </span>
            )}
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                done ? "border-ink-950 bg-ink-950 text-white dark:border-white dark:bg-white dark:text-ink-950" : "border-[var(--border)] bg-[var(--bg)]"
              }`}
            >
              {done && !current && <Check size={16} />}
              {current && (
                <motion.span
                  className="h-2.5 w-2.5 rounded-full bg-current"
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                />
              )}
            </span>
            <div className="pt-1">
              <p className={`text-sm font-medium ${done ? "" : "text-[var(--muted)]"}`}>{step.label}</p>
              {done && <p className="text-xs text-[var(--muted)]">{new Date(reached.get(step.key)).toLocaleString("en-IN")}</p>}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
