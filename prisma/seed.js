require("dotenv/config");

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const loadCatalog = () => {
  const catalogPath = path.join(
    __dirname,
    "../client/src/data/products.js",
  );
  const source = fs.readFileSync(catalogPath, "utf8");
  const commonJsSource = source.replace(/export\s+const\s+/g, "const ");
  const script = new vm.Script(
    `${commonJsSource}\n;({ products, categories, brands });`,
    { filename: catalogPath },
  );

  return script.runInNewContext({});
};

const unique = (items) => [...new Set(items.filter(Boolean))];

const upsertCategories = async (products, categories) => {
  const categoryNames = unique([
    ...categories.filter((category) => category !== "All"),
    ...products.map((product) => product.category),
  ]);
  const categoryMap = new Map();

  for (const name of categoryNames) {
    const slug = slugify(name);
    const category = await prisma.category.upsert({
      where: { slug },
      update: { name },
      create: {
        name,
        slug,
        description: `${name} products`,
      },
    });

    categoryMap.set(name, category);
  }

  return categoryMap;
};

const upsertProduct = async (item, category) => {
  const product = await prisma.product.upsert({
    where: { slug: item.slug },
    update: {
      name: item.name,
      description: item.description,
      brand: item.brand || null,
      categoryId: category.id,
      isFeatured: Boolean(item.featured),
      isActive: true,
    },
    create: {
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      brand: item.brand || null,
      categoryId: category.id,
      isFeatured: Boolean(item.featured),
      isActive: true,
    },
  });

  const sku = item.id;
  await prisma.productVariant.upsert({
    where: { sku },
    update: {
      productId: product.id,
      color: item.colors[0] || null,
      size: item.sizes[0] || null,
      price: item.price,
      compareAt: item.compareAtPrice,
      stock: item.stock,
    },
    create: {
      id: `${item.id}-default`,
      productId: product.id,
      sku,
      color: item.colors[0] || null,
      size: item.sizes[0] || null,
      price: item.price,
      compareAt: item.compareAtPrice,
      stock: item.stock,
    },
  });

  const images = item.images?.length ? item.images : [item.image];

  await prisma.productImage.updateMany({
    where: { productId: product.id },
    data: { isPrimary: false },
  });
  await prisma.productImage.deleteMany({
    where: {
      productId: product.id,
      url: { in: images },
    },
  });
  await prisma.productImage.createMany({
    data: images.map((url, index) => ({
      productId: product.id,
      url,
      altText: item.name,
      isPrimary: index === 0,
      sortOrder: index,
    })),
  });

  return product;
};

const main = async () => {
  const { products, categories } = loadCatalog();
  const categoryMap = await upsertCategories(products, categories);

  for (const product of products) {
    const category = categoryMap.get(product.category);
    await upsertProduct(product, category);
  }

  console.log(
    `Seeded ${products.length} products with numbered /products/1.jpg images.`,
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
