const prisma = require("../config/db");

// ── Helpers ─────────────────────────────────────────────────

/**
 * Full cart shape returned on every mutation.
 * Includes product name, primary image, variant details,
 * and a computed summary so the frontend never has to calculate.
 */
const cartInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { url: true, altText: true },
          },
        },
      },
      variant: {
        select: {
          id: true,
          sku: true,
          price: true,
          compareAt: true,
          color: true,
          material: true,
          size: true,
          stock: true,
        },
      },
    },
    orderBy: { id: "asc" },
  },
};

const adminCartInclude = {
  ...cartInclude,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },
};

/**
 * Attach computed fields to a raw cart from Prisma:
 *   - lineTotal  per item  (price × quantity)
 *   - subtotal   for cart  (sum of all lineTotals)
 *   - totalItems           (sum of all quantities)
 *   - shippingCost         (free above EGP 500)
 *   - total                (subtotal + shippingCost)
 */
const withSummary = (cart) => {
  const items = cart.items.map((item) => ({
    ...item,
    lineTotal: parseFloat(item.variant.price) * item.quantity,
  }));

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const shippingCost = subtotal >= 500 ? 0 : subtotal === 0 ? 0 : 50;
  const total = subtotal + shippingCost;

  return { ...cart, items, subtotal, totalItems, shippingCost, total };
};

// ── Service methods ─────────────────────────────────────────

/**
 * Get the user's cart, or create an empty one if it doesn't exist yet.
 * Called on every page load from the frontend.
 */
exports.getOrCreate = async (userId) => {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: cartInclude,
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: cartInclude,
    });
  }

  return withSummary(cart);
};

/**
 * Add an item to the cart.
 * - If the variant is already in the cart, increments quantity.
 * - Validates that requested quantity does not exceed available stock.
 */
exports.addItem = async (userId, { productId, variantId, quantity }) => {
  if (!productId || !variantId || quantity < 1) {
    const err = new Error(
      "productId, variantId and a positive quantity are required",
    );
    err.statusCode = 400;
    throw err;
  }

  // ── Check variant exists and has enough stock ──────────
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant) {
    const err = new Error("Variant not found");
    err.statusCode = 404;
    throw err;
  }

  // ── Get or create cart ─────────────────────────────────
  let cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId } });
  }

  // ── Check if this variant is already in the cart ───────
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
  });

  const newQuantity = existing ? existing.quantity + quantity : quantity;

  if (newQuantity > variant.stock) {
    const err = new Error(
      `Only ${variant.stock} unit(s) available for this variant`,
    );
    err.statusCode = 409;
    throw err;
  }

  // ── Upsert the cart item ───────────────────────────────
  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    update: { quantity: { increment: quantity } },
    create: { cartId: cart.id, productId, variantId, quantity },
  });
  await prisma.cart.update({
    where: { id: cart.id },
    data: { updatedAt: new Date() },
  });

  // ── Return fresh cart ──────────────────────────────────
  const updated = await prisma.cart.findUnique({
    where: { userId },
    include: cartInclude,
  });

  return withSummary(updated);
};

/**
 * Set a cart item to an exact quantity.
 * Passing quantity = 0 removes the item entirely.
 */
exports.updateItem = async (userId, variantId, quantity) => {
  if (quantity === undefined || quantity === null) {
    const err = new Error("quantity is required");
    err.statusCode = 400;
    throw err;
  }

  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    const err = new Error("Cart not found");
    err.statusCode = 404;
    throw err;
  }

  const item = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
  });

  if (!item) {
    const err = new Error("Item not in cart");
    err.statusCode = 404;
    throw err;
  }

  // quantity 0 → remove
  if (+quantity === 0) {
    await prisma.cartItem.delete({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    await prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });
  } else {
    // validate against stock
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { stock: true, sku: true },
    });

    if (+quantity > variant.stock) {
      const err = new Error(
        `Only ${variant.stock} unit(s) available for SKU "${variant.sku}"`,
      );
      err.statusCode = 409;
      throw err;
    }

    await prisma.cartItem.update({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      data: { quantity: +quantity },
    });
    await prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });
  }

  const updated = await prisma.cart.findUnique({
    where: { userId },
    include: cartInclude,
  });

  return withSummary(updated);
};

/**
 * Remove a single item from the cart by variantId.
 */
exports.removeItem = async (userId, variantId) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });

  if (!cart) {
    const err = new Error("Cart not found");
    err.statusCode = 404;
    throw err;
  }

  const item = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
  });

  if (!item) {
    const err = new Error("Item not in cart");
    err.statusCode = 404;
    throw err;
  }

  await prisma.cartItem.delete({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
  });
  await prisma.cart.update({
    where: { id: cart.id },
    data: { updatedAt: new Date() },
  });

  const updated = await prisma.cart.findUnique({
    where: { userId },
    include: cartInclude,
  });

  return withSummary(updated);
};

/**
 * Remove all items from the cart without deleting the cart itself.
 * Called automatically after a successful order is placed.
 */
exports.clear = async (userId) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) return;

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
};

exports.findAllForAdmin = async ({ page = 1, limit = 20, onlyActive = true }) => {
  const skip = (page - 1) * limit;
  const where = onlyActive ? { items: { some: {} } } : {};

  const [carts, total] = await Promise.all([
    prisma.cart.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: adminCartInclude,
    }),
    prisma.cart.count({ where }),
  ]);

  return {
    carts: carts.map(withSummary),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
};
