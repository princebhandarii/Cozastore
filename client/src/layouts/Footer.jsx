import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg)]">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="col-span-2 md:col-span-1">
          <p className="font-display text-xl font-semibold">COZA.</p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Premium essentials, delivered with care.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">Shop</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            <li><Link to="/shop" className="hover:text-[var(--fg)]">All products</Link></li>
            <li><Link to="/wishlist" className="hover:text-[var(--fg)]">Wishlist</Link></li>
            <li><Link to="/cart" className="hover:text-[var(--fg)]">Cart</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Support</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            <li><Link to="/contact" className="hover:text-[var(--fg)]">Contact us</Link></li>
            <li><Link to="/account/orders" className="hover:text-[var(--fg)]">Track order</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            <li><Link to="/about" className="hover:text-[var(--fg)]">About</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--muted)]">
        © {new Date().getFullYear()} Coza Store. All rights reserved.
      </div>
    </footer>
  );
}
