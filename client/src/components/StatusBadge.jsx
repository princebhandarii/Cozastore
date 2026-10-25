const tone = {
  CONFIRMED: "success", PROCESSING: "success", SHIPPED: "success", OUT_FOR_DELIVERY: "success", DELIVERED: "success", REFUNDED: "success",
  PENDING_PAYMENT: "warning", PENDING_COD_CONFIRMATION: "warning", RETURN_REQUESTED: "warning", REFUND_INITIATED: "warning",
  PAYMENT_FAILED: "danger", CANCELLED: "danger", RETURN_REJECTED: "danger",
};
const colors = {
  success: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
  neutral: "bg-[var(--border)] text-[var(--muted)]",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors[tone[status] || "neutral"]}`}>
      {status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}
