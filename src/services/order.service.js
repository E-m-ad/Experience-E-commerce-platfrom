const prisma = require("../config/db");

// ── Helpers ─────────────────────────────────────────────────

const orderInclude = {
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
          color: true,
          size: true,
          material: true,
        },
      },
    },
  },
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

const CANCELLABLE_STATUSES = ["PENDING", "CONFIRMED"];

const VALID_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

// ── Service methods ─────────────────────────────────────────

/**
 * Create an order from the request body.
 *
 * Expected body shape:
 * {
 *   items: [{ variantId, productId, quantity }],
 *   shippingAddressId: 'uuid',   // user's saved address  (option A)
 *   shippingAddress: { ... },    // or inline address      (option B)
 *   paymentMethod: 'CASH_ON_DELIVERY' | 'STRIPE' | etc.,
 *   notes: 'optional note',
 * }
 */
exports.create = async (userId, body) => {
  const { shippingAddressId, shippingAddress, paymentMethod, notes } =
    body;
  let { items } = body;

  if (!items?.length) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });
    items = cart?.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    }));
  }

  if (!items?.length) {
    const err = new Error("Order must contain at least one item");
    err.statusCode = 400;
    throw err;
  }

  items = items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: Number(item.quantity || 0),
  }));

  // ── 1. Resolve shipping address ──────────────────────────
  let addressSnapshot;

  if (shippingAddressId) {
    const saved = await prisma.address.findFirst({
      where: { id: shippingAddressId, userId },
    });
    if (!saved) {
      const err = new Error("Address not found");
      err.statusCode = 404;
      throw err;
    }
    addressSnapshot = saved;
  } else if (shippingAddress) {
    addressSnapshot = shippingAddress;
  } else {
    const err = new Error("A shipping address is required");
    err.statusCode = 400;
    throw err;
  }

  // ── 2. Validate stock & fetch variant prices ─────────────
  const variantIds = items.map((i) => i.variantId);

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
  });

  const variantMap = Object.fromEntries(variants.map((v) => [v.id, v]));

  for (const item of items) {
    const variant = variantMap[item.variantId];

    if (!variant) {
      const err = new Error(`Variant ${item.variantId} not found`);
      err.statusCode = 404;
      throw err;
    }

    if (item.quantity < 1) {
      const err = new Error("Item quantities must be greater than zero");
      err.statusCode = 400;
      throw err;
    }

    if (variant.stock < item.quantity) {
      const err = new Error(
        `Not enough stock for SKU "${variant.sku}" — requested ${item.quantity}, available ${variant.stock}`,
      );
      err.statusCode = 409;
      throw err;
    }
  }

  // ── 3. Calculate totals ──────────────────────────────────
  const lineItems = items.map((item) => {
    const variant = variantMap[item.variantId];
    const unitPrice = parseFloat(variant.price);
    const total = unitPrice * item.quantity;
    return { ...item, productId: variant.productId, unitPrice, total };
  });

  const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);
  const shippingCost = subtotal >= 500 ? 0 : 50; // free shipping above EGP 500
  const orderTotal = subtotal + shippingCost;

  // ── 4. Create order + decrement stock in a transaction ───
  const order = await prisma.$transaction(async (tx) => {
    // decrement stock for each variant
    for (const item of items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // create the order
    return tx.order.create({
      data: {
        userId,
        shippingAddress: addressSnapshot,
        paymentMethod: paymentMethod || null,
        subtotal,
        shippingCost,
        total: orderTotal,
        notes: notes || null,
        items: {
          create: lineItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
      },
      include: orderInclude,
    });
  });

  // ── 5. Clear the user's cart after successful order ──────
  await prisma.cart.deleteMany({ where: { userId } });

  return order;
};

/**
 * All orders for a specific customer, paginated.
 */
exports.findByUser = async (userId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
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
            variant: { select: { sku: true, color: true } },
          },
        },
      },
    }),
    prisma.order.count({ where: { userId } }),
  ]);

  return {
    orders,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Single order — only returned if it belongs to the requesting user.
 */
exports.findByIdForUser = (orderId, userId) =>
  prisma.order.findFirst({
    where: { id: orderId, userId },
    include: orderInclude,
  });

/**
 * Single order — admin use, no ownership check.
 */
exports.findById = (id) =>
  prisma.order.findUnique({
    where: { id },
    include: orderInclude,
  });

/**
 * All orders — admin dashboard with optional status filters.
 */
exports.findAll = async ({ page = 1, limit = 20, status, paymentStatus }) => {
  const skip = (page - 1) * limit;

  const where = {
    ...(status && { status }),
    ...(paymentStatus && { paymentStatus }),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
};

/**
 * Advance an order's status.
 * Validates against the allowed transition map so you can't
 * jump from PENDING straight to DELIVERED, for example.
 */
exports.updateStatus = async (orderId, newStatus) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });

  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    const err = new Error(
      `Cannot transition from ${order.status} to ${newStatus}. Allowed: ${allowed.join(", ") || "none"}`,
    );
    err.statusCode = 400;
    throw err;
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus },
    include: orderInclude,
  });
};

/**
 * Update payment status — called after payment gateway confirms.
 */
exports.updatePayment = (orderId, paymentStatus, paymentMethod) =>
  prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus,
      ...(paymentMethod && { paymentMethod }),
      // auto-confirm order when payment comes in
      ...(paymentStatus === "PAID" && { status: "CONFIRMED" }),
    },
    include: orderInclude,
  });

/**
 * Customer-initiated cancellation.
 * Only allowed while order is still PENDING or CONFIRMED.
 * Restores stock for every item.
 */
exports.cancel = async (orderId, userId) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  });

  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    const err = new Error(
      `Order cannot be cancelled — current status is ${order.status}`,
    );
    err.statusCode = 409;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    // restore stock
    for (const item of order.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }

    // mark as cancelled
    return tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
      include: orderInclude,
    });
  });
};
