import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Trash2, ShoppingBag } from "lucide-react";
import { removeFromWishlist } from "../../store/wishlistSlice";
import { addToCart } from "../../store/cartSlice";
import { formatPrice } from "../../utils/formatPrice";

export default function Wishlist() {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((s) => s.auth);
  const { items, status } = useSelector((s) => s.wishlist);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Wishlist</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Sign in to save products.</p>
        <Link to="/login" className="mt-6 inline-block rounded-full bg-ink-950 px-6 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-ink-950">Sign in</Link>
      </div>
    );
  }

  if (status === "loading" && items.length === 0) {
    return <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-12 sm:grid-cols-4">{[0,1,2,3].map((i) => <div key={i} className="aspect-[4/5] rounded-2xl skeleton" />)}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Your wishlist is empty.</h1>
        <Link to="/shop" className="mt-6 inline-block text-sm underline">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold">Wishlist</h1>
      <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => {
          const hasVariants = p.variants?.length > 0;
          const price = p.discount ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
          return (
            <div key={p._id}>
              <Link to={`/product/${p.slug}`} className="block aspect-[4/5] overflow-hidden rounded-2xl bg-[var(--card)]">
                {p.images?.[0]?.url && <img src={p.images[0].url} alt={p.name} className="h-full w-full object-cover" />}
              </Link>
              <p className="mt-3 truncate text-sm font-medium">{p.name}</p>
              <p className="text-sm">{formatPrice(price)}</p>
              <div className="mt-2 flex gap-2">
                {hasVariants ? (
                  <Link to={`/product/${p.slug}`} className="flex-1 rounded-full border border-[var(--border)] py-1.5 text-center text-xs">Choose options</Link>
                ) : (
                  <button
                    disabled={p.stock === 0}
                    onClick={async () => {
                      await dispatch(addToCart({ productId: p._id, quantity: 1 }));
                      dispatch(removeFromWishlist(p._id));
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-ink-950 py-1.5 text-xs text-white disabled:opacity-40 dark:bg-white dark:text-ink-950"
                  >
                    <ShoppingBag size={12} /> Move to cart
                  </button>
                )}
                <button onClick={() => dispatch(removeFromWishlist(p._id))} aria-label="Remove" className="rounded-full border border-[var(--border)] p-2">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
