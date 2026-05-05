import { useEffect, useMemo, useState } from "react";
import ProductCard from "../components/ProductCard";
import { useCart } from "../context/CartContext";
import { CARD_BACKGROUND } from "../data/products";
import { getProductBySlug, getRelatedProducts } from "../hooks/useProducts";
import { discountPercent, formatPrice } from "../utils/formatPrice";

export default function ProductPage({ navigate, slug }) {
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { addItem } = useCart();

  useEffect(() => {
    let isMounted = true;

    const loadProduct = async () => {
      setIsLoading(true);
      setError("");

      try {
        const nextProduct = await getProductBySlug(slug);
        const nextRelatedProducts = await getRelatedProducts(nextProduct, 4);

        if (!isMounted) return;

        setProduct(nextProduct);
        setRelatedProducts(nextRelatedProducts);
        setSelectedImage(0);
        setSelectedColor(nextProduct.colors[0] || "");
        setSelectedSize(nextProduct.sizes[0] || "");
      } catch (loadError) {
        if (isMounted) setError(loadError.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const selectedVariant = useMemo(() => {
    if (!product) return null;

    return (
      product.variants.find((variant) => {
        const color = variant.color || "Default";
        const size = variant.size || variant.sku || "One size";
        return color === selectedColor && size === selectedSize;
      }) || product.primaryVariant
    );
  }, [product, selectedColor, selectedSize]);

  if (isLoading) {
    return (
      <section className="section">
        <div className="container empty-state">
          <h1>Loading product</h1>
        </div>
      </section>
    );
  }

  if (error || !product) {
    return (
      <section className="section">
        <div className="container empty-state">
          <h1>Product not found</h1>
          <p>
            {error || "The product you are looking for is not in this catalog."}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/shop")}
            type="button"
          >
            Back to shop
          </button>
        </div>
      </section>
    );
  }

  const variantPrice = Number(selectedVariant?.price || product.price);
  const variantCompareAt = selectedVariant?.compareAt
    ? Number(selectedVariant.compareAt)
    : product.compareAtPrice;
  const variantStock = Number(selectedVariant?.stock || 0);
  const discount = discountPercent(variantPrice, variantCompareAt);
  const productForCart = {
    ...product,
    price: variantPrice,
    compareAtPrice: variantCompareAt,
    stock: variantStock,
    variantId: selectedVariant?.id || product.variantId,
  };

  return (
    <>
      <section className="section">
        <div className="container product-page-card">
          <div className="product-layout">
            <div className="product-gallery">
              <div
                className="product-gallery__main product-scene"
                style={{ "--scene-bg": `url("${CARD_BACKGROUND}")` }}
              >
                <img
                  alt={product.name}
                  className="product-scene__image"
                  src={product.images[selectedImage] || product.image}
                />
              </div>
              <div className="product-gallery__thumbs">
                {product.images.map((image, index) => (
                  <button
                    aria-label={`View image ${index + 1} for ${product.name}`}
                    className={`product-gallery__thumb product-scene ${
                      selectedImage === index ? "active" : ""
                    }`}
                    key={image}
                    onClick={() => setSelectedImage(index)}
                    style={{ "--scene-bg": `url("${CARD_BACKGROUND}")` }}
                    type="button"
                  >
                    <img alt="" src={image} />
                  </button>
                ))}
              </div>
            </div>

            <div className="product-info">
              <p className="product-info__brand">{product.brand}</p>
              <h1 className="product-info__title">{product.name}</h1>
              <div className="product-info__price">
                <span className="product-info__price-current">
                  {formatPrice(variantPrice, product.currency)}
                </span>
                {variantCompareAt ? (
                  <>
                    <span className="product-info__price-compare">
                      {formatPrice(variantCompareAt, product.currency)}
                    </span>
                    <span className="product-info__price-save">
                      Save {discount}%
                    </span>
                  </>
                ) : null}
              </div>

              <p className="product-info__description">{product.description}</p>

              <div className="variant-group">
                <p className="variant-group__label">
                  Color <span>{selectedColor}</span>
                </p>
                <div className="variant-chips">
                  {product.colors.map((color) => (
                    <button
                      className={`variant-chip ${
                        selectedColor === color ? "selected" : ""
                      }`}
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      type="button"
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              <div className="variant-group">
                <p className="variant-group__label">
                  Size <span>{selectedSize}</span>
                </p>
                <div className="variant-chips">
                  {product.sizes.map((size) => (
                    <button
                      className={`variant-chip ${
                        selectedSize === size ? "selected" : ""
                      }`}
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      type="button"
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg btn-full"
                disabled={!variantStock}
                onClick={() =>
                  addItem(productForCart, {
                    color: selectedColor,
                    size: selectedSize,
                    variantId: selectedVariant?.id,
                  })
                }
                type="button"
              >
                {variantStock ? "Add to cart" : "Out of stock"}
              </button>

              <div className="product-info__details">
                <div>
                  <span>Availability</span>
                  <strong>{variantStock} in stock</strong>
                </div>
                <div>
                  <span>Category</span>
                  <strong>{product.category}</strong>
                </div>
              </div>

              <ul className="product-bullets">
                {product.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {relatedProducts.length ? (
        <section className="section-sm">
          <div className="container section-heading">
            <div>
              <p className="eyebrow">Related products</p>
              <h2>More from the same shelf</h2>
            </div>
          </div>
          <div className="container product-grid">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard
                key={relatedProduct.id}
                navigate={navigate}
                product={relatedProduct}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
