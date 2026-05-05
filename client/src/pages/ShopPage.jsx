import { useMemo, useState } from "react";
import ProductCard from "../components/ProductCard";
import useProducts from "../hooks/useProducts";

const defaultFilters = {
  query: "",
  category: "All",
  brand: "All",
  sort: "featured",
  minPrice: "",
  maxPrice: "",
};

const filtersFromSearch = (search) => {
  const params = new URLSearchParams(search);

  return {
    ...defaultFilters,
    query: params.get("q") || "",
    category: params.get("category") || "All",
    brand: params.get("brand") || "All",
    sort: params.get("sort") || "featured",
  };
};

export default function ShopPage({ navigate, search }) {
  const initialFilters = useMemo(() => filtersFromSearch(search), [search]);
  const [filters, setFilters] = useState(initialFilters);
  const { brands, categories, error, isLoading, products } =
    useProducts(filters);

  const updateFilter = (key, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
  };

  return (
    <section className="section">
      <div className="container">
        <div className="page-header">
          <div>
            <p className="eyebrow">Catalog</p>
            <h1>Shop all products</h1>
          </div>
          <p>{isLoading ? "Loading" : `${products.length} products`}</p>
        </div>

        <div className="shop-toolbar">
          <input
            className="form-input"
            onChange={(event) => updateFilter("query", event.target.value)}
            placeholder="Search catalog"
            type="search"
            value={filters.query}
          />
          <select
            className="form-select"
            onChange={(event) => updateFilter("sort", event.target.value)}
            value={filters.sort}
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="rating">Top rated</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>

        <div className="shop-layout">
          <aside className="filter-sidebar">
            <div className="filter-group">
              <h2 className="filter-group__title">Category</h2>
              <div className="filter-group__list">
                {categories.map((category) => (
                  <label
                    className={`filter-option ${
                      filters.category === category.value ? "active" : ""
                    }`}
                    key={category.value}
                  >
                    <input
                      checked={filters.category === category.value}
                      name="category"
                      onChange={() => updateFilter("category", category.value)}
                      type="radio"
                    />
                    {category.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <h2 className="filter-group__title">Brand</h2>
              <div className="filter-group__list">
                {brands.map((brand) => (
                  <label
                    className={`filter-option ${
                      filters.brand === brand ? "active" : ""
                    }`}
                    key={brand}
                  >
                    <input
                      checked={filters.brand === brand}
                      name="brand"
                      onChange={() => updateFilter("brand", brand)}
                      type="radio"
                    />
                    {brand}
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <h2 className="filter-group__title">Price</h2>
              <div className="price-range">
                <input
                  className="form-input"
                  min="0"
                  onChange={(event) =>
                    updateFilter("minPrice", event.target.value)
                  }
                  placeholder="Min"
                  type="number"
                  value={filters.minPrice}
                />
                <input
                  className="form-input"
                  min="0"
                  onChange={(event) =>
                    updateFilter("maxPrice", event.target.value)
                  }
                  placeholder="Max"
                  type="number"
                  value={filters.maxPrice}
                />
              </div>
            </div>

            <button
              className="btn btn-outline btn-full"
              onClick={() => setFilters(defaultFilters)}
              type="button"
            >
              Reset filters
            </button>
          </aside>

          <div>
            {isLoading ? (
              <div className="empty-state">
                <h2>Loading catalog</h2>
              </div>
            ) : error ? (
              <div className="empty-state">
                <h2>Could not load products</h2>
                <p>{error}</p>
              </div>
            ) : products.length ? (
              <div className="product-grid">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    navigate={navigate}
                    product={product}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h2>No products found</h2>
                <p>Try adjusting your search or clearing the filters.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setFilters(defaultFilters)}
                  type="button"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
