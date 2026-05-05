const prisma = require("../config/db");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateRating = (rating) => {
  const parsedRating = Number(rating);

  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    throw createError("Rating must be an integer from 1 to 5", 400);
  }

  return parsedRating;
};

const reviewInclude = {
  user: { select: { id: true, firstName: true, lastName: true } },
};

const listProductReviews = async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { productId: req.params.productId },
    orderBy: { createdAt: "desc" },
    include: reviewInclude
  });

  res.json({ success: true, data: reviews });
};

const createReview = async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
  if (!product) {
    throw createError("Product not found", 404);
  }

  const review = await prisma.review.create({
    data: {
      productId: req.params.productId,
      userId: req.user.id,
      rating: validateRating(req.body.rating),
      title: req.body.title,
      body: req.body.body ?? req.body.comment
    },
    include: reviewInclude
  });

  res.status(201).json({ success: true, data: review });
};

const updateReview = async (req, res) => {
  const existingReview = await prisma.review.findUnique({ where: { id: req.params.id } });

  if (!existingReview) {
    throw createError("Review not found", 404);
  }

  if (existingReview.userId !== req.user.id && req.user.role !== "ADMIN") {
    throw createError("You do not have permission to update this review", 403);
  }

  const review = await prisma.review.update({
    where: { id: req.params.id },
    data: {
      ...(req.body.rating !== undefined && { rating: validateRating(req.body.rating) }),
      ...(req.body.title !== undefined && { title: req.body.title }),
      ...(req.body.body !== undefined && { body: req.body.body }),
      ...(req.body.comment !== undefined && req.body.body === undefined && { body: req.body.comment })
    },
    include: reviewInclude
  });

  res.json({ success: true, data: review });
};

const deleteReview = async (req, res) => {
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });

  if (!review) {
    throw createError("Review not found", 404);
  }

  if (review.userId !== req.user.id && req.user.role !== "ADMIN") {
    throw createError("You do not have permission to delete this review", 403);
  }

  await prisma.review.delete({ where: { id: req.params.id } });
  res.status(204).send();
};

module.exports = {
  listProductReviews,
  createReview,
  updateReview,
  deleteReview
};
