import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../utils/api";
import { formatPrice } from "../utils/formatPrice";
import { absoluteAssetUrl } from "../utils/productMapper";

const initialLoginForm = {
  email: "",
  password: "",
};

const initialRegisterForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
};

const nextFromSearch = (search = "") => {
  const next = new URLSearchParams(search).get("next");
  return next?.startsWith("/") ? next : "";
};

const canCancelOrder = (status) => ["PENDING", "CONFIRMED"].includes(status);

export default function AccountPage({ navigate, search }) {
  const {
    isAdmin,
    isAuthenticated,
    isLoading,
    login,
    logout,
    register,
    user,
  } = useAuth();
  const toast = useToast();
  const nextPath = nextFromSearch(search);
  const [mode, setMode] = useState("login");
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [orders, setOrders] = useState([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsOrdersLoading(true);
    setOrdersError("");

    try {
      const data = await api.get("/orders/my-orders?limit=20");
      setOrders(data.orders || []);
    } catch (loadError) {
      setOrdersError(loadError.message);
    } finally {
      setIsOrdersLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadOrders();
      return;
    }

    setOrders([]);
  }, [isAuthenticated, loadOrders]);

  const orderStats = useMemo(() => {
    const totalSpent = orders.reduce(
      (total, order) => total + Number(order.total || 0),
      0,
    );
    const pending = orders.filter((order) => order.status !== "DELIVERED")
      .length;

    return { totalSpent, pending, total: orders.length };
  }, [orders]);

  const updateLoginForm = (key, value) => {
    setLoginForm((currentForm) => ({ ...currentForm, [key]: value }));
  };

  const updateRegisterForm = (key, value) => {
    setRegisterForm((currentForm) => ({ ...currentForm, [key]: value }));
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const nextUser = await login(loginForm);
      toast.success(`Welcome, ${nextUser.name}`);
      if (nextPath) navigate(nextPath);
      else if (nextUser.role === "ADMIN") navigate("/admin");
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRegister = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const nextUser = await register(registerForm);
      toast.success(`Welcome, ${nextUser.name}`);
      setRegisterForm(initialRegisterForm);
      if (nextPath) navigate(nextPath);
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelOrder = async (order) => {
    try {
      const data = await api.post(`/orders/${order.id}/cancel`, {});
      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === order.id ? data.order : currentOrder,
        ),
      );
      toast.info("Order cancelled");
    } catch (cancelError) {
      toast.error(cancelError.message);
    }
  };

  if (isLoading) {
    return (
      <section className="section">
        <div className="container empty-state">
          <h1>Loading account</h1>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="section">
        <div className="container account-shell">
          <div>
            <p className="eyebrow">Account</p>
            <h1>Sign in to continue</h1>
            <p className="muted">
              Use your store account to manage orders and admin inventory.
            </p>
          </div>

          <div className="account-card">
            <div className="auth-tabs">
              <button
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                type="button"
              >
                Sign in
              </button>
              <button
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
                type="button"
              >
                Create account
              </button>
            </div>

            {error ? <p className="form-error">{error}</p> : null}

            {mode === "login" ? (
              <form className="account-form" onSubmit={submitLogin}>
                <label className="form-group">
                  <span className="form-label">Email</span>
                  <input
                    className="form-input"
                    onChange={(event) =>
                      updateLoginForm("email", event.target.value)
                    }
                    required
                    type="email"
                    value={loginForm.email}
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Password</span>
                  <input
                    className="form-input"
                    minLength="8"
                    onChange={(event) =>
                      updateLoginForm("password", event.target.value)
                    }
                    required
                    type="password"
                    value={loginForm.password}
                  />
                </label>
                <button
                  className="btn btn-primary btn-full"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Signing in" : "Sign in"}
                </button>
              </form>
            ) : (
              <form className="account-form" onSubmit={submitRegister}>
                <div className="form-grid">
                  <label className="form-group">
                    <span className="form-label">First name</span>
                    <input
                      className="form-input"
                      onChange={(event) =>
                        updateRegisterForm("firstName", event.target.value)
                      }
                      required
                      type="text"
                      value={registerForm.firstName}
                    />
                  </label>
                  <label className="form-group">
                    <span className="form-label">Last name</span>
                    <input
                      className="form-input"
                      onChange={(event) =>
                        updateRegisterForm("lastName", event.target.value)
                      }
                      required
                      type="text"
                      value={registerForm.lastName}
                    />
                  </label>
                </div>
                <label className="form-group">
                  <span className="form-label">Email</span>
                  <input
                    className="form-input"
                    onChange={(event) =>
                      updateRegisterForm("email", event.target.value)
                    }
                    required
                    type="email"
                    value={registerForm.email}
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Password</span>
                  <input
                    className="form-input"
                    minLength="8"
                    onChange={(event) =>
                      updateRegisterForm("password", event.target.value)
                    }
                    required
                    type="password"
                    value={registerForm.password}
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Phone</span>
                  <input
                    className="form-input"
                    onChange={(event) =>
                      updateRegisterForm("phone", event.target.value)
                    }
                    type="tel"
                    value={registerForm.phone}
                  />
                </label>
                <button
                  className="btn btn-primary btn-full"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Creating account" : "Create account"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container account-shell">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Hello, {user.name}</h1>
          <p className="muted">{user.email}</p>
          <span className="badge badge-outline account-role">{user.role}</span>
          <div className="account-actions">
            <button
              className="btn btn-primary"
              onClick={() => navigate("/shop")}
              type="button"
            >
              Shop products
            </button>
            {isAdmin ? (
              <button
                className="btn btn-outline"
                onClick={() => navigate("/admin")}
                type="button"
              >
                Admin dashboard
              </button>
            ) : null}
            <button
              className="btn btn-outline"
              onClick={async () => {
                await logout();
                toast.info("Signed out");
              }}
              type="button"
            >
              Sign out
            </button>
          </div>

          <div className="account-card account-orders">
            <div className="account-section-header">
              <div>
                <p className="eyebrow">Orders</p>
                <h2>Ordered items</h2>
              </div>
              <button
                className="btn btn-outline btn-sm"
                disabled={isOrdersLoading}
                onClick={loadOrders}
                type="button"
              >
                Refresh
              </button>
            </div>

            {isOrdersLoading ? (
              <p className="muted">Loading orders</p>
            ) : ordersError ? (
              <p className="form-error">{ordersError}</p>
            ) : orders.length ? (
              <div className="order-history">
                {orders.map((order) => (
                  <article className="order-card" key={order.id}>
                    <div className="order-card__header">
                      <div>
                        <strong>#{order.id.slice(0, 8)}</strong>
                        <span>
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="badge badge-outline">
                        {order.status}
                      </span>
                    </div>
                    <div className="order-card__items">
                      {order.items.map((item) => (
                        <div className="order-card__item" key={item.id}>
                          <img
                            alt={item.product?.name || "Product"}
                            src={absoluteAssetUrl(
                              item.product?.images?.[0]?.url,
                            )}
                          />
                          <div>
                            <strong>{item.product?.name}</strong>
                            <span>
                              {item.quantity} x{" "}
                              {formatPrice(Number(item.unitPrice))}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="order-card__footer">
                      <strong>{formatPrice(Number(order.total))}</strong>
                      {canCancelOrder(order.status) ? (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => cancelOrder(order)}
                          type="button"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state account-empty">
                <h2>No orders yet</h2>
                <p>Your confirmed orders will appear here.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate("/shop")}
                  type="button"
                >
                  Shop products
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="account-card">
          <h2>Profile</h2>
          <div className="account-stat">
            <span>Name</span>
            <strong>{user.name}</strong>
          </div>
          <div className="account-stat">
            <span>Email</span>
            <strong>{user.email}</strong>
          </div>
          <div className="account-stat">
            <span>Role</span>
            <strong>{user.role}</strong>
          </div>
          <div className="account-stat">
            <span>Orders</span>
            <strong>{orderStats.total}</strong>
          </div>
          <div className="account-stat">
            <span>Open orders</span>
            <strong>{orderStats.pending}</strong>
          </div>
          <div className="account-stat">
            <span>Total spent</span>
            <strong>{formatPrice(orderStats.totalSpent)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
