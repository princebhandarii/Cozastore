import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { formatPrice } from "../utils/formatPrice";

export default function ProductCard({ product }) {
  const inStock = product.variants?.length ? product.variants.some((v) => v.stock > 0) : product.stock > 0;
  const effectivePrice = product.discount
    ? Math.round(product.price * (1 - product.discount / 100))
    : product.price;

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Link to={`/product/${product.slug}`} className="group block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[var(--card)]">
          {product.images?.[0]?.url && (
            <img
              src={product.images[0].url}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
          {product.discount > 0 && (
            <span className="absolute left-3 top-3 rounded-full bg-ink-950 px-2.5 py-1 text-xs font-medium text-white dark:bg-white dark:text-ink-950">
              -{product.discount}%
            </span>
          )}
          {!inStock && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white">
              Out of stock
            </span>
          )}
        </div>
        <div className="mt-3 space-y-1">
          <p className="truncate text-sm font-medium">{product.name}</p>
          <p className="text-xs text-[var(--muted)]">{product.brand}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{formatPrice(effectivePrice)}</span>
            {product.compareAtPrice && (
              <span className="text-xs text-[var(--muted)] line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
