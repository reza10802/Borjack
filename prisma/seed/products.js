function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const categoryConfig = {
  موبایل: {
    brands: ["Samsung", "Apple", "Xiaomi"],
    min: 12000000,
    max: 90000000,
    images: ["/images/samsung-s24.jpg"],
  },

  "لپ تاپ": {
    brands: ["Apple", "Lenovo", "Asus", "MSI"],
    min: 25000000,
    max: 120000000,
    images: ["/images/macbook-air.jpg", "/images/laptop.jpg"],
  },

  هدفون: {
    brands: ["Sony", "Samsung", "Apple"],
    min: 1500000,
    max: 18000000,
    images: ["/images/headphone.jpg", "/images/sony-headphone.jpg"],
  },

  ساعت: {
    brands: ["Apple", "Samsung", "Xiaomi"],
    min: 2500000,
    max: 30000000,
    images: ["/images/apple-watch.jpg"],
  },

  دوربین: {
    brands: ["Sony"],
    min: 30000000,
    max: 180000000,
    images: ["/images/sony-camera.jpg"],
  },

  پوشاک: {
    brands: ["Nike"],
    min: 500000,
    max: 2500000,
    images: ["/images/nike-shirt.jpg"],
  },
};

export async function seedProducts(prisma) {
  console.log("📦 Seeding products...");

  // ساخت دسته‌ها
  for (const category of Object.keys(categoryConfig)) {
    await prisma.category.upsert({
      where: {
        title: category,
      },
      update: {},
      create: {
        title: category,
      },
    });
  }

  let index = 1;

  for (const category of Object.keys(categoryConfig)) {
    const config = categoryConfig[category];

    for (const brand of config.brands) {
      const price = random(config.min, config.max);

      const discount = random(0, 25);

      const originalPrice =
        discount === 0
          ? price
          : Math.round(price / (1 - discount / 100));

      await prisma.product.create({
        data: {
          title: `${brand} ${category} ${index}`,

          category: {
            connect: {
              title: category,
            },
          },

          price,
          originalPrice,
          discount,

          image: randomItem(config.images),

          description: `محصول ${brand} در دسته ${category} با کیفیت بالا و گارانتی معتبر.`,

          inStock: Math.random() > 0.2,

          rating: 0,
          reviewCount: 0,
        },
      });

      index++;
    }
  }

  console.log("✅ Products seeded");
}