import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Menu, X, User, Heart, ShoppingBag, Sun, Moon } from "lucide-react";
import { toggleTheme } from "../store/themeSlice";
import { logoutUser } from "../store/authSlice";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { mode } = useSelector((state) => state.theme);
  const { isAuthenticated, profile } = useSelector((state) => state.auth);
  const cartCount = useSelector((state) => state.cart.itemCount);
  const wishlistCount = useSelector((state) => state.wishlist.items.length);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="font-display text-2xl font-semibold tracking-tight">
          COZA<span className="text-ink-500">.</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:opacity-70 ${
                  isActive ? "border-b-2 border-current pb-1" : ""
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button
            aria-label="Toggle theme"
            onClick={() => dispatch(toggleTheme())}
            className="rounded-full p-2 transition-colors hover:bg-[var(--card)]"
          >
            {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <Link to="/wishlist" aria-label="Wishlist" className="relative hidden rounded-full p-2 hover:bg-[var(--card)] sm:block">
            <Heart size={18} />
            {wishlistCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink-950 px-1 text-[10px] text-white dark:bg-white dark:text-ink-950">{wishlistCount}</span>}
          </Link>
          <Link to="/cart" aria-label="Cart" className="relative rounded-full p-2 hover:bg-[var(--card)]">
            <ShoppingBag size={18} />
            {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink-950 px-1 text-[10px] text-white dark:bg-white dark:text-ink-950">{cartCount}</span>}
          </Link>

          {isAuthenticated ? (
            <div className="group relative">
              <button className="flex items-center gap-2 rounded-full p-2 hover:bg-[var(--card)]">
                <User size={18} />
              </button>
              <div className="invisible absolute right-0 mt-2 w-48 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                <p className="truncate px-3 py-1 text-xs text-[var(--muted)]">
                  {profile?.name || profile?.email}
                </p>
                <Link to="/account" className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg)]">
                  My account
                </Link>
                <Link to="/account/orders" className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg)]">
                  My orders
                </Link>
                <Link to="/account/returns" className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg)]">
                  My returns
                </Link>
                {profile?.role === "admin" && (
                  <Link to="/admin" className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg)]">
                    Admin panel
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--color-danger)] hover:bg-[var(--bg)]"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-ink-950 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-ink-950"
            >
              Sign in
            </Link>
          )}

          <button
            className="rounded-full p-2 hover:bg-[var(--card)] md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-[var(--border)] px-4 py-3 md:hidden">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--card)]"
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
