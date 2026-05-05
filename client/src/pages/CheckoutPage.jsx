import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import api from "../utils/api";
import { formatPrice } from "../utils/formatPrice";

const initialForm = {
  name: "",
  email: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  phone: "",
  paymentMethod: "CASH_ON_DELIVERY",
  notes: "",
};

export default function CheckoutPage({ navigate }) {
  const { clearCart, items, shipping, subtotal, tax, total } = useCart();
  const { isAuthenticated, isLoading, user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(initialForm);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;

    setForm((currentForm) => ({
      ...currentForm,
      name: currentForm.name || user.name || "",
      email: currentForm.email || user.email || "",
      phone: currentForm.phone || user.phone || "",
    }));
  }, [user]);

  const updateForm = (key, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const submitOrder = async (event) => {
    event.preventDefault();

    if (!isAuthenticated) {
      navigate("/account?next=/checkout");
      return;
    }

    if (!items.length) {
      toast.error("Your cart is empty");
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await api.post("/orders", {
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        shippingAddress: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          street: form.address,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          country: "EG",
        },
        paymentMethod: form.paymentMethod,
        notes: form.notes,
      });

      setPlacedOrder(data.order);
      await clearCart();
      setForm(initialForm);
      toast.success("Order placed");
    } catch (submitError) {
      toast.error(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="section">
        <div className="container empty-state">
          <h1>Loading checkout</h1>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="section">
        <div className="container empty-state">
          <p className="eyebrow">Checkout</p>
          <h1>Sign in to place your order</h1>
          <p>
            Your cart can wait here. Sign in so we can save the order to your
            profile and keep the admin workflow accurate.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/account?next=/checkout")}
            type="button"
          >
            Sign in
          </button>
        </div>
      </section>
    );
  }

  if (placedOrder) {
    const orderTotal = Number(placedOrder.total || total);
    const orderItems = placedOrder.items || [];

    return (
      <section className="section">
        <div className="container checkout-success">
          <p className="eyebrow">Order confirmed</p>
          <h1>{placedOrder.id}</h1>
          <p>
            We received your order for {orderItems.length} item
            {orderItems.length === 1 ? "" : "s"} totaling{" "}
            {formatPrice(orderTotal)}.
          </p>
          <div className="checkout-success__actions">
            <button
              className="btn btn-primary"
              onClick={() => navigate("/shop")}
              type="button"
            >
              Continue shopping
            </button>
            <button
              className="btn btn-outline"
              onClick={() => navigate("/account")}
              type="button"
            >
              View account
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <div className="page-header">
          <div>
            <p className="eyebrow">Checkout</p>
            <h1>Complete your order</h1>
          </div>
        </div>

        <div className="checkout-layout">
          <form className="checkout-form" onSubmit={submitOrder}>
            <div className="form-grid">
              <label className="form-group">
                <span className="form-label">Full name</span>
                <input
                  className="form-input"
                  onChange={(event) => updateForm("name", event.target.value)}
                  required
                  type="text"
                  value={form.name}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Email</span>
                <input
                  className="form-input"
                  onChange={(event) => updateForm("email", event.target.value)}
                  required
                  type="email"
                  value={form.email}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Phone</span>
                <input
                  className="form-input"
                  onChange={(event) => updateForm("phone", event.target.value)}
                  required
                  type="tel"
                  value={form.phone}
                />
              </label>
              <label className="form-group">
                <span className="form-label">City</span>
                <input
                  className="form-input"
                  onChange={(event) => updateForm("city", event.target.value)}
                  required
                  type="text"
                  value={form.city}
                />
              </label>
              <label className="form-group">
                <span className="form-label">State</span>
                <input
                  className="form-input"
                  onChange={(event) => updateForm("state", event.target.value)}
                  required
                  type="text"
                  value={form.state}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Postal code</span>
                <input
                  className="form-input"
                  onChange={(event) =>
                    updateForm("postalCode", event.target.value)
                  }
                  required
                  type="text"
                  value={form.postalCode}
                />
              </label>
            </div>
            <label className="form-group">
              <span className="form-label">Shipping address</span>
              <textarea
                className="form-input form-textarea"
                onChange={(event) => updateForm("address", event.target.value)}
                required
                value={form.address}
              />
            </label>
            <div className="form-grid">
              <label className="form-group">
                <span className="form-label">Payment</span>
                <select
                  className="form-select"
                  onChange={(event) =>
                    updateForm("paymentMethod", event.target.value)
                  }
                  value={form.paymentMethod}
                >
                  <option value="CASH_ON_DELIVERY">Cash on delivery</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                </select>
              </label>
              <label className="form-group">
                <span className="form-label">Order note</span>
                <input
                  className="form-input"
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Optional"
                  type="text"
                  value={form.notes}
                />
              </label>
            </div>
            <button
              className="btn btn-primary btn-lg btn-full"
              disabled={!items.length || isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Placing order" : "Place order"}
            </button>
          </form>

          <aside className="order-summary">
            <h2>Order summary</h2>
            {items.length ? (
              <div className="order-summary__items">
                {items.map((item) => (
                  <div className="order-summary__item" key={item.id}>
                    <img alt={item.name} src={item.image} />
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.quantity} x {formatPrice(item.price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Your cart is empty.</p>
            )}
            <div className="summary-lines">
              <div>
                <span>Subtotal</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <strong>{shipping ? formatPrice(shipping) : "Free"}</strong>
              </div>
              <div>
                <span>Tax</span>
                <strong>{formatPrice(tax)}</strong>
              </div>
              <div className="summary-lines__total">
                <span>Total</span>
                <strong>{formatPrice(total)}</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
