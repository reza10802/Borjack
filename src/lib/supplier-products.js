// Explicit allowlist for supplier product views.
// Internal ownership and commission fields are never exposed.
export const PRODUCT_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  image: true,

  // Supplier's own base price and customer-facing prices
  basePrice: true,
  price: true,
  originalPrice: true,
  discount: true,

  stock: true,
  reservedStock: true,
  isPublished: true,

  // Product review information visible to its owner.
  reviewStatus: true,
  reviewNote: true,

  deletedAt: true,
  createdAt: true,
  updatedAt: true,

  category: {
    select: {
      id: true,
      title: true,
    },
  },

  brand: {
    select: {
      id: true,
      title: true,
    },
  },
};