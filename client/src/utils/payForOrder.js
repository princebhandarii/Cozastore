import { createPaymentOrderApi, verifyPaymentApi, reportPaymentFailedApi } from "../services/checkoutService";

const loadRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Could not load Razorpay. Check your connection."));
    document.body.appendChild(script);
  });

// Opens Razorpay Checkout for an existing order.
// Resolves with { status: "paid" | "failed" | "dismissed" | "refunded", order?, message? }.
// The amount is fetched from OUR server; "paid" is only returned after the
// server verified the signature - never on the browser's say-so.
export const payForOrder = async ({ orderId, profile }) => {
  await loadRazorpayScript();
  const rp = await createPaymentOrderApi(orderId);

  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const rzp = new window.Razorpay({
      key: rp.keyId,
      amount: rp.amount,
      currency: rp.currency,
      order_id: rp.razorpayOrderId,
      name: "Coza Store",
      description: `Order ${rp.orderNumber}`,
      prefill: { name: profile?.name, email: profile?.email, contact: profile?.phone || undefined },
      theme: { color: "#0a0a0a" },
      handler: async (response) => {
        try {
          const order = await verifyPaymentApi(response);
          done({ status: "paid", order });
        } catch (err) {
          if (err.code === "OUT_OF_STOCK_REFUNDED") done({ status: "refunded", message: err.message });
          else done({ status: "failed", message: err.message });
        }
      },
      modal: { ondismiss: () => done({ status: "dismissed" }) },
    });

    rzp.on("payment.failed", async (resp) => {
      const reason = resp?.error?.description || "Payment failed";
      await reportPaymentFailedApi(orderId, reason);
      done({ status: "failed", message: reason });
    });

    rzp.open();
  });
};
