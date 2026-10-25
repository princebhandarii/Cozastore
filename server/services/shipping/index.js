import { env } from "../../config/env.js";
import { calculateShippingCharge as calc } from "../../utils/shippingCharge.js";
import * as pincodeLookup from "./providers/pincodeLookup.js";
import * as shiprocket from "./providers/shiprocket.js";

// Every provider must export: name, checkServiceability(pincode).
// Phase 9 adds create-shipment / tracking to this interface.
const providers = { [pincodeLookup.name]: pincodeLookup, [shiprocket.name]: shiprocket };

export const getShippingProvider = () => {
  const provider = providers[env.shipping.provider];
  if (!provider) throw new Error(`Unknown SHIPPING_PROVIDER "${env.shipping.provider}"`);
  return provider;
};

export const checkServiceability = (pincode) => getShippingProvider().checkServiceability(pincode);

export const calculateShippingCharge = (amountAfterDiscount, config = env.shipping) => calc(amountAfterDiscount, config);

// Admin-set values (SiteSettings.shipping) win; .env values are the defaults.
export const resolveShippingConfig = (settings) => {
  const s = settings?.toObject ? settings.toObject().shipping : settings?.shipping;
  return {
    freeThreshold: s?.freeThreshold ?? env.shipping.freeThreshold,
    flatCharge: s?.flatCharge ?? env.shipping.flatCharge,
  };
};

// Courier-side actions (create a real shipment / poll status) only exist on
// providers that implement them. Manual entry (see orderLifecycleService.js)
// is always available as the development-only fallback when they don't.
export const supportsCourierIntegration = () => typeof getShippingProvider().createShipment === "function";
export const createShipment = (order) => getShippingProvider().createShipment(order);
export const getShipmentStatus = (shipmentId) => getShippingProvider().getShipmentStatus(shipmentId);
