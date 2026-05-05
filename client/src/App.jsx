import { useCallback, useEffect, useMemo, useState } from "react";
import CartDrawer from "./components/CartDrawer";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import SearchModal from "./components/SearchModal";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import AccountPage from "./pages/AccountPage";
import AdminDashboard from "./pages/AdminDashboard";
import CheckoutPage from "./pages/CheckoutPage";
import HomePage from "./pages/HomePage";
import ProductPage from "./pages/ProductPage";
import ShopPage from "./pages/ShopPage";

const getCurrentLocation = () => ({
  pathname: window.location.pathname,
  search: window.location.search,
});

function NotFoundPage({ navigate }) {
  return (
    <section className="section">
      <div className="container empty-state">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The storefront route you opened does not exist.</p>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/")}
          type="button"
        >
          Back home
        </button>
      </div>
    </section>
  );
}

function Storefront() {
  const [location, setLocation] = useState(getCurrentLocation);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const navigate = useCallback((href) => {
    if (!href) return;

    if (/^https?:\/\//.test(href)) {
      window.location.assign(href);
      return;
    }

    window.history.pushState({}, "", href);
    setLocation(getCurrentLocation());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const handlePopState = () => setLocation(getCurrentLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const page = useMemo(() => {
    const { pathname, search } = location;

    if (pathname === "/") {
      return <HomePage navigate={navigate} />;
    }

    if (pathname === "/shop") {
      return <ShopPage key={search} navigate={navigate} search={search} />;
    }

    if (pathname.startsWith("/product/")) {
      const slug = decodeURIComponent(pathname.replace("/product/", ""));
      return <ProductPage key={slug} navigate={navigate} slug={slug} />;
    }

    if (pathname === "/checkout") {
      return <CheckoutPage navigate={navigate} />;
    }

    if (pathname === "/account" || pathname === "/login") {
      return <AccountPage navigate={navigate} search={search} />;
    }

    if (pathname === "/admin") {
      return <AdminDashboard navigate={navigate} />;
    }

    return <NotFoundPage navigate={navigate} />;
  }, [location, navigate]);

  const currentPath = `${location.pathname}${location.search}`;

  return (
    <>
      <Navbar
        currentPath={currentPath}
        navigate={navigate}
        onOpenSearch={() => setIsSearchOpen(true)}
      />
      <main className="page-wrapper">{page}</main>
      <Footer navigate={navigate} />
      <CartDrawer navigate={navigate} />
      <SearchModal
        isOpen={isSearchOpen}
        navigate={navigate}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <Storefront />
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
