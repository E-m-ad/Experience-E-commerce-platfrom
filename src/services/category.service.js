const prisma = require("../config/db");

// ── Helpers ─────────────────────────────────────────────────

const buildSlug = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

/**
 * Takes a flat array of categories (all with parentId)
 * and converts it into a nested tree structure.
 *
 * Example output:
 * [
 *   { id: '1', name: 'Phone Cases', children: [
 *       { id: '3', name: 'iPhone Cases', children: [] },
 *       { id: '4', name: 'Samsung Cases', children: [] },
 *   ]},
 *   { id: '2', name: 'Chargers', children: [...] },
 * ]
 */
const buildTree = (categories) => {
  const map = {};
  const roots = [];

  // index all nodes by id
  categories.forEach((cat) => {
    map[cat.id] = { ...cat, children: [] };
  });

  // wire up parent → children
  categories.forEach((cat) => {
    if (cat.parentId && map[cat.parentId]) {
      map[cat.parentId].children.push(map[cat.id]);
    } else {
      roots.push(map[cat.id]);
    }
  });

  return roots;
};

// ── Service methods ─────────────────────────────────────────

/**
 * Flat list — useful for dropdowns and admin selects.
 * Includes product count per category.
 */
exports.findAll = () =>
  prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true } },
      parent: { select: { id: true, name: true, slug: true } },
    },
  });

/**
 * Nested tree — used by the navbar mega-menu on the frontend.
 * Fetches everything in one query, then assembles in JS.
 */
exports.findTree = async () => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true } },
    },
  });

  return buildTree(categories);
};

/**
 * Single category by slug — includes its direct children
 * and the first page of active products under it.
 */
exports.findBySlug = (slug) =>
  prisma.category.findUnique({
    where: { slug },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: {
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } },
      },
      products: {
        where: { isActive: true },
        take: 12,
        orderBy: { createdAt: "desc" },
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          variants: { orderBy: { price: "asc" }, take: 1 },
        },
      },
      _count: { select: { products: true } },
    },
  });

/**
 * Create a new category.
 * Auto-generates a slug from the name.
 * Accepts an optional parentId for subcategories.
 */
exports.create = async (body, file) => {
  const { name, description, parentId } = body;

  const slug = buildSlug(name);

  // ensure slug uniqueness
  const existing = await prisma.category.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  return prisma.category.create({
    data: {
      name,
      slug: finalSlug,
      description: description || null,
      imageUrl: file ? `/uploads/${file.filename}` : null,
      parentId: parentId || null,
    },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: true,
      _count: { select: { products: true } },
    },
  });
};

/**
 * Update an existing category.
 * Only updates fields that are actually sent in the request.
 */
exports.update = async (id, body, file) => {
  const { name, description, parentId } = body;

  // prevent a category from becoming its own parent
  if (parentId && parentId === id) {
    const err = new Error("A category cannot be its own parent");
    err.statusCode = 400;
    throw err;
  }

  return prisma.category.update({
    where: { id },
    data: {
      ...(name && { name, slug: buildSlug(name) }),
      ...(description !== undefined && { description }),
      ...(parentId !== undefined && { parentId: parentId || null }),
      ...(file && { imageUrl: `/uploads/${file.filename}` }),
    },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: { include: { _count: { select: { products: true } } } },
      _count: { select: { products: true } },
    },
  });
};

/**
 * Delete a category.
 * Blocks deletion if any products are still assigned to it.
 * Re-parents children to the deleted category's own parent (or null).
 */
exports.remove = async (id) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: { select: { products: true } },
      children: { select: { id: true } },
    },
  });

  if (!category) {
    const err = new Error("Category not found");
    err.statusCode = 404;
    throw err;
  }

  if (category._count.products > 0) {
    const err = new Error(
      `Cannot delete — ${category._count.products} product(s) are still assigned to this category`,
    );
    err.statusCode = 409;
    throw err;
  }

  // move children up one level before deleting
  if (category.children.length > 0) {
    await prisma.category.updateMany({
      where: { parentId: id },
      data: { parentId: category.parentId || null },
    });
  }

  return prisma.category.delete({ where: { id } });
};
