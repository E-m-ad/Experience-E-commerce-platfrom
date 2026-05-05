const router = require("express").Router();
const ctrl = require("../controllers/category.controller");
const { protect, adminOnly } = require("../middleware/auth");
const upload = require("../middleware/upload");

// ── Public routes ───────────────────────────────────────────
router.get("/", ctrl.getAll); // GET /api/categories          (flat list)
router.get("/tree", ctrl.getTree); // GET /api/categories/tree     (nested tree)
router.get("/:slug", ctrl.getOne); // GET /api/categories/phone-cases

// ── Admin only routes ───────────────────────────────────────
router.post("/", protect, adminOnly, upload.single("image"), ctrl.create);
router.put("/:id", protect, adminOnly, upload.single("image"), ctrl.update);
router.delete("/:id", protect, adminOnly, ctrl.remove);

module.exports = router;
