const router = require("express").Router();
const ctrl = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth");

// ── Public routes ───────────────────────────────────────────
router.post("/register", ctrl.register); // POST /api/auth/register
router.post("/login", ctrl.login); // POST /api/auth/login
router.post("/refresh", ctrl.refresh); // POST /api/auth/refresh
router.post("/logout", ctrl.logout); // POST /api/auth/logout

// ── Protected routes ────────────────────────────────────────
router.get("/me", protect, ctrl.getMe); // GET   /api/auth/me
router.put("/me", protect, ctrl.updateMe); // PUT   /api/auth/me
router.put("/me/password", protect, ctrl.changePassword); // PUT   /api/auth/me/password
router.get("/me/addresses", protect, ctrl.getAddresses); // GET   /api/auth/me/addresses
router.post("/me/addresses", protect, ctrl.addAddress); // POST  /api/auth/me/addresses
router.put("/me/addresses/:id", protect, ctrl.updateAddress); // PUT   /api/auth/me/addresses/:id
router.delete("/me/addresses/:id", protect, ctrl.deleteAddress); // DELETE /api/auth/me/addresses/:id

module.exports = router;
