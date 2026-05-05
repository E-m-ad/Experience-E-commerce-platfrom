const router = require("express").Router();
const ctrl = require("../controllers/cart.controller");
const { protect, adminOnly } = require("../middleware/auth");

// All cart routes require authentication
router.use(protect);

router.get("/admin", adminOnly, ctrl.getAdminCarts); // GET /api/cart/admin
router.get("/", ctrl.getCart); // GET    /api/cart
router.post("/items", ctrl.addItem); // POST   /api/cart/items
router.patch("/items/:id", ctrl.updateItem); // PATCH  /api/cart/items/:variantId
router.delete("/items/:id", ctrl.removeItem); // DELETE /api/cart/items/:variantId
router.delete("/", ctrl.clearCart); // DELETE /api/cart

module.exports = router;
