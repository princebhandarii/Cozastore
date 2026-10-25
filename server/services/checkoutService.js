import Cart from "../models/Cart.js";
import { ApiError, badRequest } from "../utils/ApiError.js";
import { buildCartView } from "../controllers/cartController.js";
import { validateCoupon } from "./couponService.js";
import { checkServiceability, calculateShippingCharge, resolveShippingConfig } from "./shipping/index.js";
import { getSettings } from "./settingsService.js";
import { evaluateCodEligibility } from "../utils/codToken.js";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
const sameState = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  return x && y && (x.includes(y) || y.includes(x));
};

// The single place where an order's money is computed. Everything comes from
// the database (cart -> products), never from the request body.
export const prepareCheckout = async ({ user, addressId, couponCode }) => {
  const cart = await Cart.findOne({ user: user._id });
  if (!cart || cart.items.length === 0) throw badRequest("Your cart is empty", "CART_EMPTY");

  const view = await buildCartView(cart);
  const unavailable = view.items.find((i) => !i.available);
  if (unavailable) {
    throw new ApiError(409, "Some items in your cart are unavailable. Please review your cart.", "CART_INVALID");
  }

  const address = user.addresses.id(addressId);
  if (!address) throw badRequest("Please select a delivery address", "ADDRESS_REQUIRED");

  const serviceability = await checkServiceability(address.pincode);
  if (!serviceability.valid) throw badRequest("This PIN code does not exist", "INVALID_PINCODE");
  if (!serviceability.serviceable) throw badRequest("Delivery is not available for this PIN code", "DELIVERY_UNAVAILABLE");
  if (!sameState(serviceability.state, address.state)) {
    throw badRequest(`PIN code ${address.pincode} belongs to ${serviceability.state}, not ${address.state}`, "PINCODE_STATE_MISMATCH");
  }

  let discount = 0;
  let appliedCoupon = null;
  if (couponCode) {
    const result = await validateCoupon({ code: couponCode, subtotal: view.subtotal, userId: user._id });
    discount = result.discount;
    appliedCoupon = result.coupon.code;
  }

  const settings = await getSettings();
  const shippingCharge = calculateShippingCharge(view.subtotal - discount, resolveShippingConfig(settings));
  const totalAmount = view.subtotal - discount + shippingCharge;
  const cod = evaluateCodEligibility(settings.cod, totalAmount);

  return {
    lines: view.items,
    address,
    serviceability,
    subtotal: view.subtotal,
    discount,
    couponCode: appliedCoupon,
    shippingCharge,
    totalAmount,
    cod: { ...cod, otpRequired: settings.cod.otpRequired },
  };
};
