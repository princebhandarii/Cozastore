# Coza Store — MERN E-Commerce Platform

Full-stack, production-style e-commerce app built with the MERN stack,
Firebase Authentication, MongoDB Atlas, Cloudinary, Razorpay and a
pluggable shipping/OTP layer. The UI is a premium black-and-white theme
inspired by the CozaStore template.

This build ships **phase by phase**. Each phase is a complete, runnable
increment — no placeholder code, no "rest of file here". This zip contains
**Phases 1-4: Setup/Auth/MongoDB/User system + Products/Categories/Cloudinary/Search + Cart/Wishlist/Coupons + Checkout/Razorpay online payments + COD token system + Order lifecycle/Inventory/Tracking + Returns/Refunds/Reviews/Invoices + Admin dashboard/Analytics/Settings + Email/Shipping integration + Testing/Performance/Deployment.**

**All 10 phases are complete.** This is the full application.

## What's in Phase 1

- Full monorepo scaffold (`client/` + `server/`), ready to extend
- Firebase Authentication on the frontend (email/password + Google),
  verified on the backend with the Firebase Admin SDK on every request
- MongoDB Atlas connection with a `User` model (profile, role,
  addresses) — Firebase owns login, MongoDB owns everything else
- Backend-only role system: the frontend can never assert `admin`
- Address book CRUD with Indian phone (`^[6-9]\d{9}$`) and PIN
  (`^\d{6}$`) validation on both frontend and backend
- App shell: header/footer, light/dark theme (persisted), routing for
  every planned page (later-phase pages show a "Coming soon" placeholder
  instead of 404ing)
- Centralized error handling (`{ success, message, code }` on every
  error), rate limiting, Helmet, CORS

## What's in Phase 2

- `Category` and `Product` models (variants by size/color, each with its own
  SKU/price/stock/image; specifications; ratings; featured/active flags)
- Real Cloudinary integration (`server/services/cloudinary/`): upload from
  memory buffer, delete by `publicId`, multiple product images, category image
- Public catalog API: `GET /api/products` with text search (name + brand),
  category, brand, price range, rating, in-stock filters, 5 sort modes and
  pagination — all executed in MongoDB, never in the browser
- `GET /api/products/:slug`, `GET /api/categories`
- Admin-only (`requireAuth` + `requireAdmin`) create/update/delete for products
  and categories, multipart image upload validated by type (jpeg/png/webp/avif)
  and size (5MB)
- Frontend: Shop page (search, filters, sort, pagination synced to the URL),
  Product detail page (gallery, size/color variant selection, stock),
  featured products on Home, skeleton loaders and empty states
- Seed script: 4 categories + 22 products with variants

### Seeding demo data

```bash
cd server
npm run seed
```

Seeded products use placeholder images (picsum.photos). Once Cloudinary is
configured, replace them by editing products through the admin API.

### Cloudinary setup

1. Create an account at https://cloudinary.com
2. Dashboard -> copy Cloud name, API key, API secret
3. Put them in `server/.env` as `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
   `CLOUDINARY_API_SECRET`. The server starts without them; only image
   upload/delete endpoints return a `CLOUDINARY_NOT_CONFIGURED` error.

### Phase 2 API

| Method | Route | Access |
|---|---|---|
| GET | `/api/products?q=&category=&brand=&minPrice=&maxPrice=&minRating=&inStock=&sort=&page=&limit=` | public |
| GET | `/api/products/:slug` | public |
| GET | `/api/products/admin/all` | admin |
| POST | `/api/products` (multipart: `images[]` + fields, `variants`/`specifications` as JSON strings) | admin |
| PATCH | `/api/products/:id` (supports `removeImagePublicIds` JSON array) | admin |
| DELETE | `/api/products/:id` | admin |
| GET | `/api/categories` | public |
| POST/PATCH/DELETE | `/api/categories[/:id]` | admin |

The admin UI for these arrives in Phase 8; until then use Postman/curl with a
Firebase ID token of a user whose `role` you set to `admin` in MongoDB.

## What's in Phase 3

- **Cart** (`Cart` model): stores only product/variant references and quantity.
  Prices are never stored; every `GET /api/cart` recomputes unit price, line
  total, stock and availability from the Product documents
  (`server/utils/pricing.js`, reused by checkout later).
- Server checks on add/update: product exists and is active, variant required
  when the product has variants, quantity <= available stock, max 20 per item.
  Unavailable items (deleted, inactive, out of stock) are flagged and excluded
  from the subtotal.
- **Wishlist**: stored on `User.wishlist` (add/remove/list, populated, inactive
  products filtered out). "Move to cart" works directly for products without
  variants; products with variants link to the product page to pick options.
- **Coupons** (`Coupon` model + `services/couponService.js`): percentage or
  fixed, minimum order, max discount cap, start/expiry, global usage limit,
  per-user limit. The client sends only the code; the server computes the
  subtotal from the user's cart and returns the discount. Validation is
  rate-limited (30 attempts / 15 min). `usedCount`/`usedBy` are incremented when
  an order is placed (Phase 4+), so validation alone never consumes a coupon.
- Admin coupon CRUD API. Seed script adds `WELCOME10`, `FLAT200` and an
  expired `EXPIRED5` for testing.
- Frontend: cart page (quantity controls, coupon box, order summary), wishlist
  page, header badges, working Add to cart / wishlist heart on the product page.
  Cart and wishlist are per-account, so guests are sent to sign in.

### Phase 3 API

| Method | Route | Access |
|---|---|---|
| GET / POST / DELETE | `/api/cart` (POST body: `productId`, `variantId?`, `quantity`; DELETE clears) | user |
| PATCH / DELETE | `/api/cart/:itemId` | user |
| GET | `/api/wishlist` | user |
| POST / DELETE | `/api/wishlist/:productId` | user |
| POST | `/api/coupons/validate` (`{ code }`) | user |
| GET / POST / PATCH / DELETE | `/api/coupons[/:id]` | admin |

Re-run `npm run seed` in `server/` to load the demo coupons (this resets
categories, products and coupons).

## What's in Phase 4

**Checkout (5 steps):** address -> delivery (PIN check) -> coupon -> payment
method -> review. Every amount shown is returned by the server
(`POST /api/checkout/summary`); the browser never sends a price, total,
discount or shipping figure.

**Order creation** (`POST /api/orders`): the server rebuilds the order from the
cart in the database (`services/checkoutService.js`): re-checks stock and
availability, validates the address and PIN, applies the coupon, adds shipping,
and stores an immutable snapshot (items, prices, address) in `Order` with status
`PENDING_PAYMENT`. COD is rejected with `COD_NOT_AVAILABLE` until Phase 5.

**PIN code validation** (`services/shipping/`): a provider interface with one
adapter, `pincode-lookup`, backed by the India Post PIN directory. It confirms
the PIN exists, returns its state/district, and whether a post office delivers
there; the checkout also verifies the PIN belongs to the address's state. If the
lookup service is unreachable the checkout **fails closed** (`503`) rather than
assuming the PIN is deliverable. This is NOT a courier serviceability check -
Phase 9 adds a courier adapter (e.g. Shiprocket) behind the same interface.
Shipping charge: `FLAT_SHIPPING_CHARGE` below `FREE_SHIPPING_THRESHOLD`
(defaults 50 / 999), free above.

**Razorpay online payment** (`services/payment/razorpayService.js`, real SDK):

1. `POST /api/payments/create-order` - creates a Razorpay order for the amount
   stored on the server-side Order; reuses the open one on retry.
2. Browser opens Razorpay Checkout.
3. `POST /api/payments/verify` - the backend checks the HMAC-SHA256 signature
   (timing-safe) before believing anything, then confirms the order.
4. `POST /api/payments/webhook` - signature-verified server-to-server sync using
   the raw request body, so payments confirm even if the customer closes the tab.
   Handles `payment.captured`, `order.paid`, `payment.failed`,
   `refund.processed`, `refund.failed`.

**Confirmation is idempotent and transactional**
(`services/orderConfirmationService.js`). An atomic `CREATED -> PAID` gate on the
Payment means a duplicate callback or a webhook racing the browser can never
process a payment twice. Inside one MongoDB transaction it: decrements stock
with conditional atomic updates (two buyers can't both take the last unit),
writes an `InventoryLog` row per item, increments coupon usage, moves the order
`PENDING_PAYMENT -> CONFIRMED` with a timeline entry, and clears the cart.
If money was captured but the item sold out meanwhile (or the order was
cancelled mid-payment), the transaction aborts, the payment is recorded, a full
Razorpay refund is issued automatically, and the order is cancelled. If the
refund API call itself fails, the Payment is flagged `needsManualRefund`.

**Order status machine** (`utils/orderStatus.js`): the full set of statuses and
allowed transitions is defined once; `order.pushStatus()` rejects invalid jumps
and always writes a timeline entry.

**Also included:** `InventoryLog` and `Payment` models, order list/detail pages
(with pay/retry), 12 unit tests (`npm test` in `server/`) covering signature
verification, the status machine and shipping charges.

> **MongoDB transactions require a replica set.** MongoDB Atlas (used in this
> project) provides one. A plain local standalone `mongod` will fail at payment
> confirmation.

### Razorpay setup

1. Create an account at https://razorpay.com and stay in **Test mode**.
2. Dashboard -> Account & Settings -> API keys -> generate a test key pair.
   Put them in `server/.env` as `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
   The secret never leaves the server; the key id is returned to the browser
   by `create-order`.
3. Make sure payments are set to **auto-capture** (Settings -> Payment
   capture), otherwise `payment.captured` never fires.
4. Webhook: Settings -> Webhooks -> add `https://<your-backend>/api/payments/webhook`
   (for local testing, expose port 5000 with a tunnel such as ngrok), choose your
   own secret, put it in `RAZORPAY_WEBHOOK_SECRET`, and subscribe to
   `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`,
   `refund.failed`.
5. Test payments with Razorpay's documented test cards/UPI IDs
   (https://razorpay.com/docs/payments/payments/test-card-details/).

### Phase 4 API

| Method | Route | Access |
|---|---|---|
| POST | `/api/shipping/check` (`{ pincode }`, rate-limited) | public |
| POST | `/api/checkout/summary` (`{ addressId, couponCode? }`) | user |
| POST | `/api/orders` (`{ addressId, couponCode?, paymentMethod }`) | user |
| GET | `/api/orders`, `/api/orders/:id` | user (own orders only) |
| POST | `/api/payments/create-order` (`{ orderId }`) | user |
| POST | `/api/payments/verify` | user |
| POST | `/api/payments/failed` | user |
| POST | `/api/payments/webhook` | Razorpay (signature) |

### Not yet built

Cancellation, tracking page, admin order management (Phase 6/8), invoices and
emails (Phases 7/9). The header/footer links for those pages still point at the
basic order list.

## What's in Phase 5

**COD with an online token.** The customer pays a small token through Razorpay
to book the order and pays the rest in cash on delivery. The token is a real
Razorpay payment (`Payment.purpose = COD_TOKEN`), never a number in the database.

**Admin-configurable rules** (`SiteSettings.cod`, page at `/admin/cod`): COD
on/off, minimum and maximum order amount, token type (fixed / percentage), token
value, OTP on/off, and the token cancellation policy (refundable /
non-refundable / decided per cancellation). The server recomputes eligibility
and the token from these stored settings at checkout and again when the order is
created (`utils/codToken.js`). COD is refused if the token would cover the whole
order. Settings are snapshotted onto each order, so later changes don't affect
orders already placed. COD is **off by default** until an admin enables it
(the seed script enables a demo config).

**Flow**

1. Customer selects COD -> `POST /api/orders` creates the order
   (`PENDING_PAYMENT`) with `cod.tokenAmount`, `cod.remainingAmount`.
2. If OTP is on: phone verification on the order page (below).
3. `POST /api/payments/create-order` charges only the token; verify/webhook
   confirm it exactly like an online payment (signature check, atomic, idempotent).
4. On token payment: stock is decremented and held, the coupon is counted,
   `cod.tokenPaid = true`, `paymentStatus = PARTIALLY_PAID`, and the order becomes
   `PENDING_COD_CONFIRMATION`.
5. Admin sees it under "Waiting for confirmation":
   - **Confirm** -> `CONFIRMED` (atomic compare-and-set; double clicks are harmless).
   - **Reject** (reason required) -> `CANCELLED`, in one transaction the stock is
     returned (with inventory log rows) and the coupon redemption released; the
     token is then refunded through Razorpay unless the admin unticks it. If the
     refund call fails the payment is flagged `needsManualRefund`.
6. The customer's order page shows the COD status, token paid and amount due on
   delivery. Collecting the balance is recorded in Phase 6 (delivery).

The order stores everything the spec asks for: `totalAmount`, `cod.tokenAmount`,
`cod.tokenPaid`, `cod.tokenPaymentId`, `cod.remainingAmount`,
`cod.remainingPaymentMethod`, `cod.remainingPaid`.

**OTP architecture** (`services/otp/`): `index.js` implements the rules and
delegates SMS delivery to a provider chosen by `SMS_PROVIDER`. Codes are 6 digits
from a CSPRNG, stored only as an HMAC bound to the order id, valid 5 minutes,
max 5 wrong attempts, 30 s resend cooldown, 5 sends/hour, plus route rate limits.
Payment creation is blocked (`PHONE_NOT_VERIFIED`) until the order's phone is
verified when OTP is required.

> **No real SMS provider is wired in.** `console` is a development-only adapter
> that prints the code in the server terminal and refuses to run in production.
> `http` is a generic JSON template you must adapt to your vendor (MSG91, Twilio,
> Fast2SMS, ...). Until you do, keep "Require phone OTP" off in production.

**Admin audit log:** confirmations, rejections and COD settings changes are
written to `AdminLog` (who, what, before/after).

**Becoming an admin** (there is deliberately no API for it):
sign in once, then run `npm run make-admin -- you@example.com` in `server/`.

**Tests:** 30 unit tests (`npm test` in `server/`) - signatures, status machine
(incl. COD states), token calculation (the spec's example: total Rs 2,050 with a
Rs 100 token leaves Rs 1,950 on delivery), OTP generation/hashing, and model
validation. The MongoDB-dependent flows (transactions, refunds, webhook) need a
real database and Razorpay test keys, and are covered by the manual checklist below.

### Manual test checklist (Razorpay test mode)

1. `npm run seed`, sign in, `npm run make-admin -- <your email>`, reload.
2. Add items (total >= Rs 500), checkout, choose COD, place order, pay the token.
3. Order page shows "Waiting for the store to confirm".
4. `/admin/cod`: Confirm one order; reject another with the refund ticked, and
   check the stock came back and Razorpay shows the refund.
5. Turn on OTP in `/admin/cod`, place another COD order: the code appears in the
   server terminal (`console` provider).
6. Try a wrong code 6 times, and paying before verifying.

### Phase 5 API

| Method | Route | Access |
|---|---|---|
| POST | `/api/orders/:id/cod/otp/send`, `/verify` (`{ code }`) | owner |
| GET | `/api/admin/settings` | admin |
| PATCH | `/api/admin/settings/cod` | admin |
| GET | `/api/admin/orders?status=&paymentMethod=&page=` , `/api/admin/orders/:id` | admin |
| PATCH | `/api/admin/cod/:id/confirm` | admin |
| PATCH | `/api/admin/cod/:id/reject` (`{ reason, refundToken? }`) | admin |

`/api/orders` (`paymentMethod: "COD"`), `/api/checkout/summary` (returns a `cod`
block) and `/api/payments/*` now handle COD as well.

## What's in Phase 6

**Order lifecycle (admin).** `PATCH /api/admin/orders/:id/status` moves an order
`CONFIRMED -> PROCESSING -> SHIPPED -> OUT_FOR_DELIVERY -> DELIVERED`. Every
change is validated against the transition table (`utils/orderStatus.js`),
applied as an atomic compare-and-set on the status the server just read (two
admins can't both apply a step), and writes a timeline entry plus an audit-log
row. Shipping requires a courier name and tracking number. Marking a **COD**
order delivered records that the courier collected the balance
(`cod.remainingPaid = true`, `paymentStatus = PAID`).

> **Tracking is manual.** Courier name, tracking number/URL and ETA are typed in
> by an admin; nothing is synced from a courier. The tracking page says so and
> links to the courier's own page. Real shipment creation and status sync arrive
> with the shipping integration in Phase 9.

**Cancellation** (`POST /api/orders/:id/cancel`, rules in `utils/cancellation.js`):

| Order state | Customer can cancel? | Refund |
|---|---|---|
| Pending payment / payment failed | yes | none (nothing was paid) |
| COD awaiting confirmation | yes | by the order's COD policy |
| Confirmed | yes by default (admin can switch off) | full (online) / token (COD) |
| Processing | no by default (admin can switch on) | same |
| Shipped, out for delivery | no | - |
| Delivered | no - return it instead (Phase 7) | - |

For COD the token policy snapshotted on the order decides: refundable -> token
refunded; non-refundable -> kept; configurable -> the order is flagged
`needsRefundDecision` and an admin refunds or keeps it. Cancelling puts stock
back (with inventory-log rows) and releases the coupon **in one transaction with
the status change**; the Razorpay refund follows. If a refund call fails the
payment is flagged `needsManualRefund` and the admin order screen offers
"Refund now". Admins can also cancel (refund on by default) and issue partial or
full manual refunds (`POST /api/admin/orders/:id/refund`, capped at what's left
on the payment).

**Server-driven buttons.** `GET /api/orders/:id` returns `actions`
(`canPay`, `canCancel`, `cancelRefund`, `canTrack`, ...). The order page shows a
button only when the server says the action is allowed.

**Tracking page** (`/account/orders/:id/track`): animated step tracker built from
the order's real status history (a step is ticked only if the order entered that
status), courier / tracking number / link / ETA, cancelled banner.

**Inventory.** Stock is decremented at payment confirmation and restored on
cancellation/rejection (both write `InventoryLog`). New admin endpoints:
`GET /api/admin/inventory?threshold=5` (low stock, per variant),
`GET /api/admin/inventory/logs`, and `POST /api/admin/inventory/adjust` (atomic,
transactional, can't go below zero, always logged). The admin *screens* for
inventory arrive with the dashboard in Phase 8.

**Also:** admin Orders page (`/admin/orders`) with filters, per-order actions and
the cancellation-rule toggles; storefront "in stock" filter and the product card
now treat a product with variants as in stock when any variant is.

**Tests:** 39 unit tests (`npm test` in `server/`), including the full
cancellation rule matrix.

### Manual test checklist

1. Place and pay an online order -> `/admin/orders` -> Processing -> Ship (enter
   a courier + tracking number) -> Out for delivery -> Delivered. Watch
   `/account/orders/:id/track` update after each step, and try skipping a step
   through the API (`409 INVALID_STATUS_TRANSITION`).
2. Cancel a confirmed order as the customer and check: refund appears in
   Razorpay, stock is back (admin `GET /api/admin/inventory/logs`), coupon usage
   is released.
3. Turn "Allow cancelling confirmed orders" off and confirm the button disappears.
4. COD: set the policy to "configurable", cancel as the customer, then use
   Refund token / Keep token in the admin panel.
5. Deliver a COD order and confirm the balance is recorded as collected.

### Phase 6 API

| Method | Route | Access |
|---|---|---|
| POST | `/api/orders/:id/cancel` (`{ reason? }`) | owner |
| PATCH | `/api/admin/orders/:id/status` | admin |
| POST | `/api/admin/orders/:id/cancel` (`{ reason, refund? }`) | admin |
| POST | `/api/admin/orders/:id/refund` (`{ paymentId, amount, reason }`) | admin |
| POST | `/api/admin/orders/:id/keep-token` | admin |
| PATCH | `/api/admin/settings/orders` | admin |
| GET | `/api/admin/inventory`, `/api/admin/inventory/logs` | admin |
| POST | `/api/admin/inventory/adjust` | admin |

## What's in Phase 7

### Returns and refunds

Customers can request a return from a **delivered** order within the return
window (default 7 days, admin-configurable, can be switched off). One return
request per order. The form takes the items and quantities, a reason (damaged,
defective, wrong product, size issue, not as expected, other), a description and
up to 4 photos (uploaded to Cloudinary).

The refund is **computed by the server** (`utils/returnRefund.js`), never sent by
the browser: returned item value, minus a proportional share of any order
coupon, plus shipping only when the *whole* order goes back for a store-fault
reason (damaged / defective / wrong product). The form shows the server's
estimate before you submit.

Flow (order and return statuses move together, in one transaction, each as an
atomic compare-and-set):
`DELIVERED -> RETURN_REQUESTED -> RETURN_APPROVED -> RETURN_PICKED_UP -> RETURNED -> REFUND_INITIATED -> REFUNDED`
(or `RETURN_REJECTED`, which needs a reason and is final). **Clicking "Return"
never refunds anything.** The refund starts only when an admin presses "Start
refund" after the goods are back; marking them received can also put the items
back into stock (with inventory-log rows).

Where the money goes (`services/returnService.js`):

- **Online orders:** the whole refund goes back through the Razorpay refund API.
- **COD orders:** the online token is refunded through Razorpay first; anything
  beyond it was paid in cash to the courier, so it **cannot** go through
  Razorpay. The admin page shows it as "Pay the customer directly", and the admin
  records the UPI / bank-transfer reference. The customer sees both parts.
- The return becomes `REFUNDED` only when every part has really completed:
  Razorpay confirms via the `refund.processed` webhook, and the manual part is
  marked paid. A failed Razorpay refund reopens the step so it can be retried
  (an atomic claim prevents refunding twice).

### Reviews

Only **verified purchasers** can review: the backend requires an order that
contains the product and was actually *delivered* to that user. One review per
buyer per product; rating 1-5, optional comment and up to 3 photos. Public list
with average, star distribution, pagination and "Verified purchase" badges
(names shown as "First L."). The product's `ratings` / `reviewCount` are
recomputed from published reviews whenever a review is added, removed, hidden or
published. (Seeded demo products carry made-up ratings until their first real
review.) Admins can hide/publish or delete reviews at `/admin/reviews`.

### Invoices

`GET /api/orders/:id/invoice` streams a PDF (customers: own orders; admins:
`/api/admin/orders/:id/invoice`). Available once an order has been confirmed and
not cancelled (so COD orders get one after store confirmation). Contents: store
details, invoice/order numbers and dates, billing/shipping address, items with
SKU, quantity, price, discount, shipping, total, and payment method/status
(including the COD token/balance split).

- **Numbering:** sequential per Indian financial year (`INV/2026-27/000001`),
  from an atomic counter, assigned once on first generation. If two requests race
  for an order's very first invoice, one number is skipped (a gap, never a
  duplicate). If you need gap-free numbering for compliance, ask your accountant
  how to assign numbers at confirmation time.
- **Amounts print as "Rs."** because the standard PDF fonts can't draw the rupee
  sign; embed a TTF font in `services/invoice/invoicePdf.js` if you want the symbol.
- **Tax (`GST_RATE_PERCENT`)** is off (0) by default. If you set it, prices are
  treated as **tax-inclusive** and the invoice shows taxable value plus CGST+SGST
  (buyer in `STORE_STATE`) or IGST, using a single rate for the whole invoice.
  There are no per-product rates or HSN codes, and this is not tax advice: check
  it against your registration and product mix with an accountant before using it
  as a tax invoice. Set `STORE_NAME`, `STORE_ADDRESS`, `STORE_STATE`, `STORE_GSTIN`
  in `server/.env`.

### Tests and manual checklist

58 unit tests (`npm test` in `server/`) now cover return refund maths (coupon
sharing, shipping rule, split between Razorpay and manual), return eligibility,
invoice numbering / GST / availability, and the new models. The database- and
Razorpay-dependent paths need a real MongoDB Atlas + Razorpay test account:

1. Deliver an order (admin), then request a return with a photo. Check the
   estimate, then approve -> picked up -> received (tick restock) -> Start refund.
   Watch Razorpay's refund and the `refund.processed` webhook move it to REFUNDED.
2. Repeat with a COD order and a return larger than the token: the page should
   show a Razorpay part and a "pay directly" part; mark it paid with a reference.
3. Try a second return on the same order, a return after the window, and a
   rejection without a reason - all should be refused.
4. Review a product you received; try reviewing one you didn't (403), and twice (409).
5. Download an invoice as customer and as admin; compare the numbers.

### Phase 7 API

| Method | Route | Access |
|---|---|---|
| POST | `/api/returns/preview`, `/api/returns` (multipart) | user |
| GET | `/api/returns`, `/api/returns/:id` | owner |
| GET | `/api/admin/returns`, `/api/admin/returns/:id` | admin |
| PATCH | `/api/admin/returns/:id` (`{ status, note?, restock? }`) | admin |
| POST | `/api/admin/returns/:id/retry-refund`, `/manual-refund` | admin |
| PATCH | `/api/admin/settings/returns` | admin |
| GET | `/api/products/:id/reviews` (id or slug) | public |
| GET | `/api/reviews/can-review/:productId` | user |
| POST / DELETE | `/api/reviews`, `/api/reviews/:id` | user |
| GET / PATCH / DELETE | `/api/admin/reviews[/:id]` | admin |
| GET | `/api/orders/:id/invoice`, `/api/admin/orders/:id/invoice` | owner / admin |

## What's in Phase 8

**A completely separate admin shell** (`layouts/AdminLayout.jsx`): fixed sidebar
on desktop, a slide-over drawer on phone/tablet, its own topbar with a "View
store" link and the theme toggle. Every `/admin/*` route is gated by
`requireAdmin` (frontend) and `requireAuth + requireAdmin` (every backend route
below) - the same rule as every earlier phase, just with a full set of screens
now.

**Dashboard** (`/admin`, `GET /api/admin/dashboard`): total/today's revenue (net
of return refunds), order counts by state, open return requests, customers,
products, low-stock count, plus recent orders and a low-stock preview.
"Revenue" and "orders" only ever count orders that reached `CONFIRMED` -
abandoned or unpaid checkouts are never included; the page says so.

**Analytics** (`/admin/analytics`, `GET /api/admin/analytics?days=7|30|90`):
revenue and orders over time, top 5 products, category performance, and
payment-method split, as Recharts charts themed to match the storefront (incl.
dark mode). Grouped by **IST calendar day** regardless of server timezone
(`utils/dates.js`). All from MongoDB aggregations - nothing is computed by
re-fetching every order into the browser.

**Products & Categories** (`/admin/products`, `/admin/categories`): full CRUD UI
on top of the Phase 2 API - create/edit with variants, specifications and
Cloudinary image upload/removal, delete with confirmation. A category can't be
deleted while products still reference it (`409 CATEGORY_IN_USE`).

**Users** (`/admin/users`, `GET/PATCH /api/admin/users*`): search, filter by
role, see each customer's confirmed order count and lifetime spend, and
activate/deactivate accounts. Deactivated users are refused at `requireAuth` on
their very next request. Admin accounts can't be deactivated from here, and
**no endpoint anywhere grants the admin role** - that stays a server-side script
(`npm run make-admin`), by design.

**Coupons** (`/admin/coupons`): CRUD UI on the Phase 3 coupon API.

**Inventory** (`/admin/inventory`): low-stock table (adjustable threshold, admin
can nudge stock up/down with a required reason - the Phase 6 atomic,
never-negative, always-logged endpoint) and the full inventory activity log.

**Payments** (`/admin/payments`, `GET /api/admin/payments`): every Razorpay
payment/COD token with status, purpose and a "needs manual refund" flag, so a
refund that failed automatically (Phases 6/7) is always findable from one place.

**Settings** (`/admin/settings`): one screen for COD basics (the full COD policy
control stays on the COD page), shipping (`SiteSettings.shipping`, overriding
the `.env` defaults from Phase 4 per-field, blank = fall back to `.env`),
order-cancellation rules (Phase 6) and the return window (Phase 7). Store
name/address/GSTIN for invoices stay in `.env` (they need a server restart, so
editing them live isn't offered).

**Tests:** 63 unit tests (`npm test` in `server/`), adding IST day-boundary math
and search-input regex escaping. The dashboard/analytics aggregations,
product/category/user CRUD and inventory adjustment need a real MongoDB - see
the checklist below.

### Manual test checklist

1. `npm run seed`, sign in, `npm run make-admin -- <email>`, open `/admin`.
2. Products: create one with two variants and three images, edit it, remove an
   image, delete it. Try deleting a category that still has products (blocked).
3. Place a few orders through checkout so Dashboard/Analytics have real numbers;
   confirm "today's revenue" only counts orders that reached CONFIRMED today.
4. Users: deactivate a test account, confirm its next API call is refused, then
   reactivate it.
5. Inventory: adjust a product's stock by -3 with a reason, confirm the log row
   and that the number can't be pushed below zero.
6. Settings: change the free-shipping threshold and confirm checkout picks it up
   immediately; toggle the return window and confirm it's enforced.

### Phase 8 API

| Method | Route | Access |
|---|---|---|
| GET | `/api/admin/dashboard`, `/api/admin/analytics?days=` | admin |
| GET | `/api/admin/users`, PATCH `/api/admin/users/:id/status` | admin |
| GET | `/api/admin/payments` | admin |
| GET | `/api/products/admin/:id`, `/api/categories/admin/all` | admin |
| PATCH | `/api/admin/settings/shipping` | admin |

## What's in Phase 9

### Email notifications

Real templates (`services/email/templates.js`) sent through Nodemailer
(`services/email/emailService.js`) for every event the spec asks for: welcome,
payment successful (this doubles as the order confirmation - there is deliberately no email at checkout, so people who never pay aren't told "order placed"), COD pending/confirmed/rejected, shipped, out
for delivery, delivered, cancelled, return requested, return approved/rejected,
refund initiated, refund completed. Every send is **best-effort and
non-blocking** - wrapped so a failed or unconfigured email service can never
break checkout, COD confirmation, shipping updates, cancellation or returns
(the same pattern already used for admin-action logging).

- **Real vs mock:** `EMAIL_PROVIDER=console` (the default when `EMAIL_HOST` is
  blank) is a **development-only** adapter that prints the email in the server
  terminal instead of sending it, and refuses to run when `NODE_ENV=production`.
  Set `EMAIL_PROVIDER=smtp` plus `EMAIL_HOST/PORT/USER/PASSWORD` to send real
  email through any SMTP provider (a Gmail app password, SendGrid, Mailgun, SES
  all work the same way - it's plain SMTP).
- Templates are inline-styled HTML tables (most email clients strip
  `<style>` blocks) with a shared header/footer using your store name/address
  from Phase 7's settings.

### Shipping: real courier integration

`services/shipping/providers/shiprocket.js` adds a second, **production**
provider alongside Phase 4's PIN-directory-only `pincode-lookup`, behind the
exact same interface:

- **Serviceability** (`checkServiceability`): the PIN-directory check still
  runs first (a real PIN, real state); when Shiprocket credentials are present
  it layers Shiprocket's own courier-serviceability check on top (pickup ->
  delivery pincode, COD-awareness) - closer to "can a courier actually deliver
  this," not just "is this a real address."
- **Shipment creation** (`createShipment`): on the admin Orders page, "Ship"
  now offers **Book via courier API** (creates a real Shiprocket order and
  requests an AWB, filling in courier/tracking number/URL for you) alongside
  **Enter manually** (the Phase 6 flow, still the always-available
  development-only fallback - no courier account needed).
- **Live tracking sync** (`POST /api/shipping/webhook`): a shared-secret token
  header (`SHIPROCKET_WEBHOOK_TOKEN`), checked with a timing-safe comparison,
  authenticates Shiprocket's status callbacks and advances the order
  `SHIPPED -> OUT_FOR_DELIVERY -> DELIVERED` automatically. Unknown or
  out-of-order statuses are ignored rather than force-applied.

**Nothing here is required.** Leave `SHIPPING_PROVIDER=pincode-lookup` (the
Phase 4 default) and ship orders by typing in tracking details - exactly as in
Phase 6. Only set `SHIPPING_PROVIDER=shiprocket` and the `SHIPROCKET_*`
variables if you have a real Shiprocket account and want automatic booking and
tracking.

### Tests and manual checklist

74 unit tests (`npm test` in `server/`): every email template (subject + that
the right order/return details appear), and the courier status-mapping table
(forward-only, ignores unknown/duplicate/out-of-order updates). Actually
sending email and calling Shiprocket's live API need real credentials and
weren't exercised here:

1. Leave `EMAIL_PROVIDER` unset, place an order, and watch the emails print in
   the server terminal at each step (placed, paid, shipped, delivered, ...).
2. Set `EMAIL_PROVIDER=smtp` with a real SMTP account and confirm delivery.
3. With Shiprocket test/sandbox credentials: check serviceability for a route,
   ship an order via **Book via courier API**, confirm the AWB and tracking URL
   appear on the customer's tracking page, then point Shiprocket's webhook at
   `/api/shipping/webhook` with your `SHIPROCKET_WEBHOOK_TOKEN` and confirm a
   status callback advances the order automatically.

### Phase 9 API

| Method | Route | Access |
|---|---|---|
| POST | `/api/shipping/webhook` | Shiprocket (shared-secret token header) |

`PATCH /api/admin/orders/:id/status` (Phase 6) now accepts `useCourierApi: true`
for the `SHIPPED` transition to book a real shipment instead of manual entry.

## What's in Phase 10

### Expanded testing

- **`app.js` / `server.js` split**: the Express app is now built in `app.js`
  with no database connection or open port; `server.js` is a two-line
  bootstrap (`connectDB()` then `app.listen()`). This is what makes the next
  point possible, and is also generally good practice (a serverless wrapper or
  a test harness can import `app.js` directly).
- **`tests/app.test.js`** (new): runs the *real* Express app end-to-end with
  **no MongoDB connection at all** — `/api/health`, a 404's shape, and,
  importantly, that every protected and admin route rejects a request with no
  `Authorization` header, a malformed one, or a garbage Firebase token, with a
  clean `401` rather than a crash — *before* any database code runs. This is
  exactly the "missing token / invalid token / customer hitting an admin
  route" testing the original spec asked for, made possible without standing
  up a real database in this environment.
- **85 unit tests** (`npm test` in `server/`) covering
  every pure business rule built across all ten phases: Razorpay signatures,
  the order status machine, COD token math, OTP, cancellation, return refund
  splitting, invoice numbering/GST, IST date boundaries, email templates, and
  the courier status-mapping table, plus the new app-level security checks.
- **What's still not covered here**: anything that needs a live MongoDB
  connection (transactions, concurrent-update races, the full checkout →
  payment → confirmation path) or live third-party calls (Razorpay, Firebase
  token verification against Google, Cloudinary, Shiprocket, SMTP). Every
  phase's README section above has a manual checklist for exactly these — run
  them against a real MongoDB Atlas cluster and test-mode credentials before
  going live.

### Performance

- **Admin bundle code-split**: the entire `/admin` area (every CRUD screen,
  and Recharts — by far the heaviest dependency in the project) now loads as
  its own lazy-loaded chunk (`React.lazy` + `Suspense` in `App.jsx`), so a
  first-time shopper's bundle no longer includes charting code or admin forms
  they'll never see. Confirmed with `npm run build`: the analytics chunk
  (~387 kB) is now separate from the main bundle.
- Compression (`compression()`), Helmet security headers, and per-route rate
  limiting were already in place since Phase 1/4/5 and remain the same.
- MongoDB indexes were added incrementally as each model was introduced
  (unique indexes on `firebaseUid`/`orderNumber`/`razorpayOrderId`/etc., a
  text index for product search, compound indexes for the common
  category+price and status+date queries) — there's no separate "add indexes"
  pass because each was added at the point it became necessary.
- Further frontend splitting (e.g. lazy-loading `Checkout`) is a reasonable
  next step but has a much smaller payoff than the admin split above, since
  the storefront pages are what every visitor needs regardless.

### Deployment

Full walkthrough in **`DEPLOYMENT.md`**: MongoDB Atlas (production cluster,
network access, DB user) → Render (backend, every env var, health check) →
Vercel (frontend, env vars, output directory) → CORS/authorized-domain
wiring between them → switching Razorpay to live mode and configuring its
webhook → the optional Shiprocket webhook → a post-deploy checklist.

## Audit and bug-fix pass (final build)

After the ten phases were written, the whole project was audited. The server was
run end-to-end against a real MongoDB-compatible database, and the client was
rendered page by page. Real bugs found and fixed:

| Area | Bug | Fix |
|---|---|---|
| Client | **Blank page on load** - Redux Toolkit throws if `addCase` is called after `addMatcher` (`authSlice`). The production build passes but the dev app never rendered. | Reordered the builder calls. |
| Client | **Infinite remount loop on `/checkout`** - the route guard swapped the page for a spinner whenever the profile was refreshing, and Checkout refreshes the profile when it mounts. | The guard now only shows the spinner while the user is genuinely unknown. Verified with a DOM test (old guard: loops; new guard: mounts once). |
| Server | **First sign-in race** - registering fires two profile requests at once; both tried to create the user and one failed with `409 firebaseUid already in use`. | Creation is now race-safe (loser loads the winner's profile). |
| Admin | **Editing a product regenerated every variant id**, silently breaking carts and orders that referenced them. | The edit form now sends each variant's `_id`. |
| Server | Payment emails were sent **inside** the DB transaction (could repeat on a retry, or fire for a rolled-back payment); refund-completed email could send twice. | Emails now send once, after commit. |
| Server | A review that saved fine returned a 500 if the rating refresh failed. | Rating refresh is best-effort; average now computed with `countDocuments` + `$sum`. |
| Server | Dashboard/analytics dug through the timeline array with heavy aggregation operators. | Orders now store `confirmedAt`; queries are simple and indexable. |
| Server | Server errors (5xx) were **not logged in production**. | Always logged; noisy 4xx logs removed. |
| Server | Blank optional numbers from the admin product form (`""`) were stored as null. | Normalised. |
| Server | Welcome email promised a `WELCOME10` coupon that may not exist; "order placed" email went to people who never paid. | Removed / merged into the payment emails. |
| Server | `mongodb+srv` lookups fail on some networks (`querySrv EBADRESP`). | `config/db.js` uses public DNS in development by default; override with `DNS_SERVERS` (see Troubleshooting). |
| Housekeeping | Deprecated Mongoose `new:` option, rate-limit `max` option, unused code, unstable effect dependency. | Updated. |

### Integration test (new)

`npm run test:integration` in `server/` walks the real API with 44 checks:
sign-up, profile and addresses, cart, wishlist, coupons, checkout totals, order
creation, Razorpay create/verify (bad and good signatures, duplicate callbacks,
late payment on a cancelled order), stock/inventory/coupon effects, shipping
transitions (and refused jumps), invoice PDF, returns and refunds, reviews, COD
confirm/reject, cancellation, admin settings, user deactivation, and the
product/category guards. Firebase, Razorpay and the PIN lookup are stubbed, so
it needs only a database. **It wipes that database** and refuses to run unless
the database name contains `test`:

```bash
cd server
MONGODB_URI="mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/cozatest" npm run test:integration
```

Run it against a **replica set** such as Atlas (real transactions). It was
developed against FerretDB, which has no transactions, no `$elemMatch` with
comparisons, no `$facet`/`$lookup`, and no positional `$` updates; those few
checks are skipped in that mode (`FERRET=1`), so please run it once against Atlas
to cover them: variant stock changes, the in-stock filter, the Razorpay refund
webhook, and the analytics charts.

### What has still never been run

Anything that talks to a real third party: Firebase token verification against
Google, Cloudinary uploads, live Razorpay payments and webhooks, SMTP delivery,
Shiprocket. Use the per-phase checklists above with test-mode credentials.

## Troubleshooting

- **Blank dark page at `localhost:5173`** - open the browser console (F12). If
  it names a Redux Toolkit `addCase`/`addMatcher` error, you have the old
  `authSlice.js` (fixed in this build). Also make sure `client/.env` exists and
  you restarted `npm run dev` after editing it.
- **`MongoDB connection failed: querySrv EBADRESP`** - your network's DNS can't
  resolve Atlas's SRV record. This build already switches to public DNS in
  development. If it still fails, set `DNS_SERVERS=system` or `DNS_SERVERS=8.8.8.8`
  in `server/.env`, or use Atlas's non-SRV `mongodb://` connection string
  (Connect -> Drivers -> choose Node.js "2.2.12 or later").
- **`Firebase: Error (auth/configuration-not-found)`** - Authentication has not
  been enabled for the project. Firebase Console -> Build -> Authentication ->
  Get started, then enable Email/Password and Google under Sign-in method.
- **Signed in but still looks signed out / 401s in the server log** - the
  service-account key in `server/.env` is from a different Firebase project than
  the web config in `client/.env`.
- **Shop is empty** - run `npm run seed` in `server/`.

## Tech stack

**Frontend:** React 19, Vite, Tailwind CSS v4, Redux Toolkit, React Router,
Axios, React Hook Form + Zod, Framer Motion, lucide-react, Recharts, Firebase JS SDK

**Backend:** Node.js, Express 5, Mongoose, Firebase Admin SDK, Razorpay SDK, Nodemailer,
Shiprocket (fetch-based), supertest (tests), Helmet,
express-rate-limit, CORS, dotenv, morgan

## Project structure

```
ecommerce/
├── client/                 # React app (Vite)
│   └── src/
│       ├── firebase/       # Firebase client config + auth helpers
│       ├── store/          # Redux slices (auth, theme)
│       ├── services/       # axios instance + API calls
│       ├── hooks/          # useAuthListener
│       ├── components/     # ProtectedRoute, FormField
│       ├── layouts/        # Header, Footer, MainLayout
│       └── pages/          # home, auth, account, static
│
├── server/                 # Express API
│   ├── config/             # env, db, firebase
│   ├── controllers/        # user, product, category controllers
│   ├── middleware/         # auth, errorHandler, asyncHandler
│   ├── models/             # User, Product, Category
│   ├── routes/             # user/product/category routes + aggregator
│   ├── seed/               # demo data seeder
│   ├── services/           # empty folders reserved for payment/
│   │                         shipping/email/cloudinary/otp (later phases)
│   └── utils/               # ApiError, ApiResponse
│
└── README.md (this file)
```

For a production deployment (MongoDB Atlas + Render + Vercel), see
**`DEPLOYMENT.md`**. Everything below is local development.

## Setup

### 1. MongoDB Atlas

1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Database Access → add a database user (username/password)
3. Network Access → add your current IP (or `0.0.0.0/0` for local dev)
4. Database → Connect → Drivers → copy the connection string
5. Paste it into `server/.env` as `MONGODB_URI`, replacing
   `<username>`, `<password>` and adding your DB name, e.g.
   `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/cozastore`

### 2. Firebase project

1. Create a project at https://console.firebase.google.com
2. **Authentication** → Sign-in method → enable **Email/Password** and
   **Google**
3. **Project settings → General → Your apps** → add a Web app → copy the
   config object into `client/.env` (`VITE_FIREBASE_*` keys)
4. **Project settings → Service accounts** → Generate new private key →
   downloads a JSON file. From it, copy into `server/.env`:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` escapes, wrap
     in quotes)

### 3. Install & run

```bash
# Backend
cd server
cp .env.example .env   # then fill in the values from steps 1-2
npm install
npm run dev             # http://localhost:5001

# Frontend (new terminal)
cd client
cp .env.example .env    # then fill in the Firebase web config
npm install
npm run dev              # http://localhost:5173
```

Vite's dev server proxies `/api/*` to `http://localhost:5001`, so the
two apps talk to each other with no extra CORS config needed locally.

### 4. Try it

1. Open http://localhost:5173, click **Sign in → Create one**
2. Register with email/password (or Google)
3. Go to **My account** → update your profile and add an address
4. To make yourself an admin for later phases: open the `users`
   collection in MongoDB Atlas and manually set your document's
   `role` field to `"admin"` — there is intentionally no API endpoint
   that lets a user do this themselves.

## Roadmap (all phases complete)

| Phase | Scope |
|---|---|
| 1 | ✅ Done — see above |
| 2 | ✅ Done — see above |
| 3 | ✅ Done — see above |
| 4 | ✅ Done — see above |
| 5 | ✅ Done — see above |
| 6 | ✅ Done — see above |
| 7 | ✅ Done — see above |
| 8 | ✅ Done — see above |
| 9 | ✅ Done — see above |
| 10 | ✅ Done — see above |

Each phase will be delivered the same way this one was: a complete,
runnable zip, building directly on top of what's already here.

## Security notes already in place

- Firebase ID tokens are verified server-side on every request
  (`middleware/auth.js`) — a token is never just decoded and trusted
- `role` is only ever read from MongoDB, never accepted from the client
- Passwords are never stored in MongoDB — Firebase owns authentication
- Address validation runs on both frontend (UX) and backend (`models/User.js`,
  authoritative)
- Rate limiting, Helmet security headers, and scoped CORS are active
  from Phase 1 onward
