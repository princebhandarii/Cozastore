import { env } from "../../../config/env.js";
import { ApiError } from "../../../utils/ApiError.js";
import * as pincodeLookup from "./pincodeLookup.js";

// Real Shiprocket integration (https://apidocs.shiprocket.in). This is the
// PRODUCTION courier adapter: it authenticates, checks courier
// serviceability for a specific pickup->delivery pincode pair (with COD/
// weight awareness, unlike the plain PIN directory), creates a real
// Shiprocket order and requests an AWB, and can look up live tracking.
//
// Requires SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD and SHIPROCKET_PICKUP_PINCODE
// in server/.env, and a pickup location configured in your Shiprocket account
// (SHIPROCKET_PICKUP_LOCATION must match its nickname exactly). Without
// these, this provider refuses to run - see providers/pincodeLookup.js and
// the manual "Ship" flow (services/orderLifecycleService.js) for the
// development-only fallback that needs no courier account at all.

export const name = "shiprocket";
const BASE = "https://apiv2.shiprocket.in/v1/external";

let cachedToken = null; // { token, expiresAt }

const ensureConfigured = () => {
  const { email, password, pickupPincode } = env.shiprocket;
  if (!email || !password || !pickupPincode) {
    throw new ApiError(
      500,
      "Shiprocket is not configured. Set SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD and SHIPROCKET_PICKUP_PINCODE in server/.env.",
      "SHIPROCKET_NOT_CONFIGURED"
    );
  }
};

const authHeader = async () => {
  ensureConfigured();
  if (cachedToken && cachedToken.expiresAt > Date.now()) return `Bearer ${cachedToken.token}`;

  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.shiprocket.email, password: env.shiprocket.password }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new ApiError(502, "Could not authenticate with Shiprocket", "SHIPROCKET_AUTH_FAILED");
  const data = await res.json();
  // Shiprocket tokens are valid ~10 days; refresh a little early to be safe.
  cachedToken = { token: data.token, expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000 };
  return `Bearer ${cachedToken.token}`;
};

const call = async (path, { method = "GET", body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: await authHeader() },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(502, data?.message || `Shiprocket request failed (HTTP ${res.status})`, "SHIPROCKET_REQUEST_FAILED");
  }
  return data;
};

// Serviceability: falls back to the plain PIN directory for the basic
// exists/state/delivery-post-office check, then layers Shiprocket's own
// courier serviceability (which also confirms COD is actually available on
// that route) on top when Shiprocket is configured.
export const checkServiceability = async (pincode, { cod = false, weightKg = 0.5 } = {}) => {
  const base = await pincodeLookup.checkServiceability(pincode);
  if (!base.serviceable) return { ...base, provider: name };

  const { email, password, pickupPincode } = env.shiprocket;
  if (!email || !password || !pickupPincode) return { ...base, provider: name }; // not configured: PIN-directory result only

  try {
    const data = await call(
      `/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${pincode}&cod=${cod ? 1 : 0}&weight=${weightKg}`
    );
    const couriers = data?.data?.available_courier_companies || [];
    return { ...base, provider: name, courierServiceable: couriers.length > 0, courierCount: couriers.length };
  } catch {
    // Courier-level check failed (e.g. API hiccup) - don't block checkout over
    // it, since the PIN directory already confirmed the address is real.
    return { ...base, provider: name };
  }
};

// Creates a real Shiprocket order for a CONFIRMED order and requests an AWB.
// Returns the same shape the admin "Ship" screen already expects from manual
// entry: { courier, trackingNumber, trackingUrl, shipmentId }.
export const createShipment = async (order) => {
  ensureConfigured();
  const a = order.shippingAddress;

  const created = await call("/orders/create/adhoc", {
    method: "POST",
    body: {
      order_id: order.orderNumber,
      order_date: new Date(order.createdAt).toISOString().slice(0, 19).replace("T", " "),
      pickup_location: env.shiprocket.pickupLocation,
      billing_customer_name: a.fullName,
      billing_address: a.addressLine1,
      billing_address_2: a.addressLine2 || "",
      billing_city: a.city,
      billing_state: a.state,
      billing_pincode: a.pincode,
      billing_country: "India",
      billing_phone: a.phone,
      shipping_is_billing: true,
      order_items: order.items.map((i) => ({ name: i.name, sku: i.sku || String(i.product), units: i.quantity, selling_price: i.unitPrice })),
      payment_method: order.paymentMethod === "COD" ? "COD" : "Prepaid",
      sub_total: order.totalAmount,
      length: 15, breadth: 10, height: 5, weight: 0.5, // placeholders - set real package dimensions per product if you have them
    },
  });

  const shipmentId = created.shipment_id;
  if (!shipmentId) throw new ApiError(502, "Shiprocket did not return a shipment id", "SHIPROCKET_ORDER_FAILED");

  const awb = await call("/courier/assign/awb", { method: "POST", body: { shipment_id: shipmentId } });
  const courierName = awb?.response?.data?.courier_name;
  const trackingNumber = awb?.response?.data?.awb_code;
  if (!trackingNumber) throw new ApiError(502, "Shiprocket could not assign a courier (no serviceable courier for this route)", "SHIPROCKET_AWB_FAILED");

  return {
    courier: courierName || "Shiprocket",
    trackingNumber,
    trackingUrl: `https://shiprocket.co/tracking/${trackingNumber}`,
    shipmentId,
  };
};

// Polls Shiprocket for the current status of a shipment (used for a manual
// "Sync tracking" action; real-time updates instead use the webhook below).
export const getShipmentStatus = async (shipmentId) => {
  ensureConfigured();
  const data = await call(`/courier/track/shipment/${shipmentId}`);
  const track = data?.[shipmentId]?.tracking_data;
  return { currentStatus: track?.shipment_track?.[0]?.current_status || null, raw: track || null };
};
