// Explicit allowlists for Product data that leaves the server (public pages, public APIs, the
// customer's cart and wishlist). The global Prisma `omit` of Product.supplierId is only a safety
// net; the real control is that these queries SELECT their fields explicitly.
//
// Internal ownership, pricing and review fields are deliberately excluded from public output.
// A test fails if a new Product column is added to the schema without being consciously classified.

// Columns public routes may select. `stock` and `reservedStock` are only used by routes that
// compute availableStock; each route keeps (or strips) them exactly as it did before.
export const PUBLIC_PRODUCT_SCALARS = {
  id: true,
  title: true,
  slug: true,
  categoryId: true,
  brandId: true,
  price: true,
  originalPrice: true,
  discount: true,
  image: true,
  description: true,
  stock: true,
  reservedStock: true,
  rating: true,
  reviewCount: true,
  isPublished: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
};

// Product columns that must never appear in public output.
export const INTERNAL_PRODUCT_COLUMNS = [
  "supplierId",
  "basePrice",
  "commissionPercent",
  "reviewStatus",
  "reviewNote",
  "republishAfterReview",
];

// Product cards on listing pages (category / brand / tag).
export const PUBLIC_CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  price: true,
  originalPrice: true,
  discount: true,
  stock: true,
  reservedStock: true, // only to compute availableStock below; never returned
  image: true,
  rating: true,
  reviewCount: true,
  images: { take: 1, orderBy: { id: "asc" }, select: { url: true } },
  category: { select: { title: true } },
  brand: { select: { title: true } },
};

// What ProductCard receives. Same shape as the home page grid (components/ProductGrid.jsx).
export function toPublicCardProduct(product) {
  const stock = Number(product.stock);
  const reservedStock = Number(product.reservedStock);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    price: product.price,
    originalPrice: product.originalPrice,
    discount: product.discount,
    availableStock:
      Number.isSafeInteger(stock) && Number.isSafeInteger(reservedStock)
        ? Math.max(0, stock - reservedStock)
        : 0,
    image: product.images?.[0]?.url || product.image,
    rating: product.rating,
    reviewCount: product.reviewCount,
    isWishlisted: false,
    category: product.category?.title ?? null,
    brand: product.brand ? { title: product.brand.title } : null,
  };
}