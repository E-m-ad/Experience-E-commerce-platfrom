import { useCart } from "../context/CartContext";
import { formatPrice } from "../utils/formatPrice";

export default function CartDrawer({ navigate }) {
  const {
    items,
    subtotal,
    tax,
    shipping,
    total,
    isCartOpen,
    closeCart,
    incrementItem,
    decrementItem,
    removeItem,
  } = useCart();

  const goToCheckout = () => {
    closeCart();
    navigate("/checkout");
  };

  return (
    <>
      {isCartOpen ? (
        <button
          aria-label="Close cart overlay"
          className="overlay"
          onClick={closeCart}
          type="button"
        />
      ) : null}
      <aside
        aria-hidden={!isCartOpen}
        aria-label="Shopping cart"
        className={`cart-drawer ${isCartOpen ? "open" : ""}`}
      >
        <div className="cart-drawer__header">
          <h2 className="cart-drawer__title">My Cart</h2>
          <button
            aria-label="Close cart"
            className="btn btn-outline btn-icon"
            onClick={closeCart}
            type="button"
          >
            &times;
          </button>
        </div>

        <div className="cart-drawer__body">
          {items.length === 0 ? (
            <div className="cart-drawer__empty">
              <p>Your cart is empty.</p>
              <button
                className="btn btn-outline"
                onClick={() => {
                  closeCart();
                  navigate("/shop");
                }}
                type="button"
              >
                Continue shopping
              </button>
            </div>
          ) : (
            items.map((item) => (
              <article className="cart-item" key={item.id}>
                <button
                  className="cart-item__image-button"
                  onClick={() => {
                    closeCart();
                    navigate(`/product/${item.slug}`);
                  }}
                  type="button"
                >
                  <img
                    alt={item.name}
                    className="cart-item__image"
                    src={item.image}
                  />
                </button>
                <div>
                  <div className="cart-item__top">
                    <div>
                      <h3 className="cart-item__name">{item.name}</h3>
                      <p className="cart-item__variant">
                        {item.color} / {item.size}
                      </p>
                    </div>
                    <button
                      aria-label={`Remove ${item.name}`}
                      className="cart-item__remove"
                      onClick={() => removeItem(item.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="cart-item__footer">
                    <div className="qty-stepper">
                      <button
                        aria-label={`Decrease quantity of ${item.name}`}
                        onClick={() => decrementItem(item.id)}
                        type="button"
                      >
                        -
                      </button>
                      <span className="qty-stepper__value">
                        {item.quantity}
                      </span>
                      <button
                        aria-label={`Increase quantity of ${item.name}`}
                        onClick={() => incrementItem(item.id)}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                    <span className="cart-item__price">
                      {formatPrice(item.price * item.quantity, item.currency)}
                    </span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="cart-drawer__footer">
          <div className="cart-drawer__summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="cart-drawer__summary-row">
            <span>Shipping</span>
            <span>{shipping ? formatPrice(shipping) : "Free"}</span>
          </div>
          <div className="cart-drawer__summary-row">
            <span>Tax</span>
            <span>{formatPrice(tax)}</span>
          </div>
          <div className="cart-drawer__summary-row total">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
          <button
            className="btn btn-primary btn-full"
            disabled={!items.length}
            onClick={goToCheckout}
            type="button"
          >
            Checkout
          </button>
        </div>
      </aside>
    </>
  );
}
