const express = require("express");
const reviewController = require("../controllers/review.controller");
const { protect } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

router.get(
  "/product/:productId",
  asyncHandler(reviewController.listProductReviews),
);
router.post(
  "/product/:productId",
  protect,
  asyncHandler(reviewController.createReview),
);
router.patch("/:id", protect, asyncHandler(reviewController.updateReview));
router.delete("/:id", protect, asyncHandler(reviewController.deleteReview));

module.exports = router;
