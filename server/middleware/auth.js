import { firebaseAuth } from "../config/firebase.js";
import User from "../models/User.js";
import { asyncHandler } from "./asyncHandler.js";
import { ApiError, unauthorized, forbidden } from "../utils/ApiError.js";
import { sendWelcomeEmail } from "../services/email/emailService.js";

// requireAuth:
// 1. Reads the Firebase ID token from the Authorization header.
// 2. Verifies it against Firebase's servers (not just decodes it).
// 3. Loads the matching MongoDB user, creating a minimal profile on
//    the user's very first request if one doesn't exist yet.
// 4. Attaches both req.firebaseUser (raw token claims) and req.user
//    (the MongoDB document) - every controller reads identity/role
//    from req.user, never from anything the client sent in the body.
export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw unauthorized("Missing or malformed Authorization header");
  }

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(token);
  } catch {
    throw unauthorized("Invalid or expired session. Please sign in again.");
  }

  let user = await User.findOne({ firebaseUid: decoded.uid });

  if (!user) {
    // First sign-in. The browser fires several requests at once for a brand-new
    // user (profile sync from the register thunk AND the auth listener), so two
    // requests can both reach this point. The unique index makes the loser's
    // insert fail with E11000; instead of surfacing that as a 409, load the
    // profile the winner just created.
    try {
      user = await User.create({
        firebaseUid: decoded.uid,
        email: decoded.email?.toLowerCase(),
        name: decoded.name || "",
        profileImage: decoded.picture || null,
      });
      sendWelcomeEmail(user); // best-effort, never blocks the request
    } catch (err) {
      if (err.code !== 11000) throw err;
      user = await User.findOne({ firebaseUid: decoded.uid });
      if (!user) {
        // Same email already belongs to a different sign-in method/account.
        throw new ApiError(409, "An account with this email already exists.", "EMAIL_IN_USE");
      }
    }
  }

  if (!user.isActive) {
    throw forbidden("This account has been deactivated. Contact support.");
  }

  req.firebaseUser = decoded;
  req.user = user;
  next();
});

// requireAdmin must run AFTER requireAuth. It checks the role that
// MongoDB has stored for this user - a role the client can never set
// or override via request body/query/header.
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return next(forbidden("Admin access required"));
  }
  next();
};

// Like requireAuth, but never rejects: attaches req.user when a valid token is
// present (e.g. so a public review list can mark "your review"), otherwise
// continues anonymously.
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme === "Bearer" && token) {
    try {
      const decoded = await firebaseAuth.verifyIdToken(token);
      const user = await User.findOne({ firebaseUid: decoded.uid });
      if (user?.isActive) req.user = user;
    } catch {
      // invalid/expired token on a public route: treat as anonymous
    }
  }
  next();
});
