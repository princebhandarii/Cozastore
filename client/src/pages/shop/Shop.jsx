import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import ProductCard from "../../components/ProductCard";
import ProductGridSkeleton from "../../components/ProductGridSkeleton";
import { fetchProducts, fetchCategories } from "../../services/productService";

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to high" },
  { value: "price_desc", label: "Price: High to low" },
  { value: "rating", label: "Top rated" },
  { value: "popular", label: "Most popular" },
];

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "newest";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const inStock = searchParams.get("inStock") === "true";
  const page = Number(searchParams.get("page") || 1);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchProducts({
        q: q || undefined,
        category: category || undefined,
        sort,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        inStock: inStock || undefined,
        page,
        limit: 12,
      });
      setProducts(res.data);
      setMeta(res.meta);
    } finally {
      setLoading(false);
    }
  }, [q, category, sort, minPrice, maxPrice, inStock, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Changing a filter/search/sort value always resets back to page 1.
  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("page", "1");
    setSearchParams(next);
  };

  // Pagination itself only ever changes the page number.
  const goToPage = (pageNumber) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(pageNumber));
    setSearchParams(next);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-semibold">Shop</h1>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              defaultValue={q}
              onKeyDown={(e) => e.key === "Enter" && e.target.value !== q && updateParam("q", e.target.value)}
              onBlur={(e) => e.target.value !== q && updateParam("q", e.target.value)}
              placeholder="Search products..."
              className="w-56 rounded-full border border-[var(--border)] bg-[var(--card)] py-2 pl-9 pr-4 text-sm outline-none"
            />
          </div>

          <select
            value={sort}
            onChange={(e) => updateParam("sort", e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button
            onClick={() => setShowFilters((s) => !s)}
            className="flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm"
          >
            <SlidersHorizontal size={14} /> Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mt-6 grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-[var(--muted)]">Category</label>
            <select
              value={category}
              onChange={(e) => updateParam("category", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted)]">Min price</label>
            <input
              type="number"
              defaultValue={minPrice}
              onBlur={(e) => e.target.value !== minPrice && updateParam("minPrice", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted)]">Max price</label>
            <input
              type="number"
              defaultValue={maxPrice}
              onBlur={(e) => e.target.value !== maxPrice && updateParam("maxPrice", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => updateParam("inStock", e.target.checked ? "true" : "")}
              />
              In stock only
            </label>
          </div>
        </div>
      )}

      <div className="mt-8">
        {loading ? (
          <ProductGridSkeleton />
        ) : products.length === 0 ? (
          <p className="py-20 text-center text-sm text-[var(--muted)]">
            No products found. Try adjusting your filters.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </div>

      {meta.pages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          {Array.from({ length: meta.pages }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToPage(i + 1)}
              className={`h-9 w-9 rounded-full text-sm ${
                meta.page === i + 1
                  ? "bg-ink-950 text-white dark:bg-white dark:text-ink-950"
                  : "border border-[var(--border)]"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
