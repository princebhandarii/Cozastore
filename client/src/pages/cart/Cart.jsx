import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Trash2, Minus, Plus, Tag, X } from "lucide-react";
import { updateCartItem, removeCartItem, clearCart } from "../../store/cartSlice";
import { validateCouponApi } from "../../services/cartService";
import { formatPrice } from "../../utils/formatPrice";

export default function Cart() {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((s) => s.auth);
  const { items, subtotal, status, error } = useSelector((s) => s.cart);

  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState(null); // { code, discount } from the server
  const [couponError, setCouponError] = useState("");
  const [applying, setApplying] = useState(false);

  const applyCoupon = async (codeToApply) => {
    setApplying(true);
    setCouponError("");
    try {
      setCoupon(await validateCouponApi(codeToApply));
    } catch (err) {
      setCoupon(null);
      setCouponError(err.message);
    } finally {
      setApplying(false);
    }
  };

  // The cart total can change (quantity edits) - re-validate the applied
  // coupon so the discount always reflects the server's current subtotal.
  useEffect(() => {
    if (coupon) applyCoupon(coupon.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Your cart</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Sign in to view and manage your cart.</p>
        <Link to="/login" className="mt-6 inline-block rounded-full bg-ink-950 px-6 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-ink-950">
          Sign in
        </Link>
      </div>
    );
  }

  if (status === "loading" && items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-12">
        {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl skeleton" />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Your cart is empty.</h1>
        <Link to="/shop" className="mt-6 inline-block rounded-full bg-ink-950 px-6 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-ink-950">
          Continue shopping
        </Link>
      </div>
    );
  }

  const discount = coupon?.discount || 0;
  const hasUnavailable = items.some((i) => !i.available);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Your cart</h1>
        <button onClick={() => dispatch(clearCart())} className="text-sm text-[var(--muted)] underline">Clear cart</button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-[var(--color-danger)]/10 px-4 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item._id} className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              {item.image ? (
                <img src={item.image} alt={item.name} className="h-24 w-20 rounded-lg object-cover" />
              ) : (
                <div className="h-24 w-20 rounded-lg skeleton" />
              )}
              <div className="flex-1">
                <div className="flex justify-between gap-2">
                  <div>
                    {item.slug ? (
                      <Link to={`/product/${item.slug}`} className="text-sm font-medium hover:underline">{item.name}</Link>
                    ) : (
                      <p className="text-sm font-medium">Unavailable item</p>
                    )}
                    <p className="text-xs text-[var(--muted)]">
                      {[item.size, item.color].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                  <button onClick={() => dispatch(removeCartItem(item._id))} aria-label="Remove">
                    <Trash2 size={16} className="text-[var(--color-danger)]" />
                  </button>
                </div>

                {!item.available && (
                  <p className="mt-1 text-xs text-[var(--color-warning)]">{item.reason}</p>
                )}

                {item.slug && (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center rounded-full border border-[var(--border)]">
                      <button
                        disabled={item.quantity <= 1}
                        onClick={() => dispatch(updateCartItem({ itemId: item._id, quantity: item.quantity - 1 }))}
                        className="px-3 py-1.5 disabled:opacity-40" aria-label="Decrease"
                      ><Minus size={14} /></button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        disabled={item.quantity >= item.stock}
                        onClick={() => dispatch(updateCartItem({ itemId: item._id, quantity: item.quantity + 1 }))}
                        className="px-3 py-1.5 disabled:opacity-40" aria-label="Increase"
                      ><Plus size={14} /></button>
                    </div>
                    <p className="text-sm font-semibold">{formatPrice(item.lineTotal)}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <aside className="h-fit rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="font-medium">Order summary</h2>

          <div className="mt-4">
            {coupon ? (
              <div className="flex items-center justify-between rounded-lg bg-[var(--color-success)]/10 px-3 py-2 text-sm text-[var(--color-success)]">
                <span className="flex items-center gap-2"><Tag size={14} /> {coupon.code} applied</span>
                <button onClick={() => setCoupon(null)} aria-label="Remove coupon"><X size={14} /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Coupon code"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                />
                <button
                  disabled={!code || applying}
                  onClick={() => applyCoupon(code)}
                  className="rounded-lg border border-[var(--border)] px-4 text-sm disabled:opacity-50"
                >
                  {applying ? "..." : "Apply"}
                </button>
              </div>
            )}
            {couponError && <p className="mt-1 text-xs text-[var(--color-danger)]">{couponError}</p>}
          </div>

          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--muted)]">Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div>
            {discount > 0 && (
              <div className="flex justify-between text-[var(--color-success)]"><dt>Discount</dt><dd>-{formatPrice(discount)}</dd></div>
            )}
            <div className="flex justify-between text-[var(--muted)]"><dt>Shipping</dt><dd>Calculated at checkout</dd></div>
            <div className="flex justify-between border-t border-[var(--border)] pt-3 text-base font-semibold">
              <dt>Total</dt><dd>{formatPrice(subtotal - discount)}</dd>
            </div>
          </dl>

          {hasUnavailable && (
            <p className="mt-3 text-xs text-[var(--color-warning)]">
              Unavailable items are excluded from the total. Remove or adjust them to continue.
            </p>
          )}

          <Link
            to="/checkout"
            className={`mt-5 block rounded-full bg-ink-950 py-3 text-center text-sm font-medium text-white dark:bg-white dark:text-ink-950 ${hasUnavailable ? "pointer-events-none opacity-40" : ""}`}
          >
            Proceed to checkout
          </Link>
          <p className="mt-2 text-center text-xs text-[var(--muted)]">Final amounts are recalculated on the server at checkout.</p>
        </aside>
      </div>
    </div>
  );
}
