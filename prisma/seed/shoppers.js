// Carts and wishlists for a couple of customers, so those pages have data to test.
export async function seedShoppers({ prisma }, { users, products }) {
  console.log("🧺 Seeding carts & wishlists...");

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const sara = users.byPhone.get("09120000005");
  const negar = users.byPhone.get("09120000006");

  const carts = [
    [sara, "samsung-galaxy-buds-fe", 2],
    [sara, "nike-dri-fit-legend-t-shirt", 1],
    [negar, "sony-wh-1000xm5", 1],
  ];

  for (const [user, slug, quantity] of carts) {
    const product = bySlug.get(slug);
    if (!user || !product) continue;
    // Never put more in a cart than the product has.
    await prisma.cartItem.create({
      data: { userId: user.id, productId: product.id, quantity: Math.min(quantity, product.stock) },
    });
  }

  const wishlists = [
    [sara, ["samsung-galaxy-s24-256gb", "sony-wh-1000xm5", "apple-macbook-air-m2-13"]],
    [negar, ["sony-alpha-a6400-16-50mm"]],
  ];

  for (const [user, slugs] of wishlists) {
    if (!user) continue;
    for (const slug of slugs) {
      const product = bySlug.get(slug);
      if (product) {
        await prisma.wishlistItem.create({ data: { userId: user.id, productId: product.id } });
      }
    }
  }

  console.log("✅ Carts & wishlists seeded");
}
