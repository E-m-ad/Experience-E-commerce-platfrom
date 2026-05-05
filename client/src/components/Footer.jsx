import { categories } from "../data/products";

export default function Footer({ navigate }) {
  const currentYear = new Date().getFullYear();

  const handleNavigate = (event, href) => {
    event.preventDefault();
    navigate(href);
  };

  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <div className="footer__brand">EXPERIENCE</div>
          <p className="footer__tagline">
            A compact commerce storefront inspired by Vercel Commerce, tuned for
            a fast product browsing flow.
          </p>
        </div>

        <div>
          <h3 className="footer__col-title">Shop</h3>
          <div className="footer__links">
            {categories.slice(1).map((category) => (
              <a
                href={`/shop?category=${category}`}
                key={category}
                onClick={(event) =>
                  handleNavigate(event, `/shop?category=${category}`)
                }
              >
                {category}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="footer__col-title">Store</h3>
          <div className="footer__links">
            <a href="/shop" onClick={(event) => handleNavigate(event, "/shop")}>
              All products
            </a>
            <a
              href="/account"
              onClick={(event) => handleNavigate(event, "/account")}
            >
              Account
            </a>
            <a
              href="/checkout"
              onClick={(event) => handleNavigate(event, "/checkout")}
            >
              Checkout
            </a>
          </div>
        </div>

        <div>
          <h3 className="footer__col-title">Contact</h3>
          <div className="footer__links">
            <a href="mailto:hello@acme.store">hello@acme.store</a>
            <a href="tel:+201000000000">+20 100 000 0000</a>
          </div>
        </div>
      </div>

      <div className="container footer__bottom">
        <p>&copy; {currentYear} ACME. All rights reserved.</p>
        <p>Built with React and Vite.</p>
      </div>
    </footer>
  );
}
