import { CARD_BACKGROUND } from "../data/products";
import { API_ORIGIN } from "./api";

const fallbackImage = CARD_BACKGROUND;

export const absoluteAssetUrl = (url) => {
  if (!url) return fallbackImage;
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith("/uploads")) return `${API_ORIGIN}${url}`;
  return url;
};

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  return Number(value);
};

const uniqueValues = (values, fallback) => {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.length ? unique : [fallback];
};

export const normalizeProduct = (product) => {
  const variants = product?.variants || [];
  const sortedVariants = [...variants].sort(
    (a, b) => Number(a.price || 0) - Number(b.price || 0),
  );
  const primaryVariant = sortedVariants[0] || {};
  const images = (product?.images || [])
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((image) => absoluteAssetUrl(image.url));
  const image = images[0] || fallbackImage;
  const compareAtPrice = numberOrNull(primaryVariant.compareAt);
  const price = Number(primaryVariant.price || 0);
  const stock = variants.reduce(
    (total, variant) => total + Number(variant.stock || 0),
    0,
  );

  return {
    ...product,
    raw: product,
    brand: product.brand || "Experience",
    category: product.category?.name || "Uncategorized",
    categoryId: product.category?.id || product.categoryId || "",
    categorySlug: product.category?.slug || "",
    price,
    compareAtPrice,
    currency: "EGP",
    badge: !product.isActive
      ? "Inactive"
      : product.isFeatured
        ? "Featured"
        : compareAtPrice
          ? "Sale"
          : null,
    featured: Boolean(product.isFeatured),
    bestSeller: Boolean(product._count?.reviews),
    stock,
    rating: product._count?.reviews ? 4.8 : 4.5,
    image,
    images: images.length ? images : [image],
    colors: uniqueValues(variants.map((variant) => variant.color), "Default"),
    sizes: uniqueValues(
      variants.map((variant) => variant.size || variant.sku),
      "One size",
    ),
    details: [
      product.category?.name,
      product.brand,
      primaryVariant.sku ? `SKU ${primaryVariant.sku}` : null,
    ].filter(Boolean),
    variantId: primaryVariant.id,
    primaryVariant,
    variants: sortedVariants,
  };
};

export const normalizeProducts = (products = []) =>
  products.map((product) => normalizeProduct(product));
