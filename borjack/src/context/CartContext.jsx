"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getGuestCart,
  addToGuestCart,
  updateGuestCartQuantity,
  removeFromGuestCart,
  clearGuestCart,
} from "@/lib/guestCart";

const CartContext = createContext();
const MAX_QUANTITY_PER_ITEM = 20;

function normalizeGuestItems(items) {
  return items.map((item) => ({
    id: `guest-${item.productId}`,
    productId: item.productId,
    quantity: item.quantity,
    product: item.product,
  }));
}

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasMerged = useRef(false);

  const refreshCart = async () => {
    if (user) {
      try {
        const res = await fetch("/api/cart", { cache: "no-store" });
        if (!res.ok) {
          setCartItems([]);
          return;
        }
        const data = await res.json();
        setCartItems(Array.isArray(data) ? data : []);
      } catch {
        setCartItems([]);
      } finally {
        setLoading(false);
      }
    } else {
      setCartItems(normalizeGuestItems(getGuestCart()));
      setLoading(false);
    }
  };

  const mergeGuestCart = async () => {
    const guestItems = getGuestCart();
    if (guestItems.length === 0) return;

    try {
      await fetch("/api/cart/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: guestItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      });
      clearGuestCart();
    } catch (err) {
      console.error("Cart merge error:", err);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      if (!hasMerged.current) {
        hasMerged.current = true;
        mergeGuestCart().then(refreshCart);
      } else {
        refreshCart();
      }
    } else {
      hasMerged.current = false;
      refreshCart();
    }
  }, [authLoading, user]);

  useEffect(() => {
    window.addEventListener("cart-updated", refreshCart);
    return () => window.removeEventListener("cart-updated", refreshCart);
  }, [user]);

  const addToCart = async (product, quantity = 1) => {
    if (user) {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "خطا در افزودن به سبد");
      }
      await refreshCart();
    } else {
      const items = addToGuestCart(product, quantity, MAX_QUANTITY_PER_ITEM);
      setCartItems(normalizeGuestItems(items));
    }
    window.dispatchEvent(new Event("cart-updated"));
  };

  const updateQuantity = async (productId, quantity) => {
    if (quantity < 1) return removeItem(productId);

    if (user) {
      const res = await fetch(`/api/cart/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) return;
      await refreshCart();
    } else {
      const items = updateGuestCartQuantity(productId, quantity, MAX_QUANTITY_PER_ITEM);
      setCartItems(normalizeGuestItems(items));
    }
  };

  const removeItem = async (productId) => {
    if (user) {
      const res = await fetch(`/api/cart/${productId}`, { method: "DELETE" });
      if (!res.ok) return;
      await refreshCart();
    } else {
      const items = removeFromGuestCart(productId);
      setCartItems(normalizeGuestItems(items));
    }
  };

  const clearCart = async () => {
    if (user) {
      const res = await fetch("/api/cart", { method: "DELETE" });
      if (!res.ok) return;
      await refreshCart();
    } else {
      clearGuestCart();
      setCartItems([]);
    }
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        loading,
        refreshCart,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return context;
}