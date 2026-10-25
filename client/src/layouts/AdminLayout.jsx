import { useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Package, Tags, ShoppingBag, Undo2, Star, Users, Ticket, Boxes, CreditCard, BarChart3,
  Settings, Banknote, Menu, X, Sun, Moon, Store,
} from "lucide-react";
import { toggleTheme } from "../store/themeSlice";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/cod", label: "COD confirmations", icon: Banknote },
  { to: "/admin/returns", label: "Returns", icon: Undo2 },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function Nav({ onNavigate }) {
  return (
    <nav className="space-y-0.5">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? "bg-ink-950 font-medium text-white dark:bg-white dark:text-ink-950" : "text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)]"}`
          }
        >
          <Icon size={16} /> {label}
        </NavLink>
      ))}
    </nav>
  );
}

// Completely separate shell from the storefront: sidebar on desktop,
// slide-over drawer on phones and tablets.
export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const mode = useSelector((s) => s.theme.mode);
  const profile = useSelector((s) => s.auth.profile);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <aside className="fixed inset-y-0 left-0 hidden w-60 overflow-y-auto border-r border-[var(--border)] bg-[var(--bg)] p-4 lg:block">
        <Link to="/admin" className="mb-6 block px-3 font-display text-xl font-semibold">COZA<span className="text-[var(--muted)]">.</span> <span className="text-xs font-normal text-[var(--muted)]">admin</span></Link>
        <Nav />
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto bg-[var(--bg)] p-4 shadow-xl lg:hidden"
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "tween", duration: 0.2 }}
            >
              <div className="mb-4 flex items-center justify-between px-3">
                <span className="font-display text-xl font-semibold">COZA<span className="text-[var(--muted)]">.</span></span>
                <button onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
              </div>
              <Nav onNavigate={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)]/90 px-4 py-3 backdrop-blur sm:px-6">
          <button className="rounded-full p-2 hover:bg-[var(--card)] lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <span className="hidden text-sm text-[var(--muted)] lg:block">{profile?.name || profile?.email}</span>
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-1.5 text-xs"><Store size={14} /> View store</Link>
            <button onClick={() => dispatch(toggleTheme())} aria-label="Toggle theme" className="rounded-full p-2 hover:bg-[var(--card)]">{mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
          </div>
        </header>
        <main className="px-4 py-8 sm:px-6">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
