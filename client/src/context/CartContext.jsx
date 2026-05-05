import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "../utils/api";
import { absoluteAssetUrl } from "../utils/productMapper";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

const STORAGE_KEY = "commerce-cart-v1";
const OWNER_KEY = "commerce-cart-owner-v1";
const CartContext = createContext(null);

const readStoredCart = () => {
  try {
    const savedCart = localStorage.getItem(STORAGE_KEY);
    return savedCart ? JSON.parse(savedCart) : [];
  } catch {
    return [];
  }
};

const lineIdFor = (product, options) =>
  options.variantId ||
  product.variantId ||
  [product.id, options.color, options.size].filter(Boolean).join(":");

const toLineItem = (product, options, quantity = 1) => ({
  id: lineIdFor(product, options),
  productId: product.id,
  slug: product.slug,
  name: product.name,
  brand: product.brand,
  price: product.price,
  compareAtPrice: product.compareAtPrice,
  currency: product.currency,
  image: product.image,
  variantId: options.variantId || product.variantId,
  color: options.color,
  size: options.size,
  quantity,
});

const toLineItemsFromApi = (cart) =>
  (cart?.items || []).map((item) => {
    const image = item.product?.images?.[0]?.url;
    const price = Number(item.variant?.price || 0);

    return {
      id: item.variantId,
      cartItemId: item.id,
      productId: item.productId,
      slug: item.product?.slug,
      name: item.product?.name || item.variant?.sku || "Product",
      brand: "",
      price,
      compareAtPrice:
        item.variant?.compareAt === null || item.variant?.compareAt === undefined
          ? null
          : Number(item.variant.compareAt),
      currency: "EGP",
      image: absoluteAssetUrl(image),
      variantId: item.variantId,
      color: item.variant?.color || "Default",
      size: item.variant?.size || item.variant?.sku || "One size",
      quantity: item.quantity,
      stock: Number(item.variant?.stock || 0),
    };
  });

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStoredCart);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { isAuthenticated, isLoading, user } = useAuth();
  const toast = useToast();
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (isLoading) return undefined;

    let isMounted = true;

    const syncCart = async () => {
      if (!isAuthenticated || !user?.id) {
        if (localStorage.getItem(OWNER_KEY)) {
          localStorage.removeItem(OWNER_KEY);
          if (isMounted) setItems([]);
        }
        return;
      }

      const ownerId = localStorage.getItem(OWNER_KEY);
      const localItems = itemsRef.current;

      if (ownerId !== user.id && localItems.length) {
        await Promise.all(
          localItems
            .filter((item) => item.productId && item.variantId)
            .map((item) =>
              api.post("/cart/items", {
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
              }),
            ),
        );
      }

      const data = await api.get("/cart");
      if (!isMounted) return;

      localStorage.setItem(OWNER_KEY, user.id);
      setItems(toLineItemsFromApi(data.cart));
    };

    syncCart().catch((error) => {
      if (isMounted) toast.error(error.message);
    });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isLoading, toast, user?.id]);

  const addItem = useCallback(
    async (product, options = {}) => {
      const normalizedOptions = {
        color: options.color || product.colors?.[0] || "Default",
        size: options.size || product.sizes?.[0] || "One size",
        variantId: options.variantId || product.variantId,
      };
      const lineId = lineIdFor(product, normalizedOptions);

      if (isAuthenticated) {
        try {
          const data = await api.post("/cart/items", {
            productId: product.id,
            variantId: normalizedOptions.variantId,
            quantity: 1,
          });
          localStorage.setItem(OWNER_KEY, user.id);
          setItems(toLineItemsFromApi(data.cart));
          setIsCartOpen(true);
          toast.success(`${product.name} added to cart`);
        } catch (error) {
          toast.error(error.message);
        }
        return;
      }

      setItems((currentItems) => {
        const existingItem = currentItems.find((item) => item.id === lineId);

        if (existingItem) {
          return currentItems.map((item) =>
            item.id === lineId
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        }

        return [...currentItems, toLineItem(product, normalizedOptions)];
      });

      setIsCartOpen(true);
      toast.success(`${product.name} added to cart`);
    },
    [isAuthenticated, toast, user?.id],
  );

  const removeItem = useCallback(
    async (lineId) => {
      if (isAuthenticated) {
        try {
          const data = await api.delete(`/cart/items/${lineId}`);
          setItems(toLineItemsFromApi(data.cart));
        } catch (error) {
          toast.error(error.message);
        }
        return;
      }

      setItems((currentItems) =>
        currentItems.filter((item) => item.id !== lineId),
      );
    },
    [isAuthenticated, toast],
  );

  const updateQuantity = useCallback(
    async (lineId, quantity) => {
      const nextQuantity = Number(quantity);

      if (isAuthenticated) {
        try {
          const data = await api.patch(`/cart/items/${lineId}`, {
            quantity: nextQuantity,
          });
          setItems(toLineItemsFromApi(data.cart));
        } catch (error) {
          toast.error(error.message);
        }
        return;
      }

      setItems((currentItems) => {
        if (nextQuantity <= 0) {
          return currentItems.filter((item) => item.id !== lineId);
        }

        return currentItems.map((item) =>
          item.id === lineId ? { ...item, quantity: nextQuantity } : item,
        );
      });
    },
    [isAuthenticated, toast],
  );

  const incrementItem = useCallback((lineId) => {
    const item = itemsRef.current.find((candidate) => candidate.id === lineId);
    if (!item) return;
    updateQuantity(lineId, item.quantity + 1);
  }, [updateQuantity]);

  const decrementItem = useCallback((lineId) => {
    const item = itemsRef.current.find((candidate) => candidate.id === lineId);
    if (!item) return;
    updateQuantity(lineId, item.quantity - 1);
  }, [updateQuantity]);

  const clearCart = useCallback(async () => {
    if (isAuthenticated) {
      try {
        await api.delete("/cart");
      } catch {
        // A just-placed order deletes the cart; the local state still clears.
      }
    }
    setItems([]);
  }, [isAuthenticated]);

  const summary = useMemo(() => {
    const subtotal = items.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );
    const tax = 0;
    const shipping = subtotal === 0 || subtotal >= 500 ? 0 : 50;
    const total = subtotal + tax + shipping;
    const itemCount = items.reduce((count, item) => count + item.quantity, 0);

    return {
      subtotal,
      tax,
      shipping,
      total,
      itemCount,
    };
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      ...summary,
      isCartOpen,
      addItem,
      removeItem,
      updateQuantity,
      incrementItem,
      decrementItem,
      clearCart,
      openCart: () => setIsCartOpen(true),
      closeCart: () => setIsCartOpen(false),
    }),
    [
      addItem,
      clearCart,
      decrementItem,
      incrementItem,
      isCartOpen,
      items,
      removeItem,
      summary,
      updateQuantity,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }

  return context;
}
