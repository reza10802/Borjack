import { MS } from "./_lib.js";

const COMMENTS = {
  positive: [
    "کیفیت خیلی خوبی داشت.",
    "پیشنهاد می‌کنم.",
    "ارزش خرید بالایی داره.",
    "از انتظارم بهتر بود.",
    "ارسال سریع بود.",
    "بسته‌بندی عالی.",
    "کیفیت ساخت فوق‌العاده.",
    "دوباره می‌خرم.",
    "کاملا راضی بودم.",
    "رنگش دقیقا مثل عکس بود.",
  ],
  neutral: ["نسبت به قیمت خوبه.", "کیفیت متوسط.", "می‌تونست بهتر باشه.", "معمولی بود، نه بد نه عالی."],
  negative: ["انتظار بیشتری داشتم.", "بسته‌بندی ضعیف بود.", "با توضیحات فروشنده کمی تفاوت داشت."],
};

const commentFor = (rng, rating) =>
  rng.pick(rating >= 4 ? COMMENTS.positive : rating === 3 ? COMMENTS.neutral : COMMENTS.negative);

export async function seedReviews({ prisma, rng, now }, { users, products, orders }) {
  console.log("⭐ Seeding reviews...");

  const reviewers = users.customers.filter((u) => u.isActive && u.isPhoneVerified);
  const byId = new Map(reviewers.map((u) => [u.id, u]));

  // People who really bought a product (paid and not cancelled) review it first.
  const buyersByProduct = new Map();
  for (const order of orders) {
    if (order.paymentStatus !== "PAID" || order.status === "CANCELLED") continue;
    if (!byId.has(order.userId)) continue;
    for (const item of order.items) {
      if (!buyersByProduct.has(item.productId)) buyersByProduct.set(item.productId, new Set());
      buyersByProduct.get(item.productId).add(order.userId);
    }
  }

  const reviewable = products.filter((p) => p.isPublished);
  // A few products also get a pending review so the admin moderation queue is not empty.
  const withPending = new Set(rng.shuffle(reviewable).slice(0, 6).map((p) => p.id));

  let approvedTotal = 0;
  let pendingTotal = 0;

  for (const product of reviewable) {
    const buyers = [...(buyersByProduct.get(product.id) ?? [])].map((id) => byId.get(id));
    const others = rng.shuffle(reviewers.filter((u) => !buyers.includes(u)));
    const people = [...rng.shuffle(buyers), ...others]; // distinct users

    const approvedCount = Math.min(people.length, rng.int(3, 7));
    const pendingCount = withPending.has(product.id) ? 1 : 0;

    const ratings = [];

    for (let i = 0; i < approvedCount + pendingCount; i++) {
      const person = people[i];
      if (!person) break;

      const approved = i < approvedCount;
      const rating = rng.weighted([[5, 45], [4, 30], [3, 14], [2, 7], [1, 4]]);
      const createdAt = new Date(now.getTime() - rng.int(1, 60) * MS.day);

      await prisma.review.create({
        data: {
          productId: product.id,
          user: person.name,
          userId: person.id,
          rating,
          comment: commentFor(rng, rating),
          // Review.date is a String in the schema; the app stores the fa-IR date.
          date: createdAt.toLocaleDateString("fa-IR"),
          approved,
          createdAt,
        },
      });

      if (approved) {
        ratings.push(rating);
        approvedTotal += 1;
      } else {
        pendingTotal += 1;
      }
    }

    // Same rule as src/app/api/admin/reviews: only APPROVED reviews count.
    if (ratings.length) {
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      await prisma.product.update({
        where: { id: product.id },
        data: { rating: Math.round(avg * 10) / 10, reviewCount: ratings.length },
      });
    }
  }

  console.log(`✅ Reviews seeded (${approvedTotal} approved, ${pendingTotal} pending)`);
}
