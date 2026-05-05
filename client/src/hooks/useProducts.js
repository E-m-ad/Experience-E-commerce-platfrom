import { useEffect, useMemo, useState } from "react";
import {
  brands as fallbackBrandList,
  categories as fallbackCategoryList,
  products as fallbackProductList,
} from "../data/products";
import api from "../utils/api";
import { normalizeProduct, normalizeProducts } from "../utils/productMapper";
import slugify from "../utils/slugify";

const sortMap = {
  featured: "newest",
  newest: "newest",
  rating: "rating",
  "price-asc": "price_asc",
  "price-desc": "price_desc",
};

const buildProductQuery = ({
  query = "",
  category = "All",
  brand = "All",
  sort = "featured",
  minPrice = "",
  maxPrice = "",
  limit = 100,
} = {}) => {
  const params = new URLSearchParams({
    page: "1",
    limit: String(limit),
    sort: sortMap[sort] || sort,
  });

  if (query) params.set("q", query);
  if (category && category !== "All") params.set("category", category);
  if (brand && brand !== "All") params.set("brand", brand);
  if (minPrice) params.set("minPrice", minPrice);
  if (maxPrice) params.set("maxPrice", maxPrice);

  return params.toString();
};

const staticCatalog = fallbackProductList.map((product) => {
  const primaryVariant = {
    id: `${product.id}-default`,
    sku: product.id,
    color: product.colors[0] || null,
    material: null,
    size: product.sizes[0] || null,
    price: product.price,
    compareAt: product.compareAtPrice,
    stock: product.stock,
  };

  return {
    ...product,
    raw: product,
    categoryId: slugify(product.category),
    categorySlug: slugify(product.category),
    isActive: true,
    isFeatured: Boolean(product.featured),
    primaryVariant,
    variantId: primaryVariant.id,
    variants: [primaryVariant],
  };
});

const staticCategoryOptions = fallbackCategoryList.map((category) => ({
  label: category,
  value: category === "All" ? "All" : slugify(category),
}));

const staticBrandOptions = fallbackBrandList;

const applyStaticFilters = ({
  query = "",
  category = "All",
  brand = "All",
  sort = "featured",
  minPrice = "",
  maxPrice = "",
  limit = 100,
} = {}) => {
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = staticCatalog.filter((product) => {
    const matchesQuery =
      !normalizedQuery ||
      `${product.name} ${product.brand} ${product.category} ${product.description}`
        .toLowerCase()
        .includes(normalizedQuery);
    const matchesCategory =
      !category ||
      category === "All" ||
      product.category === category ||
      product.categorySlug === category;
    const matchesBrand = !brand || brand === "All" || product.brand === brand;
    const matchesMinPrice = !minPrice || product.price >= Number(minPrice);
    const matchesMaxPrice = !maxPrice || product.price <= Number(maxPrice);

    return (
      matchesQuery &&
      matchesCategory &&
      matchesBrand &&
      matchesMinPrice &&
      matchesMaxPrice
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "price-asc":
      case "price_asc":
        return a.price - b.price;
      case "price-desc":
      case "price_desc":
        return b.price - a.price;
      case "rating":
        return b.rating - a.rating;
      case "featured":
        return Number(b.featured) - Number(a.featured);
      case "newest":
      default:
        return 0;
    }
  });

  return sorted.slice(0, limit);
};

const featuredStaticProducts = staticCatalog
  .filter((product) => product.featured)
  .slice(0, 8);

const bestSellerStaticProducts = staticCatalog
  .filter((product) => product.bestSeller)
  .slice(0, 8);

export const getAllProducts = async () => {
  try {
    const data = await api.get("/products?limit=100");
    const products = normalizeProducts(data.products);
    return products.length ? products : applyStaticFilters();
  } catch {
    return applyStaticFilters();
  }
};

export const getProductBySlug = async (slug) => {
  try {
    const data = await api.get(`/products/${encodeURIComponent(slug)}`);
    return normalizeProduct(data.product);
  } catch (error) {
    const product = staticCatalog.find((candidate) => candidate.slug === slug);
    if (product) return product;
    throw error;
  }
};

export const getRelatedProducts = async (product, limit = 4) => {
  if (!product?.categorySlug) return [];
  const staticRelatedProducts = staticCatalog
    .filter(
      (candidate) =>
        candidate.id !== product.id &&
        candidate.categorySlug === product.categorySlug,
    )
    .slice(0, limit);

  const params = new URLSearchParams({
    category: product.categorySlug,
    limit: String(limit + 1),
  });
  try {
    const data = await api.get(`/products?${params.toString()}`);
    const relatedProducts = normalizeProducts(data.products)
      .filter((candidate) => candidate.id !== product.id)
      .slice(0, limit);

    return relatedProducts.length ? relatedProducts : staticRelatedProducts;
  } catch {
    return staticRelatedProducts;
  }
};

export const searchProducts = async (query, limit = 8) => {
  try {
    if (!query) {
      const data = await api.get(`/products?limit=${limit}`);
      const products = normalizeProducts(data.products);
      return products.length
        ? products
        : applyStaticFilters({ limit });
    }

    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const data = await api.get(`/products/search?${params.toString()}`);
    const products = normalizeProducts(data.products);
    return products.length
      ? products
      : applyStaticFilters({ query, limit });
  } catch {
    return applyStaticFilters({ query, limit });
  }
};

export default function useProducts(filters = {}) {
  const {
    query = "",
    category = "All",
    brand = "All",
    sort = "featured",
    minPrice = "",
    maxPrice = "",
  } = filters;
  const queryString = useMemo(
    () =>
      buildProductQuery({
        query,
        category,
        brand,
        sort,
        minPrice,
        maxPrice,
      }),
    [brand, category, maxPrice, minPrice, query, sort],
  );
  const fallbackFilters = useMemo(
    () => ({
      query,
      category,
      brand,
      sort,
      minPrice,
      maxPrice,
    }),
    [brand, category, maxPrice, minPrice, query, sort],
  );
  const [state, setState] = useState({
    products: [],
    allProducts: [],
    featuredProducts: [],
    bestSellers: [],
    categories: [{ label: "All", value: "All" }],
    brands: ["All"],
    isLoading: true,
    error: "",
  });

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      setState((current) => ({ ...current, isLoading: true, error: "" }));

      try {
        const [productData, featuredData, categoryData, brandData] =
          await Promise.all([
            api.get(`/products?${queryString}`),
            api.get("/products/featured"),
            api.get("/categories"),
            api.get("/products/brands"),
          ]);

        if (!isMounted) return;

        const products = normalizeProducts(productData.products);
        const featuredProducts = normalizeProducts(featuredData.products);
        const fallbackProducts = applyStaticFilters(fallbackFilters);
        const visibleProducts = products.length ? products : fallbackProducts;
        const bestSellers = visibleProducts.filter(
          (product) => product.bestSeller,
        );
        const categories =
          categoryData.categories?.length > 0
            ? [
                { label: "All", value: "All" },
                ...categoryData.categories.map((category) => ({
                  label: category.name,
                  value: category.slug,
                })),
              ]
            : staticCategoryOptions;
        const brands =
          brandData.brands?.length > 0
            ? ["All", ...brandData.brands]
            : staticBrandOptions;

        setState({
          products: visibleProducts,
          allProducts: visibleProducts,
          featuredProducts:
            featuredProducts.length > 0
              ? featuredProducts
              : featuredStaticProducts,
          bestSellers:
            bestSellers.length > 0
              ? bestSellers
              : bestSellerStaticProducts,
          categories,
          brands,
          isLoading: false,
          error: "",
        });
      } catch {
        if (!isMounted) return;
        const products = applyStaticFilters(fallbackFilters);
        setState({
          products,
          allProducts: products,
          featuredProducts: featuredStaticProducts,
          bestSellers: bestSellerStaticProducts,
          categories: staticCategoryOptions,
          brands: staticBrandOptions,
          isLoading: false,
          error: "",
        });
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [fallbackFilters, queryString]);

  return state;
}
