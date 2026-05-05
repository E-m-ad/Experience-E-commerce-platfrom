import { discountPercent, formatPrice } from "../utils/formatPrice";
import { CARD_BACKGROUND } from "../data/products";

export default function ProductCard({ product, navigate }) {
  const href = `/product/${product.slug}`;
  const discount = discountPercent(product.price, product.compareAtPrice);

  const handleNavigate = (event) => {
    if (!navigate) return;

    event.preventDefault();
    navigate(href);
  };

  return (
    <article className="product-card">
      <div
        className="product-card__image-wrap product-scene"
        style={{ "--scene-bg": `url("${CARD_BACKGROUND}")` }}
      >
        <a
          aria-label={`View ${product.name}`}
          className="product-card__image-link"
          href={href}
          onClick={handleNavigate}
        >
          <img
            alt={product.name}
            className="product-scene__image"
            src={product.image}
          />
        </a>
        {product.badge ? (
          <span className="badge badge-dark product-card__badge">
            {product.badge}
          </span>
        ) : null}
        {/* <button
          className="btn btn-primary btn-sm btn-full product-card__quick-add"
          onClick={() => addItem(product)}
          type="button"
        >
          Quick add
        </button> */}
      </div>

      <a href={href} onClick={handleNavigate}>
        <p className="product-card__brand">{product.brand}</p>
        <h3 className="product-card__name">{product.name}</h3>
        <div className="product-card__price">
          <span className="product-card__price-current">
            {formatPrice(product.price, product.currency)}
          </span>
          {product.compareAtPrice ? (
            <>
              <span className="product-card__price-compare">
                {formatPrice(product.compareAtPrice, product.currency)}
              </span>
              <span className="product-card__price-discount">-{discount}%</span>
            </>
          ) : null}
        </div>
      </a>
    </article>
  );
}
