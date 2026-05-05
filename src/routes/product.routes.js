const router = require("express").Router();
const ctrl = require("../controllers/product.controller");
const { protect, adminOnly } = require("../middleware/auth");
const upload = require("../middleware/upload");

// ── Public routes ───────────────────────────────────────────
router.get("/", ctrl.getAll); // GET /api/products?category=cases&brand=spigen&page=1
router.get("/featured", ctrl.getFeatured); // GET /api/products/featured
router.get("/search", ctrl.search); // GET /api/products/search?q=iphone
router.get("/brands", ctrl.getBrands); // GET /api/products/brands

// Admin reads include inactive products and full edit payloads.
router.get("/admin", protect, adminOnly, ctrl.getAdminAll);
router.get("/admin/:id", protect, adminOnly, ctrl.getAdminOne);

router.get("/:slug", ctrl.getOne); // GET /api/products/spigen-iphone-15-case

// ── Admin only routes ───────────────────────────────────────
router.post("/", protect, adminOnly, upload.array("images", 6), ctrl.create);
router.put("/:id", protect, adminOnly, upload.array("images", 6), ctrl.update);
router.patch("/:id/toggle", protect, adminOnly, ctrl.toggleActive);
router.delete("/:id", protect, adminOnly, ctrl.remove);

module.exports = router;
