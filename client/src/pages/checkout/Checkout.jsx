import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Check, X, MapPin } from "lucide-react";
import { fetchCart } from "../../store/cartSlice";
import { syncProfile } from "../../store/authSlice";
import { checkPincodeApi, checkoutSummaryApi, createOrderApi } from "../../services/checkoutService";
import { payForOrder } from "../../utils/payForOrder";
import { formatPrice } from "../../utils/formatPrice";

const STEPS = ["Address", "Delivery", "Coupon", "Payment", "Review"];

export default function Checkout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const profile = useSelector((s) => s.auth.profile);
  const cartItems = useSelector((s) => s.cart.items);
  const cartStatus = useSelector((s) => s.cart.status);

  // memoized: a fresh [] every render would make the effects below re-run constantly
  const addresses = useMemo(() => profile?.addresses || [], [profile]);
  const [step, setStep] = useState(0);
  const [addressId, setAddressId] = useState(null);
  const [pin, setPin] = useState(null); // { valid, serviceable, city, state, message }
  const [pinError, setPinError] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ONLINE");
  const [placing, setPlacing] = useState(false);
  const [payMessage, setPayMessage] = useState("");

  useEffect(() => { dispatch(syncProfile()); dispatch(fetchCart()); }, [dispatch]);

  useEffect(() => {
    if (!addressId && addresses.length) {
      setAddressId((addresses.find((a) => a.isDefault) || addresses[0])._id);
    }
  }, [addresses, addressId]);

  const selected = addresses.find((a) => a._id === addressId);

  // Step 2: verify the PIN through the backend (never assume 6 digits = deliverable)
  useEffect(() => {
    if (!selected) return;
    setPin(null);
    setPinError("");
    checkPincodeApi(selected.pincode).then(setPin).catch((e) => setPinError(e.message));
  }, [selected?.pincode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every total shown here comes from the server.
  const loadSummary = useCallback(async () => {
    if (!addressId) return;
    setSummaryError("");
    try {
      setSummary(await checkoutSummaryApi({ addressId, couponCode: couponCode || undefined }));
      setCouponError("");
    } catch (err) {
      setSummary(null);
      if (err.code?.startsWith("COUPON_")) {
        setCouponError(err.message);
        setCouponCode("");
      } else {
        setSummaryError(err.message);
      }
    }
  }, [addressId, couponCode]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // If COD stops being available for the current total (e.g. a coupon dropped
  // it below the minimum), fall back to online payment.
  useEffect(() => {
    if (paymentMethod === "COD" && summary && !summary.cod?.available) setPaymentMethod("ONLINE");
  }, [summary, paymentMethod]);

  const placeOrder = async () => {
    setPlacing(true);
    setPayMessage("");
    try {
      const order = await createOrderApi({ addressId, couponCode: couponCode || undefined, paymentMethod });
      if (paymentMethod === "COD") {
        // COD: the order page walks through phone verification (if enabled)
        // and the token payment.
        return navigate(`/account/orders/${order._id}?cod=1`, { replace: true });
      }
      const result = await payForOrder({ orderId: order._id, profile });
      dispatch(fetchCart());
      if (result.status === "paid") return navigate(`/account/orders/${order._id}?placed=1`, { replace: true });
      if (result.status === "refunded") {
        setPayMessage(result.message);
        return navigate(`/account/orders/${order._id}`, { replace: true });
      }
      setPayMessage(
        result.status === "dismissed"
          ? "Payment window closed. Your order is saved - you can pay from My orders."
          : `Payment failed: ${result.message}. You can retry from My orders.`
      );
      navigate(`/account/orders/${order._id}`, { replace: true });
    } catch (err) {
      setPayMessage(err.message);
    } finally {
      setPlacing(false);
    }
  };

  if (cartStatus !== "loading" && cartItems.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Nothing to check out.</h1>
        <Link to="/shop" className="mt-4 inline-block text-sm underline">Continue shopping</Link>
      </div>
    );
  }

  const deliverable = pin?.valid && pin?.serviceable;
  const canNext =
    (step === 0 && selected) ||
    (step === 1 && deliverable && summary) ||
    step === 2 || step === 3;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold">Checkout</h1>

      <ol className="mt-6 flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, i) => (
          <li key={label} className={`rounded-full px-3 py-1 ${i === step ? "bg-ink-950 text-white dark:bg-white dark:text-ink-950" : i < step ? "border border-[var(--border)]" : "text-[var(--muted)]"}`}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          {step === 0 && (
            <div>
              <h2 className="font-medium">Delivery address</h2>
              {addresses.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  You have no saved addresses. <Link to="/account" className="underline">Add one in My account</Link>, then come back.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {addresses.map((a) => (
                    <label key={a._id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-sm ${addressId === a._id ? "border-ink-950 dark:border-white" : "border-[var(--border)]"}`}>
                      <input type="radio" checked={addressId === a._id} onChange={() => setAddressId(a._id)} />
                      <span>
                        <span className="font-medium">{a.fullName}</span> <span className="text-xs text-[var(--muted)]">({a.addressType})</span>
                        <br />{a.addressLine1}, {a.city}, {a.state} - {a.pincode}
                        <br /><span className="text-[var(--muted)]">{a.phone}</span>
                      </span>
                    </label>
                  ))}
                  <Link to="/account" className="inline-block text-xs underline">Manage addresses</Link>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="font-medium">Delivery</h2>
              {selected && (
                <p className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]"><MapPin size={14} /> {selected.city}, {selected.state} - {selected.pincode}</p>
              )}
              <div className="mt-4 text-sm">
                {pinError ? (
                  <p className="text-[var(--color-danger)]">{pinError}</p>
                ) : !pin ? (
                  <div className="h-6 w-48 rounded skeleton" />
                ) : deliverable ? (
                  <p className="flex items-center gap-2 text-[var(--color-success)]"><Check size={16} /> Delivery available to {pin.city}, {pin.state}</p>
                ) : (
                  <p className="flex items-center gap-2 text-[var(--color-danger)]"><X size={16} /> {pin.valid ? "Delivery unavailable for this PIN code" : "This PIN code was not found"}</p>
                )}
              </div>
              {summaryError && <p className="mt-3 text-sm text-[var(--color-danger)]">{summaryError}</p>}
              {summary && (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Shipping: {summary.shippingCharge === 0 ? "Free" : formatPrice(summary.shippingCharge)}
                </p>
              )}
              {!deliverable && pin && <p className="mt-3 text-xs text-[var(--muted)]">Go back and choose a different address.</p>}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-medium">Coupon</h2>
              {couponCode ? (
                <div className="mt-4 flex items-center justify-between rounded-lg bg-[var(--color-success)]/10 px-3 py-2 text-sm text-[var(--color-success)]">
                  <span>{couponCode} applied</span>
                  <button onClick={() => { setCouponCode(""); setCouponInput(""); }} aria-label="Remove coupon"><X size={14} /></button>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Coupon code" className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm" />
                  <button disabled={!couponInput} onClick={() => setCouponCode(couponInput)} className="rounded-lg border border-[var(--border)] px-4 text-sm disabled:opacity-50">Apply</button>
                </div>
              )}
              {couponError && <p className="mt-2 text-xs text-[var(--color-danger)]">{couponError}</p>}
              <p className="mt-3 text-xs text-[var(--muted)]">Optional. The discount is calculated by the server.</p>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-medium">Payment method</h2>
              <div className="mt-4 space-y-3 text-sm">
                <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${paymentMethod === "ONLINE" ? "border-ink-950 dark:border-white" : "border-[var(--border)]"}`}>
                  <input type="radio" checked={paymentMethod === "ONLINE"} onChange={() => setPaymentMethod("ONLINE")} />
                  <span><span className="font-medium">Pay online</span><br /><span className="text-[var(--muted)]">UPI, cards, netbanking & wallets via Razorpay</span></span>
                </label>
                {summary?.cod?.available ? (
                  <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${paymentMethod === "COD" ? "border-ink-950 dark:border-white" : "border-[var(--border)]"}`}>
                    <input type="radio" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")} />
                    <span>
                      <span className="font-medium">Cash on delivery</span><br />
                      <span className="text-[var(--muted)]">
                        Pay {formatPrice(summary.cod.tokenAmount)} online now to book the order, and {formatPrice(summary.cod.remainingAmount)} in cash when it arrives.
                        The store confirms COD orders before dispatch.
                      </span>
                    </span>
                  </label>
                ) : (
                  <div className="flex gap-3 rounded-xl border border-[var(--border)] p-4 opacity-50">
                    <input type="radio" disabled />
                    <span><span className="font-medium">Cash on delivery</span><br /><span className="text-[var(--muted)]">{summary?.cod?.reason || "Unavailable"}</span></span>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-medium">Review your order</h2>
              {selected && (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Deliver to {selected.fullName}, {selected.addressLine1}, {selected.city} - {selected.pincode}
                </p>
              )}
              <ul className="mt-4 divide-y divide-[var(--border)] text-sm">
                {summary?.items.map((i) => (
                  <li key={i._id} className="flex justify-between py-2">
                    <span>{i.name} {[i.size, i.color].filter(Boolean).length > 0 && `(${[i.size, i.color].filter(Boolean).join("/")})`} × {i.quantity}</span>
                    <span>{formatPrice(i.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              {payMessage && <p className="mt-4 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{payMessage}</p>}
              <button
                onClick={placeOrder}
                disabled={placing || !summary}
                className="mt-5 w-full rounded-full bg-ink-950 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-ink-950"
              >
                {placing
                  ? "Processing..."
                  : !summary
                    ? "Loading..."
                    : paymentMethod === "COD"
                      ? `Place COD order (token ${formatPrice(summary.cod.tokenAmount)})`
                      : `Pay ${formatPrice(summary.totalAmount)}`}
              </button>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="rounded-full border border-[var(--border)] px-5 py-2 text-sm disabled:opacity-40">Back</button>
            {step < 4 && (
              <button disabled={!canNext} onClick={() => setStep((s) => s + 1)} className="rounded-full bg-ink-950 px-6 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-ink-950">Next</button>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm">
          <h2 className="font-medium">Order summary</h2>
          {summary ? (
            <dl className="mt-4 space-y-2">
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Subtotal</dt><dd>{formatPrice(summary.subtotal)}</dd></div>
              {summary.discount > 0 && <div className="flex justify-between text-[var(--color-success)]"><dt>Discount ({summary.couponCode})</dt><dd>-{formatPrice(summary.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Shipping</dt><dd>{summary.shippingCharge === 0 ? "Free" : formatPrice(summary.shippingCharge)}</dd></div>
              <div className="flex justify-between border-t border-[var(--border)] pt-3 text-base font-semibold"><dt>Total</dt><dd>{formatPrice(summary.totalAmount)}</dd></div>
              {paymentMethod === "COD" && summary.cod?.available && (
                <>
                  <div className="flex justify-between"><dt className="text-[var(--muted)]">Pay now (token)</dt><dd>{formatPrice(summary.cod.tokenAmount)}</dd></div>
                  <div className="flex justify-between"><dt className="text-[var(--muted)]">Pay on delivery</dt><dd>{formatPrice(summary.cod.remainingAmount)}</dd></div>
                </>
              )}
            </dl>
          ) : (
            <p className="mt-4 text-xs text-[var(--muted)]">{summaryError || "Select an address to see totals."}</p>
          )}
          <p className="mt-4 text-xs text-[var(--muted)]">Totals are recalculated on the server when you place the order.</p>
        </aside>
      </div>
    </div>
  );
}
