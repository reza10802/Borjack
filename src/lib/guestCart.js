const STORAGE_KEY = "guest_cart";

export function getGuestCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGuestCart(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addToGuestCart(product, quantity = 1, maxQuantity = 20) {
  const items = getGuestCart();
  const existingIndex = items.findIndex((i) => i.productId === product.id);

  if (existingIndex > -1) {
    items[existingIndex].quantity = Math.min(
      items[existingIndex].quantity + quantity,
      maxQuantity,
    );
  } else {
    items.push({
      productId: product.id,
      quantity: Math.min(quantity, maxQuantity),
      product: {
        id: product.id,
        slug: product.slug,
        title: product.title,
        price: product.price,
        image: product.image,
        images: product.image ? [{ url: product.image }] : [],
      },
    });
  }

  saveGuestCart(items);
  return items;
}

export function updateGuestCartQuantity(productId, quantity, maxQuantity = 20) {
  let items = getGuestCart();

  if (quantity < 1) {
    items = items.filter((i) => i.productId !== productId);
  } else {
    items = items.map((i) =>
      i.productId === productId
        ? { ...i, quantity: Math.min(quantity, maxQuantity) }
        : i,
    );
  }

  saveGuestCart(items);
  return items;
}

export function removeFromGuestCart(productId) {
  const items = getGuestCart().filter((i) => i.productId !== productId);
  saveGuestCart(items);
  return items;
}

export function clearGuestCart() {
  saveGuestCart([]);
  return [];
}