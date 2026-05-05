import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const navItems = [
  { label: "Shop", href: "/shop" },
  { label: "Newest", href: "/shop?sort=newest" },
  { label: "Sale", href: "/shop?sort=price-asc" },
];

function NavLink({ children, currentPath, href, navigate }) {
  const isActive =
    currentPath === href || (href === "/shop" && currentPath === "/shop");

  const handleClick = (event) => {
    event.preventDefault();
    navigate(href);
  };

  return (
    <a className={isActive ? "active" : ""} href={href} onClick={handleClick}>
      {children}
    </a>
  );
}

export default function Navbar({ currentPath, navigate, onOpenSearch }) {
  const { itemCount, openCart } = useCart();
  const { isAdmin, isAuthenticated, user } = useAuth();

  const goHome = (event) => {
    event.preventDefault();
    navigate("/");
  };

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <a className="navbar__logo" href="/" onClick={goHome}>
          <span className="logo-mark" aria-hidden="true">
            Ex
          </span>
          <span>Experience</span>
        </a>

        <nav className="navbar__nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              currentPath={currentPath}
              href={item.href}
              key={item.href}
              navigate={navigate}
            >
              {item.label}
            </NavLink>
          ))}
          {isAdmin ? (
            <NavLink
              currentPath={currentPath}
              href="/admin"
              navigate={navigate}
            >
              Admin
            </NavLink>
          ) : null}
        </nav>

        <div className="navbar__actions">
          <button
            aria-label="Search products"
            className="btn btn-outline btn-sm"
            onClick={onOpenSearch}
            type="button"
          >
            Search
          </button>
          <button
            aria-label="Open cart"
            className="btn btn-outline btn-sm navbar__cart-btn"
            onClick={openCart}
            type="button"
          >
            Bag
            {itemCount > 0 ? (
              <span className="navbar__cart-count">{itemCount}</span>
            ) : null}
          </button>
          <button
            className="btn btn-ghost btn-sm navbar__account"
            onClick={() => navigate("/account")}
            type="button"
          >
            {isAuthenticated ? user.name.split(" ")[0] : "Account"}
          </button>
        </div>
      </div>
    </header>
  );
}
