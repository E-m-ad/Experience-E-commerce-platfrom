import ProductCard from "../components/ProductCard";
import { CARD_BACKGROUND } from "../data/products";
import useProducts from "../hooks/useProducts";
import { formatPrice } from "../utils/formatPrice";

function ProductTile({ product, size = "small", navigate }) {
  const href = `/product/${product.slug}`;

  const handleClick = (event) => {
    event.preventDefault();
    navigate(href);
  };

  return (
    <a
      className={`home-tile home-tile--${size} product-scene`}
      href={href}
      onClick={handleClick}
      style={{ "--scene-bg": `url("${CARD_BACKGROUND}")` }}
    >
      <img
        alt={product.name}
        className="product-scene__image"
        src={product.image}
      />
      <span className="home-tile__label">
        <span>{product.name}</span>
        <strong>{formatPrice(product.price, product.currency)}</strong>
      </span>
    </a>
  );
}

export default function HomePage({ navigate }) {
  const { bestSellers, error, featuredProducts, isLoading } = useProducts();
  const heroProducts = featuredProducts.slice(0, 3);
  const carouselProducts = [...bestSellers, ...featuredProducts].slice(0, 8);

  if (isLoading) {
    return (
      <section className="section">
        <div className="container empty-state">
          <p className="eyebrow">Catalog</p>
          <h1>Loading products</h1>
        </div>
      </section>
    );
  }

  if (error || heroProducts.length === 0) {
    return (
      <section className="section">
        <div className="container empty-state">
          <p className="eyebrow">Catalog</p>
          <h1>{error ? "Backend catalog unavailable" : "No products yet"}</h1>
          <p>{error || "Add your first product from the admin dashboard."}</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate(error ? "/account" : "/admin")}
            type="button"
          >
            {error ? "Sign in" : "Open dashboard"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="bg-wave-container" data-purpose="background-decoration">
        <svg
          height="100%"
          preserveAspectRatio="none"
          viewBox="0 0 1440 1000"
          width="100%"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="wave-path"
            d="M-80,220 C180,120 420,580 720,500 C1020,420 1320,760 1880,690"
          ></path>

          <path
            className="wave-path"
            d="M-80,320 C180,220 420,680 720,600 C1020,520 1320,860 1880,790"
            opacity="0.2"
          ></path>
        </svg>
      </div>
      <div className="hero_image"></div>
      <section className="home-grid container">
        {heroProducts.map((product, index) => (
          <ProductTile
            key={product.id}
            navigate={navigate}
            product={product}
            size={index === 0 ? "large" : "small"}
          />
        ))}
      </section>

      <section className="section-sm">
        <div className="container section-heading">
          <div>
            <p className="eyebrow">Featured products</p>
          </div>
          <button
            className="btn btn-outline"
            onClick={() => navigate("/shop")}
            type="button"
          >
            View all
          </button>
        </div>

        <div className="home-carousel" aria-label="Featured product carousel">
          <div className="home-carousel__track">
            {carouselProducts.map((product) => (
              <div className="home-carousel__item" key={product.id}>
                <ProductCard navigate={navigate} product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* <section className="section">
        <div className="container editorial-band">
          <div>
            <p className="eyebrow">Designed for speed</p>
            <h2>Fast browsing, simple choices, and a cart that stays close.</h2>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/shop?sort=rating")}
            type="button"
          >
            Shop best rated
          </button>
        </div>
      </section> */}
    </>
  );
}
