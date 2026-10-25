import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Truck, ShieldCheck, RotateCcw } from "lucide-react";
import ProductCard from "../../components/ProductCard";
import ProductGridSkeleton from "../../components/ProductGridSkeleton";
import { fetchProducts } from "../../services/productService";

const perks = [
  { icon: Truck, title: "Fast delivery", desc: "Real-time tracking on every order" },
  { icon: ShieldCheck, title: "Secure payments", desc: "Razorpay + verified server-side checks" },
  { icon: RotateCcw, title: "Easy returns", desc: "Hassle-free return & refund flow" },
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts({ sort: "popular", limit: 8 })
      .then((res) => setFeatured(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              New season
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-tight sm:text-6xl">
              Minimal essentials,
              <br /> made to last.
            </h1>
            <p className="mt-6 max-w-md text-[var(--muted)]">
              Discover a curated collection of premium, everyday pieces —
              designed with restraint, built with care.
            </p>
            <Link
              to="/shop"
              className="mt-8 inline-block rounded-full bg-ink-950 px-8 py-3 text-sm font-medium text-white transition-transform hover:scale-[1.02] dark:bg-white dark:text-ink-950"
            >
              Shop the collection
            </Link>
          </motion.div>
                <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ duration: 0.5, delay: 0.1 }}
                    className="aspect-[4/5] overflow-hidden rounded-3xl bg-gradient-to-br from-ink-100 to-ink-50 dark:from-ink-900 dark:to-ink-800"
                    >
                  <img
                    src="/hero.jpg"
                    alt="New season collection"
                    className="h-full w-full object-cover"
                  />
                </motion.div>
        </div>
      </section>

      <section className="border-t border-[var(--border)]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
          {perks.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-4">
              <div className="rounded-full border border-[var(--border)] p-3">
                <Icon size={20} />
              </div>
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold">Featured products</h2>
          <Link to="/shop" className="text-sm font-medium underline">View all</Link>
        </div>
        <div className="mt-8">
          {loading ? (
            <ProductGridSkeleton count={4} />
          ) : featured.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No products yet — run <code>npm run seed</code> in the server
              folder to populate the catalog.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {featured.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
