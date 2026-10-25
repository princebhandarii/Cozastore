import { ApiError } from "../../../utils/ApiError.js";

// Provider: India Post public PIN directory (https://api.postalpincode.in).
// It confirms that a PIN exists, returns its state/district, and whether a
// post office delivers there. It does NOT know whether YOUR courier serves
// the PIN - when a courier provider (e.g. Shiprocket) is added in Phase 9 it
// replaces this adapter behind the same interface.
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

export const name = "pincode-lookup";

export const checkServiceability = async (pincode) => {
  const cached = cache.get(pincode);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  let body;
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = await res.json();
  } catch {
    // Fail closed: we never claim a PIN is deliverable if we couldn't verify it.
    throw new ApiError(
      503,
      "Could not verify delivery for this PIN code right now. Please try again shortly.",
      "PINCODE_SERVICE_UNAVAILABLE"
    );
  }

  const entry = Array.isArray(body) ? body[0] : null;
  let value;
  if (!entry || entry.Status !== "Success" || !entry.PostOffice?.length) {
    value = { valid: false, serviceable: false, city: null, state: null, provider: name, message: "PIN code not found" };
  } else {
    const offices = entry.PostOffice;
    const deliverable = offices.some((o) => o.DeliveryStatus === "Delivery");
    value = {
      valid: true,
      serviceable: deliverable,
      city: offices[0].District,
      state: offices[0].State,
      provider: name,
      message: deliverable ? "Delivery available" : "Delivery unavailable for this PIN code",
    };
  }
  cache.set(pincode, { at: Date.now(), value });
  return value;
};
