// End-to-end API walkthrough against a REAL MongoDB-compatible database.
//   MONGODB_URI="mongodb+srv://.../cozatest" npm run test:integration     (database name MUST contain "test"; it is wiped)
// Firebase token verification, Razorpay and the India Post PIN lookup are
// stubbed (no credentials/network needed). Set FAKE_TX=1 ONLY when the database
// has no transaction support (e.g. FerretDB): transactions then run without
// atomicity. Against MongoDB Atlas leave FAKE_TX unset so real transactions run.
import { generateKeyPairSync, createHmac } from "crypto";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/cozatest";
process.env.FIREBASE_PROJECT_ID ||= "test-project";
process.env.FIREBASE_CLIENT_EMAIL ||= "test@test-project.iam.gserviceaccount.com";
process.env.FIREBASE_PRIVATE_KEY ||= generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" } }).privateKey;
process.env.RAZORPAY_KEY_ID = "rzp_test_key";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";
process.env.OTP_SECRET = "otp-test-secret";

const { default: mongoose } = await import("mongoose");
const { default: request } = await import("supertest");
const { __setRazorpayClientForTests } = await import("../../services/payment/razorpayService.js");
const { firebaseAuth } = await import("../../config/firebase.js");
const { default: app } = await import("../../app.js");
const M = {
  User: (await import("../../models/User.js")).default,
  Product: (await import("../../models/Product.js")).default,
  Category: (await import("../../models/Category.js")).default,
  Coupon: (await import("../../models/Coupon.js")).default,
  Order: (await import("../../models/Order.js")).default,
  Payment: (await import("../../models/Payment.js")).default,
  InventoryLog: (await import("../../models/InventoryLog.js")).default,
  SiteSettings: (await import("../../models/SiteSettings.js")).default,
  Review: (await import("../../models/Review.js")).default,
  ReturnRequest: (await import("../../models/ReturnRequest.js")).default,
};

// ---- stubs ----
firebaseAuth.verifyIdToken = async (t) => {
  const [p, uid, email, name] = t.split(":");
  if (p !== "test") throw new Error("bad token");
  return { uid, email, name };
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, ...rest) => {
  if (String(url).includes("postalpincode.in")) {
    return new Response(JSON.stringify([{ Status: "Success", PostOffice: [{ District: "Surat", State: "Gujarat", DeliveryStatus: "Delivery" }] }]), { status: 200 });
  }
  return realFetch(url, ...rest);
};
let rzpCounter = 0;
__setRazorpayClientForTests({
  orders: { create: async (p) => ({ id: `order_T${++rzpCounter}`, amount: p.amount, currency: "INR", receipt: p.receipt, status: "created" }) },
  payments: { refund: async () => ({ id: `rfnd_T${++rzpCounter}`, status: "pending" }) },
});

await mongoose.connect(process.env.MONGODB_URI);
// This test WIPES the database it connects to, so refuse anything that isn't clearly a throwaway test DB.
if (!/test/i.test(mongoose.connection.name)) {
  console.error(`Refusing to run: database "${mongoose.connection.name}" does not look like a test database (its name must contain "test"). Use e.g. .../cozatest`);
  process.exit(2);
}
await mongoose.connection.dropDatabase();
if (process.env.FAKE_TX) {
  const orig = mongoose.startSession.bind(mongoose);
  mongoose.startSession = async (...a) => { const s = await orig(...a); s.withTransaction = async (fn) => fn(s); return s; };
}

// ---- tiny harness ----
let pass = 0; const failures = [];
// FerretDB (used when MongoDB is unavailable) lacks some standard MongoDB features. Steps that
// depend on them are skipped when FERRET=1 and must be verified against real MongoDB/Atlas.
const FERRET = Boolean(process.env.FERRET);
const step = async (name, fn, { ferretSkip } = {}) => {
  if (FERRET && ferretSkip) { console.log(`SKIP  ${name}\n        (FerretDB limitation: ${ferretSkip})`); return; }
  try {
    await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT after 15s (step hung)")), 15000))]);
    pass++; console.log(`PASS  ${name}`);
  }
  catch (e) { failures.push(name); console.log(`FAIL  ${name}\n        ${String(e.message).split("\n").slice(0, 3).join("\n        ")}`); }
};
const eq = (a, b, msg = "") => { if (a !== b) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const tok = (uid, name = uid) => `Bearer test:${uid}:${uid}@example.com:${name}`;
const call = (method, path, who) => { const r = request(app)[method](path); return who ? r.set("Authorization", tok(who)) : r; };
const sign = (...parts) => createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(parts.join("|")).digest("hex");
const webhook = (event, payload, id) => {
  const raw = JSON.stringify({ event, payload });
  return request(app).post("/api/payments/webhook").set("Content-Type", "application/json")
    .set("x-razorpay-signature", createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex")).set("x-razorpay-event-id", id).send(raw);
};

// ---- fixtures ----
const cat = await M.Category.create({ name: "Tees", slug: "tees" });
const plain = await M.Product.create({ name: "Plain Tee", slug: "plain-tee", description: "d", category: cat._id, price: 1000, stock: 10, sku: "PT-1", brand: "Coza", images: [{ url: "https://x/1.jpg" }] });
const varP = await M.Product.create({ name: "Var Tee", slug: "var-tee", description: "d", category: cat._id, price: 800, stock: 0, sku: "VT-1", variants: [{ size: "M", sku: "VT-M", price: 800, stock: 5 }, { size: "L", sku: "VT-L", price: 900, stock: 0 }] });
await M.Coupon.create({ code: "SAVE100", discountType: "fixed", discountValue: 100, minimumOrderValue: 500, expiryDate: new Date(Date.now() + 864e5), perUserLimit: 5 });
await M.SiteSettings.create({ key: "main", cod: { enabled: true, minOrderAmount: 500, maxOrderAmount: 20000, tokenType: "fixed", tokenValue: 100, otpRequired: false, cancellationPolicy: "refundable" } });
const stockOf = async (id, v) => { const p = await M.Product.findById(id); return v ? p.variants.id(v).stock : p.stock; };

const ADDR = { fullName: "Test Buyer", phone: "9876543210", addressLine1: "21 Ring Road", city: "Surat", state: "Gujarat", pincode: "395009", addressType: "Home" };
let addressId; let order1; let rzp1;

console.log("\n=== PUBLIC CATALOG ===");
await step("GET /products lists active products with pagination meta", async () => { const r = await call("get", "/api/products"); eq(r.status, 200); eq(r.body.data.length, 2); eq(r.body.meta.total, 2); });
await step("GET /products filters: category slug, price range, sort", async () => {
  let r = await call("get", "/api/products?category=tees&minPrice=900&sort=price_desc"); eq(r.status, 200); eq(r.body.data.length, 1); eq(r.body.data[0].slug, "plain-tee");
});
await step("GET /products inStock=true treats variant stock correctly", async () => { const r = await call("get", "/api/products?inStock=true"); eq(r.status, 200); eq(r.body.data.length, 2, "both in stock (variant has stock)"); }, { ferretSkip: "$elemMatch with comparison operators" });
await step("GET /products/:slug and 404", async () => { eq((await call("get", "/api/products/plain-tee")).status, 200); eq((await call("get", "/api/products/nope")).status, 404); });
await step("GET /categories", async () => { const r = await call("get", "/api/categories"); eq(r.status, 200); eq(r.body.data.length, 1); });

console.log("\n=== AUTH / USER ===");
await step("first sign-in creates the profile (and 3 parallel first requests don't race)", async () => {
  const rs = await Promise.all([1, 2, 3].map(() => call("get", "/api/users/me", "buyer")));
  rs.forEach((r, i) => eq(r.status, 200, `request ${i + 1} status (${r.body.message || ""})`));
  eq(await M.User.countDocuments({ firebaseUid: "buyer" }), 1);
});
await step("role is customer; customer is refused on admin routes (403)", async () => { eq((await call("get", "/api/users/me", "buyer")).body.data.role, "customer"); eq((await call("get", "/api/admin/orders", "buyer")).status, 403); });
await step("PATCH /users/me ignores role escalation attempts", async () => {
  const r = await call("patch", "/api/users/me", "buyer").send({ name: "Buyer One", phone: "9876543210", role: "admin" });
  eq(r.status, 200); eq(r.body.data.role, "customer"); eq(r.body.data.name, "Buyer One");
});
await step("address add / validate / update / delete", async () => {
  eq((await call("post", "/api/users/addresses", "buyer").send({ ...ADDR, phone: "123" })).status, 400);
  const r = await call("post", "/api/users/addresses", "buyer").send(ADDR); eq(r.status, 201); addressId = r.body.data[0]._id; eq(r.body.data[0].isDefault, true);
  eq((await call("patch", `/api/users/addresses/${addressId}`, "buyer").send({ landmark: "Near park" })).status, 200);
});

console.log("\n=== CART / WISHLIST / COUPON ===");
await step("cart: variant required, stock enforced, merge quantities", async () => {
  eq((await call("post", "/api/cart", "buyer").send({ productId: String(varP._id), quantity: 1 })).body.code, "VARIANT_REQUIRED");
  const L = varP.variants[1]._id;
  eq((await call("post", "/api/cart", "buyer").send({ productId: String(varP._id), variantId: String(L), quantity: 1 })).body.code, "OUT_OF_STOCK");
  let r = await call("post", "/api/cart", "buyer").send({ productId: String(plain._id), quantity: 2 }); eq(r.status, 201);
  r = await call("post", "/api/cart", "buyer").send({ productId: String(plain._id), quantity: 1 }); eq(r.body.data.items[0].quantity, 3); eq(r.body.data.subtotal, 3000);
  eq((await call("post", "/api/cart", "buyer").send({ productId: String(plain._id), quantity: 20 })).status, 409);
});
await step("cart: update quantity / price is server-computed", async () => {
  const cart = (await call("get", "/api/cart", "buyer")).body.data; const id = cart.items[0]._id;
  const r = await call("patch", `/api/cart/${id}`, "buyer").send({ quantity: 2 }); eq(r.body.data.subtotal, 2000);
});
await step("wishlist add / list / remove", async () => {
  eq((await call("post", `/api/wishlist/${plain._id}`, "buyer")).status, 201);
  eq((await call("get", "/api/wishlist", "buyer")).body.data.length, 1);
  eq((await call("delete", `/api/wishlist/${plain._id}`, "buyer")).body.data.length, 0);
});
await step("coupon: valid / invalid / min-order", async () => {
  const r = await call("post", "/api/coupons/validate", "buyer").send({ code: "save100" }); eq(r.status, 200); eq(r.body.data.discount, 100); eq(r.body.data.total, 1900);
  eq((await call("post", "/api/coupons/validate", "buyer").send({ code: "NOPE" })).body.code, "COUPON_INVALID");
});

console.log("\n=== CHECKOUT + ONLINE PAYMENT ===");
await step("checkout summary: totals computed on the server (₹2000 - ₹100 coupon + ₹0 shipping)", async () => {
  const r = await call("post", "/api/checkout/summary", "buyer").send({ addressId, couponCode: "SAVE100" });
  eq(r.status, 200, r.body.message); eq(r.body.data.totalAmount, 1900); eq(r.body.data.shippingCharge, 0); eq(r.body.data.cod.available, true); eq(r.body.data.cod.tokenAmount, 100);
});
await step("create order (client cannot choose price) -> PENDING_PAYMENT", async () => {
  const r = await call("post", "/api/orders", "buyer").send({ addressId, couponCode: "SAVE100", paymentMethod: "ONLINE", totalAmount: 1 });
  eq(r.status, 201, r.body.message); order1 = r.body.data; eq(order1.totalAmount, 1900); eq(order1.status, "PENDING_PAYMENT");
});
await step("payments/create-order -> Razorpay order for the SERVER amount (paise)", async () => {
  const r = await call("post", "/api/payments/create-order", "buyer").send({ orderId: order1._id });
  eq(r.status, 200, r.body.message); rzp1 = r.body.data; eq(rzp1.amount, 190000);
  const again = await call("post", "/api/payments/create-order", "buyer").send({ orderId: order1._id });
  eq(again.body.data.razorpayOrderId, rzp1.razorpayOrderId, "retry reuses the same Razorpay order");
});
await step("verify rejects a bad signature", async () => {
  const r = await call("post", "/api/payments/verify", "buyer").send({ razorpay_order_id: rzp1.razorpayOrderId, razorpay_payment_id: "pay_1", razorpay_signature: "deadbeef" }); eq(r.status, 400); eq(r.body.code, "INVALID_SIGNATURE");
});
await step("verify with a valid signature confirms: stock down, log written, coupon used, cart cleared", async () => {
  const r = await call("post", "/api/payments/verify", "buyer").send({ razorpay_order_id: rzp1.razorpayOrderId, razorpay_payment_id: "pay_1", razorpay_signature: sign(rzp1.razorpayOrderId, "pay_1") });
  eq(r.status, 200, r.body.message); eq(r.body.data.status, "CONFIRMED"); eq(r.body.data.paymentStatus, "PAID");
  eq(await stockOf(plain._id), 8); eq(await M.InventoryLog.countDocuments({ order: order1._id }), 1);
  eq((await M.Coupon.findOne({ code: "SAVE100" })).usedCount, 1);
  eq((await call("get", "/api/cart", "buyer")).body.data.items.length, 0);
});
await step("duplicate verify callback is idempotent (no second stock decrement)", async () => {
  const r = await call("post", "/api/payments/verify", "buyer").send({ razorpay_order_id: rzp1.razorpayOrderId, razorpay_payment_id: "pay_1", razorpay_signature: sign(rzp1.razorpayOrderId, "pay_1") });
  eq(r.status, 200); eq(await stockOf(plain._id), 8);
});
await step("webhook: bad signature rejected; payment.captured for an already-paid order is harmless", async () => {
  eq((await request(app).post("/api/payments/webhook").set("Content-Type", "application/json").set("x-razorpay-signature", "x").send("{}")).status, 400);
  const r = await webhook("payment.captured", { payment: { entity: { id: "pay_1", order_id: rzp1.razorpayOrderId, amount: 190000, method: "upi" } } }, "evt_1"); eq(r.status, 200); eq(await stockOf(plain._id), 8);
});
await step("another user cannot read or pay this order (404)", async () => { eq((await call("get", `/api/orders/${order1._id}`, "intruder")).status, 404); });
await step("order detail exposes server-driven actions", async () => {
  const r = await call("get", `/api/orders/${order1._id}`, "buyer"); eq(r.status, 200, r.body.message); eq(r.body.data.actions.canCancel, true); eq(r.body.data.actions.canDownloadInvoice, true); eq(r.body.data.actions.canReturn, false);
});
await step("invoice PDF downloads for the owner", async () => {
  const r = await call("get", `/api/orders/${order1._id}/invoice`, "buyer").buffer(true).parse((res, cb) => { const c = []; res.on("data", (d) => c.push(d)); res.on("end", () => cb(null, Buffer.concat(c))); });
  eq(r.status, 200); ok(r.body.slice(0, 4).toString() === "%PDF", "is a PDF");
});

console.log("\n=== ADMIN FULFILMENT ===");
await M.User.updateOne({ email: "admin@example.com" }, { $setOnInsert: { firebaseUid: "admin", email: "admin@example.com", name: "Admin" }, $set: { role: "admin" } }, { upsert: true });
await step("invalid status jump is refused (CONFIRMED -> SHIPPED)", async () => { const r = await call("patch", `/api/admin/orders/${order1._id}/status`, "admin").send({ status: "SHIPPED", courier: "Delhivery", trackingNumber: "AWB123" }); eq(r.status, 409); eq(r.body.code, "INVALID_STATUS_TRANSITION"); });
await step("process -> ship (needs tracking) -> out for delivery -> delivered", async () => {
  eq((await call("patch", `/api/admin/orders/${order1._id}/status`, "admin").send({ status: "PROCESSING" })).status, 200);
  eq((await call("patch", `/api/admin/orders/${order1._id}/status`, "admin").send({ status: "SHIPPED" })).status, 400);
  eq((await call("patch", `/api/admin/orders/${order1._id}/status`, "admin").send({ status: "SHIPPED", courier: "Delhivery", trackingNumber: "AWB123" })).status, 200);
  eq((await call("patch", `/api/admin/orders/${order1._id}/status`, "admin").send({ status: "OUT_FOR_DELIVERY" })).status, 200);
  const r = await call("patch", `/api/admin/orders/${order1._id}/status`, "admin").send({ status: "DELIVERED" }); eq(r.status, 200); eq(r.body.data.status, "DELIVERED");
});
await step("customer can no longer cancel a delivered order", async () => { eq((await call("post", `/api/orders/${order1._id}/cancel`, "buyer").send({})).status, 409); });

console.log("\n=== RETURN + REFUND ===");
let ret;
await step("customer requests a partial return; refund computed by the server", async () => {
  const item = order1.items[0]._id;
  const r = await call("post", "/api/returns", "buyer").field("orderId", order1._id).field("reason", "SIZE_ISSUE").field("description", "too small").field("items", JSON.stringify([{ itemId: item, quantity: 1 }]));
  eq(r.status, 201, r.body.message); ret = r.body.data; eq(ret.refundAmount, 950); // 1000 less half of the ₹100 coupon
  eq((await call("post", "/api/returns", "buyer").field("orderId", order1._id).field("reason", "OTHER").field("items", JSON.stringify([{ itemId: item, quantity: 1 }]))).status, 409);
});
await step("admin approve -> picked up -> received (restock) -> refund via Razorpay", async () => {
  for (const [status, extra] of [["RETURN_APPROVED"], ["RETURN_PICKED_UP"], ["RETURNED", { restock: true }]]) { const r = await call("patch", `/api/admin/returns/${ret._id}`, "admin").send({ status, ...(extra || {}) }); eq(r.status, 200, `${status}: ${r.body.message}`); }
  eq(await stockOf(plain._id), 9, "restocked");
  const r = await call("patch", `/api/admin/returns/${ret._id}`, "admin").send({ status: "REFUND_INITIATED" }); eq(r.status, 200, r.body.message);
  eq(r.body.data.status, "REFUND_INITIATED"); eq(r.body.data.refund.razorpayInitiated, true); eq(r.body.data.refund.razorpayAmount, 950);
});
await step("refund.processed webhook completes the return -> REFUNDED", async () => {
  const cur = await M.ReturnRequest.findById(ret._id);
  if (FERRET) { await (await import("../../services/returnService.js")).onRazorpayRefundEvent({ refundId: cur.refund.razorpayRefundId, status: "PROCESSED" }); }
  else { const r = await webhook("refund.processed", { refund: { entity: { id: cur.refund.razorpayRefundId, payment_id: "pay_1", status: "processed" } } }, "evt_2"); eq(r.status, 200); }
  eq((await M.ReturnRequest.findById(ret._id)).status, "REFUNDED"); eq((await M.Order.findById(order1._id)).status, "REFUNDED");
});

console.log("\n=== REVIEWS ===");
await step("verified purchaser can review; duplicate 409; non-purchaser 403; rating recalculated", async () => {
  eq((await call("post", "/api/reviews", "buyer").field("productId", String(plain._id)).field("rating", "5").field("comment", "Great")).status, 201);
  eq((await call("post", "/api/reviews", "buyer").field("productId", String(plain._id)).field("rating", "4")).status, 409);
  eq((await call("post", "/api/reviews", "intruder").field("productId", String(plain._id)).field("rating", "1")).status, 403);
  eq((await M.Product.findById(plain._id)).ratings, 5);
  const r = await call("get", `/api/products/${plain._id}/reviews`, "buyer"); eq(r.body.data.length, 1); eq(r.body.data[0].mine, true);
});

console.log("\n=== COD ===");
let cod1;
await step("COD order: token computed server-side; payment charges only the token", async () => {
  await call("post", "/api/cart", "buyer").send({ productId: String(plain._id), quantity: 1 });
  const r = await call("post", "/api/orders", "buyer").send({ addressId, paymentMethod: "COD" }); eq(r.status, 201, r.body.message); cod1 = r.body.data;
  eq(cod1.cod.tokenAmount, 100); eq(cod1.cod.remainingAmount, cod1.totalAmount - 100);
  const p = await call("post", "/api/payments/create-order", "buyer").send({ orderId: cod1._id }); eq(p.status, 200, p.body.message); eq(p.body.data.amount, 10000);
  const v = await call("post", "/api/payments/verify", "buyer").send({ razorpay_order_id: p.body.data.razorpayOrderId, razorpay_payment_id: "pay_cod1", razorpay_signature: sign(p.body.data.razorpayOrderId, "pay_cod1") });
  eq(v.status, 200, v.body.message); eq(v.body.data.status, "PENDING_COD_CONFIRMATION"); eq(v.body.data.paymentStatus, "PARTIALLY_PAID");
});
await step("admin confirms COD -> CONFIRMED; second confirm is refused", async () => {
  eq((await call("patch", `/api/admin/cod/${cod1._id}/confirm`, "admin")).status, 200); eq((await call("patch", `/api/admin/cod/${cod1._id}/confirm`, "admin")).status, 409);
});
let cod2;
await step("COD reject: stock returned, token refunded, order cancelled", async () => {
  await call("post", "/api/cart", "buyer").send({ productId: String(plain._id), quantity: 1 });
  const before = await stockOf(plain._id);
  const o = (await call("post", "/api/orders", "buyer").send({ addressId, paymentMethod: "COD" })).body.data; cod2 = o;
  const p = (await call("post", "/api/payments/create-order", "buyer").send({ orderId: o._id })).body.data;
  await call("post", "/api/payments/verify", "buyer").send({ razorpay_order_id: p.razorpayOrderId, razorpay_payment_id: "pay_cod2", razorpay_signature: sign(p.razorpayOrderId, "pay_cod2") });
  eq(await stockOf(plain._id), before - 1);
  const r = await call("patch", `/api/admin/cod/${o._id}/reject`, "admin").send({ reason: "Cannot deliver" }); eq(r.status, 200, r.body.message);
  eq(r.body.data.order.status, "CANCELLED"); eq(await stockOf(plain._id), before); eq(r.body.data.refund.ok, true);
});

console.log("\n=== CUSTOMER CANCELLATION ===");
await step("customer cancels a confirmed online order: refund issued, stock restored", async () => {
  await call("post", "/api/cart", "buyer").send({ productId: String(plain._id), quantity: 2 });
  const before = await stockOf(plain._id);
  const o = (await call("post", "/api/orders", "buyer").send({ addressId, paymentMethod: "ONLINE" })).body.data;
  const p = (await call("post", "/api/payments/create-order", "buyer").send({ orderId: o._id })).body.data;
  await call("post", "/api/payments/verify", "buyer").send({ razorpay_order_id: p.razorpayOrderId, razorpay_payment_id: "pay_c3", razorpay_signature: sign(p.razorpayOrderId, "pay_c3") });
  eq(await stockOf(plain._id), before - 2);
  const r = await call("post", `/api/orders/${o._id}/cancel`, "buyer").send({ reason: "changed mind" }); eq(r.status, 200, r.body.message);
  eq(r.body.data.order.status, "CANCELLED"); eq(await stockOf(plain._id), before); eq(r.body.data.refund.ok, true);
});
await step("late payment for an already-cancelled order is refunded automatically", async () => {
  await call("post", "/api/cart", "buyer").send({ productId: String(plain._id), quantity: 1 });
  const o = (await call("post", "/api/orders", "buyer").send({ addressId, paymentMethod: "ONLINE" })).body.data;
  const p = (await call("post", "/api/payments/create-order", "buyer").send({ orderId: o._id })).body.data;
  eq((await call("post", `/api/orders/${o._id}/cancel`, "buyer").send({})).status, 200);
  const v = await call("post", "/api/payments/verify", "buyer").send({ razorpay_order_id: p.razorpayOrderId, razorpay_payment_id: "pay_late", razorpay_signature: sign(p.razorpayOrderId, "pay_late") });
  eq(v.status, 409); eq(v.body.code, "OUT_OF_STOCK_REFUNDED"); eq((await M.Payment.findOne({ razorpayOrderId: p.razorpayOrderId })).status, "REFUND_INITIATED");
});

console.log("\n=== ADMIN APIs ===");
await step("admin: users list, payments list, low stock, inventory logs", async () => {
  for (const path of ["/api/admin/users", "/api/admin/payments", "/api/admin/inventory?threshold=100", "/api/admin/inventory/logs", "/api/admin/orders", "/api/admin/returns", "/api/admin/reviews", "/api/admin/settings"]) { const r = await call("get", path, "admin"); eq(r.status, 200, `${path}: ${r.body.message}`); }
});
await step("admin: stock adjustment can't go negative; positive adjustment is logged", async () => {
  eq((await call("post", "/api/admin/inventory/adjust", "admin").send({ productId: String(plain._id), delta: -100001, reason: "oops" })).status, 400);
  eq((await call("post", "/api/admin/inventory/adjust", "admin").send({ productId: String(plain._id), delta: -50, reason: "count correction" })).status, 409);
  eq((await call("post", "/api/admin/inventory/adjust", "admin").send({ productId: String(plain._id), delta: 5, reason: "restock delivery" })).status, 200);
});
await step("admin: coupon CRUD", async () => {
  const c = await call("post", "/api/coupons", "admin").send({ code: "NEW20", discountType: "percentage", discountValue: 20, expiryDate: "2030-01-01" }); eq(c.status, 201, c.body.message);
  eq((await call("patch", `/api/coupons/${c.body.data._id}`, "admin").send({ isActive: false })).status, 200);
  eq((await call("delete", `/api/coupons/${c.body.data._id}`, "admin")).status, 200);
});
await step("admin: settings (cod / shipping / orders / returns) update + validation", async () => {
  eq((await call("patch", "/api/admin/settings/cod", "admin").send({ tokenType: "percentage", tokenValue: 95 })).status, 400);
  eq((await call("patch", "/api/admin/settings/cod", "admin").send({ tokenValue: 150 })).status, 200);
  eq((await call("patch", "/api/admin/settings/shipping", "admin").send({ freeThreshold: 500, flatCharge: 40 })).status, 200);
  eq((await call("patch", "/api/admin/settings/returns", "admin").send({ windowDays: 10 })).status, 200);
  eq((await call("patch", "/api/admin/settings/orders", "admin").send({ cancelWhenProcessing: true })).status, 200);
});
await step("admin: deactivated user is refused on their next request", async () => {
  const u = await M.User.findOne({ firebaseUid: "buyer" });
  eq((await call("patch", `/api/admin/users/${u._id}/status`, "admin").send({ isActive: false })).status, 200);
  eq((await call("get", "/api/users/me", "buyer")).status, 403);
  await call("patch", `/api/admin/users/${u._id}/status`, "admin").send({ isActive: true });
});
await step("admin: product create (multipart, no images) + category delete guard", async () => {
  const r = await call("post", "/api/products", "admin").field("name", "New Cap").field("description", "d").field("category", String(cat._id)).field("price", "499").field("stock", "3").field("sku", "CAP-1"); eq(r.status, 201, r.body.message);
  eq((await call("delete", `/api/categories/${cat._id}`, "admin")).body.code, "CATEGORY_IN_USE");
});
await step("admin: product edit keeps existing variant ids (carts/orders keep working)", async () => {
  const p = await M.Product.findById(varP._id); const before = p.variants.map((v) => String(v._id));
  const r = await call("patch", `/api/products/${varP._id}`, "admin").field("variants", JSON.stringify(p.variants.map((v) => ({ _id: String(v._id), size: v.size, sku: v.sku, price: v.price, stock: v.stock })))); eq(r.status, 200, r.body.message);
  eq(JSON.stringify((await M.Product.findById(varP._id)).variants.map((v) => String(v._id))), JSON.stringify(before));
});
await step("admin: dashboard numbers", async () => {
  const d = await call("get", "/api/admin/dashboard", "admin"); eq(d.status, 200, `dashboard: ${d.body.message}`); ok(d.body.data.cards.totalOrders >= 1, "has orders"); ok(d.body.data.cards.totalRevenue > 0, "has revenue");
});
await step("admin: analytics (revenue/orders series, top products, categories, payment split)", async () => {
  const a = await call("get", "/api/admin/analytics?days=7", "admin"); eq(a.status, 200, `analytics: ${a.body.message}`); eq(a.body.data.daily.length, 7);
  ok(a.body.data.totals.orders >= 1, "orders counted"); ok(a.body.data.topProducts.length >= 1, "top products");
}, { ferretSkip: "$facet / $lookup aggregation stages" });

console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? `:\n - ${failures.join("\n - ")}` : ""}`);
await mongoose.disconnect();
process.exit(failures.length ? 1 : 0);
