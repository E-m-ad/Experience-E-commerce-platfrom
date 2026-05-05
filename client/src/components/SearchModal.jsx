import { useEffect, useRef, useState } from "react";
import { CARD_BACKGROUND } from "../data/products";
import { searchProducts } from "../hooks/useProducts";
import { formatPrice } from "../utils/formatPrice";

export default function SearchModal({ isOpen, navigate, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    inputRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    let isMounted = true;

    const loadResults = async () => {
      setIsLoading(true);
      try {
        const products = await searchProducts(query || "", 7);
        if (isMounted) setResults(products);
      } catch {
        if (isMounted) setResults([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadResults();

    return () => {
      isMounted = false;
    };
  }, [isOpen, query]);

  if (!isOpen) return null;

  const openProduct = (product) => {
    onClose();
    setQuery("");
    navigate(`/product/${product.slug}`);
  };

  return (
    <div
      className="search-modal__backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        aria-label="Search products"
        className="search-modal__box"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form
          className="search-modal__input-wrap"
          onSubmit={(event) => event.preventDefault()}
          role="search"
        >
          <label className="search-modal__label" htmlFor="global-search">
            Search
          </label>
          <input
            aria-label="Search products"
            autoComplete="off"
            className="form-input search-modal__input"
            id="global-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search catalog"
            ref={inputRef}
            type="search"
            value={query}
          />
          {query ? (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setQuery("")}
              type="button"
            >
              Clear
            </button>
          ) : null}
          <button
            aria-label="Close search"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            type="button"
          >
            &times;
          </button>
        </form>

        <div className="search-modal__results">
          {isLoading ? (
            <p className="search-modal__empty">Searching...</p>
          ) : results.length ? (
            results.map((product) => (
              <button
                className="search-result-item"
                key={product.id}
                onClick={() => openProduct(product)}
                type="button"
              >
                <span
                  className="search-result-item__image product-scene"
                  style={{ "--scene-bg": `url("${CARD_BACKGROUND}")` }}
                >
                  <img alt={product.name} src={product.image} />
                </span>
                <span>
                  <span className="search-result-item__name">
                    {product.name}
                  </span>
                  <span className="search-result-item__price">
                    {product.brand} / {formatPrice(product.price)}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="search-modal__empty">No products found.</p>
          )}
        </div>
      </section>
    </div>
  );
}
