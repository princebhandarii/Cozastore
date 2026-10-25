import { Routes, Route } from "react-router-dom";
import useAuthListener from "./hooks/useAuthListener";
import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/home/Home";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Account from "./pages/account/Account";
import Shop from "./pages/shop/Shop";
import ProductDetail from "./pages/shop/ProductDetail";
import Cart from "./pages/cart/Cart";
import Wishlist from "./pages/wishlist/Wishlist";
import Checkout from "./pages/checkout/Checkout";
import Orders from "./pages/orders/Orders";
import OrderDetail from "./pages/orders/OrderDetail";
import OrderTrack from "./pages/orders/OrderTrack";
import NewReturn from "./pages/returns/NewReturn";
import Returns from "./pages/returns/Returns";
import ReturnDetail from "./pages/returns/ReturnDetail";
import ComingSoon from "./pages/static/ComingSoon";
import RouteLoading from "./components/RouteLoading";
import { lazy, Suspense } from "react";

// The entire admin area (charting library, every CRUD screen) is only ever
// needed by admins, so it ships as its own chunk instead of bloating the
// storefront bundle every shopper has to download.
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const Products = lazy(() => import("./pages/admin/Products"));
const Categories = lazy(() => import("./pages/admin/Categories"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminCod = lazy(() => import("./pages/admin/AdminCod"));
const AdminReturns = lazy(() => import("./pages/admin/AdminReturns"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const Users = lazy(() => import("./pages/admin/Users"));
const Coupons = lazy(() => import("./pages/admin/Coupons"));
const Inventory = lazy(() => import("./pages/admin/Inventory"));
const Payments = lazy(() => import("./pages/admin/Payments"));
const Settings = lazy(() => import("./pages/admin/Settings"));

export default function App() {
  // Subscribes once to Firebase's auth state and keeps Redux in sync.
  useAuthListener();

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Phase 2 */}
        <Route path="/shop" element={<Shop />} />
        <Route path="/product/:slug" element={<ProductDetail />} />

        {/* Phase 3 */}
        <Route path="/cart" element={<Cart />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/about" element={<ComingSoon title="About Coza Store" />} />
        <Route path="/contact" element={<ComingSoon title="Contact us" />} />

        {/* Phase 1: authenticated account area */}
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route path="/account/returns" element={<ProtectedRoute><Returns /></ProtectedRoute>} />
        <Route path="/account/returns/new" element={<ProtectedRoute><NewReturn /></ProtectedRoute>} />
        <Route path="/account/returns/:id" element={<ProtectedRoute><ReturnDetail /></ProtectedRoute>} />
        <Route
          path="/account/orders/:id/track"
          element={
            <ProtectedRoute>
              <OrderTrack />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/orders/:id"
          element={
            <ProtectedRoute>
              <OrderDetail />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<ComingSoon title="Page not found" />} />
      </Route>

      {/* Admin area: its own layout (sidebar/topbar), lazy-loaded as one
          chunk, gated on role=admin from MongoDB */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <Suspense fallback={<RouteLoading />}>
              <AdminLayout />
            </Suspense>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="categories" element={<Categories />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="cod" element={<AdminCod />} />
        <Route path="returns" element={<AdminReturns />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="users" element={<Users />} />
        <Route path="coupons" element={<Coupons />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="payments" element={<Payments />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
