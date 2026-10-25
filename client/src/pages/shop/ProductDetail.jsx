import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Star, Heart } from "lucide-react";
import { fetchProductBySlug } from "../../services/productService";
import { formatPrice } from "../../utils/formatPrice";
import { addToCart } from "../../store/cartSlice";
import { addToWishlist, removeFromWishlist } from "../../store/wishlistSlice";
import ReviewSection from "../../components/ReviewSection";

export default function ProductDetail() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState(null); // { type, text }
  const [adding, setAdding] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const wishlistItems = useSelector((s) => s.wishlist.items);

  useEffect(() => {
    setLoading(true);
    fetchProductBySlug(slug)
      .then((p) => {
        setProduct(p);
        setActiveImage(0);
        setSelectedSize(p.variants?.[0]?.size || null);
        setSelectedColor(p.variants?.[0]?.color || null);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const sizes = useMemo(
    () => [...new Set((product?.variants || []).map((v) => v.size).filter(Boolean))],
    [product]
  );
  const colors = useMemo(
    () => [...new Set((product?.variants || []).map((v) => v.color).filter(Boolean))],
    [product]
  );

  const activeVariant = useMemo(() => {
    if (!product?.variants?.length) return null;
    return (
      product.variants.find(
        (v) =>
          (!selectedSize || v.size === selectedSize) &&
          (!selectedColor || v.color === selectedColor)
      ) || product.variants[0]
    );
  }, [product, selectedSize, selectedColor]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2">
          <div className="aspect-[4/5] rounded-2xl skeleton" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 rounded skeleton" />
            <div className="h-4 w-1/3 rounded skeleton" />
            <div className="h-24 w-full rounded skeleton" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return <p className="py-24 text-center text-sm text-[var(--muted)]">Product not found.</p>;
  }

  const price = activeVariant?.price ?? product.price;
  const effectivePrice = product.discount ? Math.round(price * (1 - product.discount / 100)) : price;
  const stock = activeVariant?.stock ?? product.stock;
  const inWishlist = wishlistItems.some((w) => w._id === product._id);

  const handleAddToCart = async () => {
    if (!isAuthenticated) return navigate("/login", { state: { from: { pathname: `/product/${slug}` } } });
    setAdding(true);
    setMessage(null);
    const result = await dispatch(
      addToCart({ productId: product._id, variantId: activeVariant?._id, quantity: qty })
    );
    setAdding(false);
    setMessage(
      addToCart.fulfilled.match(result)
        ? { type: "success", text: "Added to cart." }
        : { type: "error", text: result.payload?.message || "Could not add to cart" }
    );
  };

  const handleWishlist = () => {
    if (!isAuthenticated) return navigate("/login", { state: { from: { pathname: `/product/${slug}` } } });
    dispatch(inWishlist ? removeFromWishlist(product._id) : addToWishlist(product._id));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs text-[var(--muted)]">
        <Link to="/shop" className="hover:underline">Shop</Link> / {product.category?.name} / {product.name}
      </p>

      <div className="mt-4 grid gap-10 sm:grid-cols-2">
        <div>
          <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-[var(--card)]">
            {product.images?.[activeImage]?.url && (
              <img
                src={product.images[activeImage].url}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="mt-3 flex gap-3">
              {product.images.map((img, i) => (
                <button
                  key={img.url}
                  onClick={() => setActiveImage(i)}
                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${
                    activeImage === i ? "border-ink-950 dark:border-white" : "border-transparent"
                  }`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{product.brand}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">{product.name}</h1>

          <div className="mt-2 flex items-center gap-2 text-sm">
            <Star size={14} className="fill-current" />
            <span>{product.ratings?.toFixed(1) || "New"}</span>
            <span className="text-[var(--muted)]">({product.reviewCount} reviews)</span>
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{formatPrice(effectivePrice)}</span>
            {product.compareAtPrice && (
              <span className="text-sm text-[var(--muted)] line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
            {product.discount > 0 && (
              <span className="rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                {product.discount}% off
              </span>
            )}
          </div>

          <p className="mt-4 text-sm text-[var(--muted)]">{product.shortDescription}</p>

          {sizes.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium">Size</p>
              <div className="mt-2 flex gap-2">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`rounded-full border px-4 py-1.5 text-sm ${
                      selectedSize === size
                        ? "border-ink-950 bg-ink-950 text-white dark:border-white dark:bg-white dark:text-ink-950"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {colors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium">Color</p>
              <div className="mt-2 flex gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`rounded-full border px-4 py-1.5 text-sm ${
                      selectedColor === color
                        ? "border-ink-950 bg-ink-950 text-white dark:border-white dark:bg-white dark:text-ink-950"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center rounded-full border border-[var(--border)]">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2">-</button>
              <span className="w-8 text-center text-sm">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(stock || 1, q + 1))}
                className="px-3 py-2"
              >
                +
              </button>
            </div>
            <span className="text-xs text-[var(--muted)]">
              {stock > 0 ? `${stock} in stock` : "Out of stock"}
            </span>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              disabled={stock === 0 || adding}
              onClick={handleAddToCart}
              className="flex-1 rounded-full bg-ink-950 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-white dark:text-ink-950"
            >
              {stock === 0 ? "Out of stock" : adding ? "Adding..." : "Add to cart"}
            </button>
            <button onClick={handleWishlist} className="rounded-full border border-[var(--border)] p-3" aria-label="Toggle wishlist">
              <Heart size={18} className={inWishlist ? "fill-current" : ""} />
            </button>
          </div>
          {message && (
            <p className={`mt-2 text-xs ${message.type === "success" ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
              {message.text} {message.type === "success" && <Link to="/cart" className="underline">View cart</Link>}
            </p>
          )}

          {product.specifications?.length > 0 && (
            <div className="mt-8 border-t border-[var(--border)] pt-6">
              <p className="text-sm font-medium">Specifications</p>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                {product.specifications.map((spec) => (
                  <div key={spec.key} className="contents">
                    <dt className="text-[var(--muted)]">{spec.key}</dt>
                    <dd>{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
      <ReviewSection productId={product._id} onChanged={() => fetchProductBySlug(slug).then(setProduct)} />
    </div>
  );
}
