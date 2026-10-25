import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getMe,
  updateMe,
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
} from "../controllers/userController.js";

const router = Router();

// Every route here requires a verified Firebase session.
router.use(requireAuth);

router.get("/me", getMe);
router.patch("/me", updateMe);

router.get("/addresses", listAddresses);
router.post("/addresses", addAddress);
router.patch("/addresses/:id", updateAddress);
router.delete("/addresses/:id", deleteAddress);

export default router;
