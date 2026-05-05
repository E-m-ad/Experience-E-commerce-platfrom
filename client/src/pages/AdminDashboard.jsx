import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../utils/api";
import { formatPrice } from "../utils/formatPrice";
import {
  absoluteAssetUrl,
  normalizeProduct,
  normalizeProducts,
} from "../utils/productMapper";
import slugify from "../utils/slugify";

const emptyForm = {
  id: "",
  variantId: "",
  name: "",
  description: "",
  brand: "",
  categoryId: "",
  sku: "",
  price: "",
  compareAt: "",
  stock: "0",
  color: "",
  size: "",
  material: "",
  isFeatured: false,
  isActive: true,
  imageFiles: [],
};

const orderStatuses = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

const paymentStatuses = ["UNPAID", "PAID", "REFUNDED"];

const customerName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
  user?.email ||
  "Customer";

const productToForm = (product) => {
  const variant = product?.variants?.[0] || {};

  return {
    id: product.id,
    variantId: variant.id || "",
    name: product.name || "",
    description: product.description || "",
    brand: product.brand || "",
    categoryId: product.categoryId || "",
    sku: variant.sku || "",
    price: variant.price ? String(variant.price) : "",
    compareAt: variant.compareAt ? String(variant.compareAt) : "",
    stock: variant.stock !== undefined ? String(variant.stock) : "0",
    color: variant.color || "",
    size: variant.size || "",
    material: variant.material || "",
    isFeatured: Boolean(product.isFeatured),
    isActive: Boolean(product.isActive),
    imageFiles: [],
  };
};

const buildProductPayload = (form) => {
  const payload = new FormData();
  const sku =
    form.sku.trim() ||
    `${slugify(form.brand || "sku")}-${slugify(form.name)}-${Date.now()}`;

  payload.append("name", form.name.trim());
  payload.append("description", form.description.trim());
  payload.append("brand", form.brand.trim());
  payload.append("categoryId", form.categoryId);
  payload.append("isFeatured", String(form.isFeatured));
  payload.append("isActive", String(form.isActive));
  payload.append(
    "variants",
    JSON.stringify([
      {
        ...(form.variantId && { id: form.variantId }),
        sku,
        color: form.color.trim(),
        size: form.size.trim(),
        material: form.material.trim(),
        price: Number(form.price),
        compareAt: form.compareAt ? Number(form.compareAt) : null,
        stock: Number(form.stock || 0),
      },
    ]),
  );

  form.imageFiles.forEach((file) => payload.append("images", file));

  return payload;
};

export default function AdminDashboard({ navigate }) {
  const { isAdmin, isAuthenticated, isLoading } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [carts, setCarts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCategorySaving, setIsCategorySaving] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    await Promise.resolve();
    setIsDashboardLoading(true);
    setError("");

    try {
      const [productData, categoryData, orderData, cartData] = await Promise.all([
        api.get("/products/admin?limit=200"),
        api.get("/categories"),
        api.get("/orders?limit=20"),
        api.get("/cart/admin?limit=20"),
      ]);

      setProducts(normalizeProducts(productData.products));
      setCategories(categoryData.categories || []);
      setOrders(orderData.orders || []);
      setCarts(cartData.carts || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return undefined;

    const timer = window.setTimeout(() => {
      loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isAdmin, isAuthenticated, loadDashboard]);

  const stats = useMemo(() => {
    const active = products.filter((product) => product.isActive).length;
    const inactive = products.length - active;
    const openOrders = orders.filter(
      (order) => !["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status),
    ).length;

    return {
      active,
      inactive,
      openOrders,
      openCarts: carts.length,
      total: products.length,
    };
  }, [carts.length, orders, products]);

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && product.isActive) ||
        (statusFilter === "inactive" && !product.isActive);
      const matchesQuery =
        `${product.name} ${product.brand} ${product.category}`
          .toLowerCase()
          .includes(query.toLowerCase());

      return matchesStatus && matchesQuery;
    });
  }, [products, query, statusFilter]);

  const updateForm = (key, value) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  };

  const createCategory = async () => {
    const name = categoryName.trim();
    if (!name) return;

    setIsCategorySaving(true);

    try {
      const data = await api.post("/categories", { name });
      setCategories((currentCategories) =>
        [...currentCategories, data.category].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      updateForm("categoryId", data.category.id);
      setCategoryName("");
      toast.success("Category created");
    } catch (categoryError) {
      toast.error(categoryError.message);
    } finally {
      setIsCategorySaving(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setFileInputKey((currentKey) => currentKey + 1);
  };

  const selectProduct = (product) => {
    setForm(productToForm(product));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const upsertProductInState = (product) => {
    const normalizedProduct = normalizeProduct(product);

    setProducts((currentProducts) => {
      const exists = currentProducts.some(
        (currentProduct) => currentProduct.id === normalizedProduct.id,
      );

      if (!exists) return [normalizedProduct, ...currentProducts];

      return currentProducts.map((currentProduct) =>
        currentProduct.id === normalizedProduct.id
          ? normalizedProduct
          : currentProduct,
      );
    });

    setForm(productToForm(normalizedProduct));
  };

  const submitProduct = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const payload = buildProductPayload(form);
      const isEditing = Boolean(form.id);
      const data = isEditing
        ? await api.put(`/products/${form.id}`, payload)
        : await api.post("/products", payload);

      upsertProductInState(data.product);
      if (!isEditing) resetForm();
      toast.success(isEditing ? "Product updated" : "Product created");
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleProduct = async (product) => {
    try {
      const data = await api.patch(`/products/${product.id}/toggle`, {});
      upsertProductInState(data.product);
      toast.success(
        data.product.isActive ? "Product activated" : "Product hidden",
      );
    } catch (toggleError) {
      toast.error(toggleError.message);
    }
  };

  const deleteProduct = async (product) => {
    const shouldDelete = window.confirm(
      `Move "${product.name}" to inactive products?`,
    );

    if (!shouldDelete) return;

    try {
      const data = await api.delete(`/products/${product.id}`);
      upsertProductInState(data.product);
      toast.info("Product moved to inactive");
    } catch (deleteError) {
      toast.error(deleteError.message);
    }
  };

  const replaceOrder = (order) => {
    setOrders((currentOrders) =>
      currentOrders.map((currentOrder) =>
        currentOrder.id === order.id ? order : currentOrder,
      ),
    );
  };

  const updateOrderStatus = async (order, status) => {
    if (status === order.status) return;

    try {
      const data = await api.patch(`/orders/${order.id}/status`, { status });
      replaceOrder(data.order);
      toast.success("Order status updated");
    } catch (statusError) {
      toast.error(statusError.message);
    }
  };

  const updatePaymentStatus = async (order, paymentStatus) => {
    if (paymentStatus === order.paymentStatus) return;

    try {
      const data = await api.patch(`/orders/${order.id}/payment`, {
        paymentStatus,
        paymentMethod: order.paymentMethod || "CASH_ON_DELIVERY",
      });
      replaceOrder(data.order);
      toast.success("Payment status updated");
    } catch (paymentError) {
      toast.error(paymentError.message);
    }
  };

  if (isLoading) {
    return (
      <section className="section">
        <div className="container empty-state">
          <h1>Loading dashboard</h1>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="section">
        <div className="container empty-state">
          <p className="eyebrow">Admin</p>
          <h1>Sign in required</h1>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/account")}
            type="button"
          >
            Sign in
          </button>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="section">
        <div className="container empty-state">
          <p className="eyebrow">Admin</p>
          <h1>Admin access required</h1>
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

  return (
    <section className="section admin-page">
      <div className="container">
        <div className="page-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Product dashboard</h1>
          </div>
          <button className="btn btn-outline" onClick={resetForm} type="button">
            New product
          </button>
        </div>

        <div className="admin-stats">
          <div>
            <span>Total</span>
            <strong>{stats.total}</strong>
          </div>
          <div>
            <span>Active</span>
            <strong>{stats.active}</strong>
          </div>
          <div>
            <span>Open orders</span>
            <strong>{stats.openOrders}</strong>
          </div>
          <div>
            <span>Open carts</span>
            <strong>{stats.openCarts}</strong>
          </div>
        </div>

        <div className="admin-layout">
          <form className="admin-editor" onSubmit={submitProduct}>
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Editor</p>
                <h2>{form.id ? "Edit product" : "Add product"}</h2>
              </div>
              <span
                className={`badge ${form.isActive ? "badge-success" : "badge-danger"}`}
              >
                {form.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            {error ? <p className="form-error">{error}</p> : null}

            <div className="form-grid">
              <label className="form-group">
                <span className="form-label">Product name</span>
                <input
                  className="form-input"
                  onChange={(event) => updateForm("name", event.target.value)}
                  required
                  type="text"
                  value={form.name}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Brand</span>
                <input
                  className="form-input"
                  onChange={(event) => updateForm("brand", event.target.value)}
                  type="text"
                  value={form.brand}
                />
              </label>
            </div>

            <label className="form-group">
              <span className="form-label">Description</span>
              <textarea
                className="form-input form-textarea"
                onChange={(event) =>
                  updateForm("description", event.target.value)
                }
                required
                value={form.description}
              />
            </label>

            <div className="form-grid">
              <label className="form-group">
                <span className="form-label">Category</span>
                <select
                  className="form-select"
                  onChange={(event) =>
                    updateForm("categoryId", event.target.value)
                  }
                  required
                  value={form.categoryId}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-group">
                <span className="form-label">SKU</span>
                <input
                  className="form-input"
                  onChange={(event) => updateForm("sku", event.target.value)}
                  type="text"
                  value={form.sku}
                />
              </label>
            </div>

            <div className="admin-category-create">
              <input
                className="form-input"
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="New category"
                type="text"
                value={categoryName}
              />
              <button
                className="btn btn-outline"
                disabled={isCategorySaving || !categoryName.trim()}
                onClick={createCategory}
                type="button"
              >
                {isCategorySaving ? "Adding" : "Add category"}
              </button>
            </div>

            <div className="form-grid">
              <label className="form-group">
                <span className="form-label">Price</span>
                <input
                  className="form-input"
                  min="0"
                  onChange={(event) => updateForm("price", event.target.value)}
                  required
                  type="number"
                  value={form.price}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Compare at</span>
                <input
                  className="form-input"
                  min="0"
                  onChange={(event) =>
                    updateForm("compareAt", event.target.value)
                  }
                  type="number"
                  value={form.compareAt}
                />
              </label>
            </div>

            <div className="form-grid">
              <label className="form-group">
                <span className="form-label">Stock</span>
                <input
                  className="form-input"
                  min="0"
                  onChange={(event) => updateForm("stock", event.target.value)}
                  required
                  type="number"
                  value={form.stock}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Color</span>
                <input
                  className="form-input"
                  onChange={(event) => updateForm("color", event.target.value)}
                  type="text"
                  value={form.color}
                />
              </label>
            </div>

            <div className="form-grid">
              <label className="form-group">
                <span className="form-label">Size</span>
                <input
                  className="form-input"
                  onChange={(event) => updateForm("size", event.target.value)}
                  type="text"
                  value={form.size}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Material</span>
                <input
                  className="form-input"
                  onChange={(event) =>
                    updateForm("material", event.target.value)
                  }
                  type="text"
                  value={form.material}
                />
              </label>
            </div>

            <div className="admin-checks">
              <label>
                <input
                  checked={form.isFeatured}
                  onChange={(event) =>
                    updateForm("isFeatured", event.target.checked)
                  }
                  type="checkbox"
                />
                Featured
              </label>
              <label>
                <input
                  checked={form.isActive}
                  onChange={(event) =>
                    updateForm("isActive", event.target.checked)
                  }
                  type="checkbox"
                />
                Active
              </label>
            </div>

            <label className="form-group">
              <span className="form-label">Images</span>
              <input
                className="form-input admin-file-input"
                key={fileInputKey}
                multiple
                onChange={(event) =>
                  updateForm("imageFiles", [...event.target.files])
                }
                type="file"
              />
            </label>

            <button
              className="btn btn-primary btn-lg btn-full"
              disabled={isSaving || !categories.length}
              type="submit"
            >
              {isSaving ? "Saving" : form.id ? "Save changes" : "Add product"}
            </button>
          </form>

          <div className="admin-products">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Inventory</p>
                <h2>Products</h2>
              </div>
            </div>

            <div className="admin-toolbar">
              <input
                className="form-input"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products"
                type="search"
                value={query}
              />
              <select
                className="form-select"
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {isDashboardLoading ? (
              <div className="empty-state admin-empty">
                <h2>Loading products</h2>
              </div>
            ) : visibleProducts.length ? (
              <div className="admin-product-list">
                {visibleProducts.map((product) => (
                  <article
                    className={`admin-product-row ${
                      form.id === product.id ? "selected" : ""
                    }`}
                    key={product.id}
                  >
                    <img alt={product.name} src={product.image} />
                    <div className="admin-product-row__body">
                      <div>
                        <h3>{product.name}</h3>
                        <p>
                          {product.brand} / {product.category}
                        </p>
                      </div>
                      <div className="admin-product-row__meta">
                        <span>{formatPrice(product.price)}</span>
                        <span>{product.stock} stock</span>
                        <span
                          className={`badge ${
                            product.isActive ? "badge-success" : "badge-danger"
                          }`}
                        >
                          {product.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                    <div className="admin-row-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => selectProduct(product)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => toggleProduct(product)}
                        type="button"
                      >
                        {product.isActive ? "Hide" : "Activate"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => deleteProduct(product)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state admin-empty">
                <h2>No products found</h2>
                <p>Adjust the filters or add a product.</p>
              </div>
            )}
          </div>
        </div>

        <div className="admin-commerce-grid">
          <section className="admin-products">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Orders</p>
                <h2>Ordered items</h2>
              </div>
            </div>

            {isDashboardLoading ? (
              <div className="empty-state admin-empty">
                <h2>Loading orders</h2>
              </div>
            ) : orders.length ? (
              <div className="admin-order-list">
                {orders.map((order) => (
                  <article className="admin-order-card" key={order.id}>
                    <div className="admin-order-card__header">
                      <div>
                        <strong>#{order.id.slice(0, 8)}</strong>
                        <span>{customerName(order.user)}</span>
                      </div>
                      <strong>{formatPrice(Number(order.total))}</strong>
                    </div>
                    <div className="admin-order-card__meta">
                      <span>{new Date(order.createdAt).toLocaleString()}</span>
                      <span>{order.user?.email}</span>
                    </div>
                    <div className="admin-order-items">
                      {order.items.map((item) => (
                        <div className="admin-order-item" key={item.id}>
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
                    <div className="admin-order-controls">
                      <select
                        className="form-select"
                        onChange={(event) =>
                          updateOrderStatus(order, event.target.value)
                        }
                        value={order.status}
                      >
                        {orderStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <select
                        className="form-select"
                        onChange={(event) =>
                          updatePaymentStatus(order, event.target.value)
                        }
                        value={order.paymentStatus}
                      >
                        {paymentStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state admin-empty">
                <h2>No orders yet</h2>
                <p>New customer orders will appear here.</p>
              </div>
            )}
          </section>

          <section className="admin-products">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Carts</p>
                <h2>Active carts</h2>
              </div>
            </div>

            {isDashboardLoading ? (
              <div className="empty-state admin-empty">
                <h2>Loading carts</h2>
              </div>
            ) : carts.length ? (
              <div className="admin-order-list">
                {carts.map((cart) => (
                  <article className="admin-order-card" key={cart.id}>
                    <div className="admin-order-card__header">
                      <div>
                        <strong>{customerName(cart.user)}</strong>
                        <span>{cart.user?.email}</span>
                      </div>
                      <strong>{formatPrice(Number(cart.total))}</strong>
                    </div>
                    <div className="admin-order-card__meta">
                      <span>{cart.totalItems} item(s)</span>
                      <span>
                        Updated {new Date(cart.updatedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="admin-order-items">
                      {cart.items.map((item) => (
                        <div className="admin-order-item" key={item.id}>
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
                              {formatPrice(Number(item.variant?.price || 0))}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state admin-empty">
                <h2>No active carts</h2>
                <p>Signed-in customer carts with items will appear here.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
