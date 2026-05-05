const prisma = require("../config/db");

// ── Helpers ─────────────────────────────────────────────────

const productListInclude = {
  images: { where: { isPrimary: true }, take: 1 },
  variants: { orderBy: { price: "asc" }, take: 1 },
  category: { select: { name: true, slug: true } },
  _count: { select: { reviews: true } },
};

const productDetailInclude = {
  images: { orderBy: { sortOrder: "asc" } },
  variants: { orderBy: { price: "asc" } },
  category: { select: { id: true, name: true, slug: true } },
  reviews: {
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  },
  _count: { select: { reviews: true } },
};

const productAdminInclude = {
  images: { orderBy: { sortOrder: "asc" } },
  variants: { orderBy: { price: "asc" } },
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { reviews: true, orderItems: true, cartItems: true } },
};

const buildSlug = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const buildOrderBy = (sort) => {
  switch (sort) {
    case "price_asc":
    case "price_desc":
      return { createdAt: "desc" };
    case "name_asc":
      return { name: "asc" };
    case "rating":
      return { reviews: { _count: "desc" } };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
};

const sortProductsByPrice = (products, sort) => {
  if (sort !== "price_asc" && sort !== "price_desc") return products;

  return [...products].sort((a, b) => {
    const aPrice = Number(a.variants?.[0]?.price || 0);
    const bPrice = Number(b.variants?.[0]?.price || 0);

    return sort === "price_asc" ? aPrice - bPrice : bPrice - aPrice;
  });
};

const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  return JSON.parse(value);
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1";
};

const nullableString = (value) => {
  if (value === undefined) return undefined;
  return value === "" ? null : value;
};

const nullableNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return Number(value);
};

const normalizeVariant = (variant) => ({
  ...(variant.id && { id: variant.id }),
  sku: variant.sku,
  color: nullableString(variant.color),
  material: nullableString(variant.material),
  size: nullableString(variant.size),
  price: Number(variant.price),
  compareAt: nullableNumber(variant.compareAt),
  stock: Number(variant.stock ?? 0),
});

const productWhere = ({
  category,
  brand,
  minPrice,
  maxPrice,
  q,
  includeInactive = false,
  status,
}) => ({
  ...(!includeInactive && { isActive: true }),
  ...(status === "active" && { isActive: true }),
  ...(status === "inactive" && { isActive: false }),
  ...(category && { category: { slug: category } }),
  ...(brand && { brand: { equals: brand, mode: "insensitive" } }),
  ...(q && {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
    ],
  }),
  ...((minPrice || maxPrice) && {
    variants: {
      some: {
        price: {
          ...(minPrice && { gte: +minPrice }),
          ...(maxPrice && { lte: +maxPrice }),
        },
      },
    },
  }),
});

const buildVariantMutation = (variants) => {
  const normalizedVariants = parseJsonField(variants, []).map(normalizeVariant);

  if (!normalizedVariants.length) {
    const err = new Error("At least one product variant is required");
    err.statusCode = 400;
    throw err;
  }

  const create = normalizedVariants
    .filter((variant) => !variant.id)
    .map(({ id: _id, ...variant }) => variant);
  const update = normalizedVariants
    .filter((variant) => variant.id)
    .map((variant) => {
      const { id, ...data } = variant;
      return { where: { id }, data };
    });

  return {
    ...(create.length && { create }),
    ...(update.length && { update }),
  };
};

// ── Service methods ─────────────────────────────────────────

exports.findAll = async ({
  page = 1,
  limit = 12,
  category,
  brand,
  minPrice,
  maxPrice,
  sort,
  q,
}) => {
  const skip = (page - 1) * limit;
  const where = productWhere({ category, brand, minPrice, maxPrice, q });

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: buildOrderBy(sort),
      include: productListInclude,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: sortProductsByPrice(products, sort),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
};

exports.findFeatured = () =>
  prisma.product.findMany({
    where: { isFeatured: true, isActive: true },
    include: productListInclude,
    take: 8,
    orderBy: { updatedAt: "desc" },
  });

exports.findBySlug = (slug) =>
  prisma.product.findUnique({
    where: { slug },
    include: productDetailInclude,
  });

exports.findById = (id) =>
  prisma.product.findUnique({
    where: { id },
    include: productAdminInclude,
  });

exports.findAllForAdmin = async ({ page = 1, limit = 100, status, q }) => {
  const skip = (page - 1) * limit;
  const where = productWhere({ includeInactive: true, status, q });

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: productAdminInclude,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
};

exports.search = (q, limit = 8) =>
  prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      variants: { orderBy: { price: "asc" }, take: 1 },
    },
    take: limit,
  });

exports.getDistinctBrands = async () => {
  const result = await prisma.product.findMany({
    where: { isActive: true, brand: { not: null } },
    select: { brand: true },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
  });
  return result.map((r) => r.brand);
};

exports.create = async (body, files = []) => {
  const {
    name,
    description,
    brand,
    categoryId,
    isFeatured,
    isActive,
    variants,
  } = body;

  if (!name || !description || !categoryId) {
    const err = new Error("name, description and categoryId are required");
    err.statusCode = 400;
    throw err;
  }

  const normalizedVariants = parseJsonField(variants, []).map(normalizeVariant);

  if (!normalizedVariants.length) {
    const err = new Error("At least one product variant is required");
    err.statusCode = 400;
    throw err;
  }

  const slug = buildSlug(name);

  // check slug uniqueness, append suffix if taken
  const existing = await prisma.product.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  return prisma.product.create({
    data: {
      name,
      slug: finalSlug,
      description,
      brand: brand || null,
      categoryId,
      isFeatured: toBoolean(isFeatured),
      isActive: toBoolean(isActive, true),
      variants: {
        create: normalizedVariants.map(({ id: _id, ...variant }) => variant),
      },
      ...(files.length && {
        images: {
          create: files.map((f, i) => ({
            url: `/uploads/${f.filename}`,
            altText: name,
            isPrimary: i === 0,
            sortOrder: i,
          })),
        },
      }),
    },
    include: productAdminInclude,
  });
};

exports.update = async (id, body, files = []) => {
  const {
    name,
    description,
    brand,
    categoryId,
    isFeatured,
    isActive,
    variants,
    removeImageIds,
  } = body;

  const imagesMutation = {};
  const imageIdsToRemove = parseJsonField(removeImageIds, []);

  if (imageIdsToRemove.length) {
    imagesMutation.deleteMany = { id: { in: imageIdsToRemove } };
  }

  if (files.length) {
    imagesMutation.create = files.map((f, i) => ({
      url: `/uploads/${f.filename}`,
      altText: name || undefined,
      isPrimary: false,
      sortOrder: i + 100,
    }));
  }

  return prisma.product.update({
    where: { id },
    data: {
      ...(name && { name, slug: buildSlug(name) }),
      ...(description !== undefined && { description }),
      ...(brand !== undefined && { brand: brand || null }),
      ...(categoryId !== undefined && categoryId !== "" && { categoryId }),
      ...(isFeatured !== undefined && { isFeatured: toBoolean(isFeatured) }),
      ...(isActive !== undefined && { isActive: toBoolean(isActive, true) }),
      ...(variants && { variants: buildVariantMutation(variants) }),
      ...(Object.keys(imagesMutation).length && { images: imagesMutation }),
    },
    include: productAdminInclude,
  });
};

exports.toggleActive = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
    select: { isActive: true },
  });

  if (!product) {
    const err = new Error("Product not found");
    err.statusCode = 404;
    throw err;
  }

  return prisma.product.update({
    where: { id },
    data: { isActive: !product.isActive },
    include: productAdminInclude,
  });
};

// Soft delete — keeps order history intact
exports.remove = (id) =>
  prisma.product.update({
    where: { id },
    data: { isActive: false },
    include: productAdminInclude,
  });
