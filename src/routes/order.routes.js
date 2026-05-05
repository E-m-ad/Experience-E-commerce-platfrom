const router = require("express").Router();
const ctrl = require("../controllers/order.controller");
const { protect, adminOnly } = require("../middleware/auth");

// ── Customer routes ─────────────────────────────────────────
router.post("/", protect, ctrl.create); // POST   /api/orders           (checkout)
router.get("/my-orders", protect, ctrl.getMyOrders); // GET    /api/orders/my-orders
router.get("/my-orders/:id", protect, ctrl.getMyOrder); // GET    /api/orders/my-orders/:id
router.post("/:id/cancel", protect, ctrl.cancel); // POST   /api/orders/:id/cancel

// ── Admin routes ────────────────────────────────────────────
router.get("/", protect, adminOnly, ctrl.getAll); // GET    /api/orders
router.get("/:id", protect, adminOnly, ctrl.getOne); // GET    /api/orders/:id
router.patch("/:id/status", protect, adminOnly, ctrl.updateStatus); // PATCH  /api/orders/:id/status
router.patch("/:id/payment", protect, adminOnly, ctrl.updatePayment); // PATCH  /api/orders/:id/payment

module.exports = router;
