function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(days = 90) {
  const date = new Date();

  date.setDate(date.getDate() - Math.floor(Math.random() * days));

  return date;
}

const comments = [
  "کیفیت خیلی خوبی داشت.",
  "پیشنهاد میکنم.",
  "ارزش خرید بالایی داره.",
  "از انتظارم بهتر بود.",
  "ارسال سریع بود.",
  "بسته بندی عالی.",
  "کیفیت ساخت فوق العاده.",
  "دوباره میخرم.",
  "کاملا راضی بودم.",
  "نسبت به قیمت خوبه.",
  "میتونست بهتر باشه.",
  "رنگش دقیقا مثل عکس بود.",
  "کیفیت متوسط.",
  "عالی بود.",
  "پنج ستاره واقعا حقشه.",
];

export async function seedReviews(prisma) {
  console.log("⭐ Seeding reviews...");

  const products = await prisma.product.findMany();

  const customers = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
    },
  });

  for (const product of products) {
    const count = Math.floor(Math.random() * 8) + 2;

    let sum = 0;

    for (let i = 0; i < count; i++) {
      const customer = randomItem(customers);
      const rating = Math.floor(Math.random() * 2) + 4;
      const createdAt = randomDate();

      sum += rating;

      await prisma.review.create({
        data: {
          productId: product.id,

          user: customer.name,
          userId: customer.id,

          rating,
          comment: randomItem(comments),

          // فیلد date در Schema از نوع String است
          date: createdAt.toLocaleDateString("fa-IR"),

          approved: true,
          createdAt,
        },
      });
    }

    await prisma.product.update({
      where: {
        id: product.id,
      },
      data: {
        rating: Number((sum / count).toFixed(1)),
        reviewCount: count,
      },
    });
  }

  console.log("✅ Reviews seeded");
}