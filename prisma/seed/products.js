
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]+/g, "")
    .replace(/--+/g, "-");
}

const products = [
  {
    title: "Samsung Galaxy S24 256GB",
    slug: "samsung-galaxy-s24-256gb",
    category: "موبایل",
    brand: "Samsung",
    price: 42900000,
    originalPrice: 46900000,
    discount: 9,
    image: "/images/samsung-s24.jpg",
    images: [
      "/images/samsung-s24.jpg",
      "/images/samsung-side1.jpg",
      "/images/samsung-side2.jpg",
    ],
    description:
      "گوشی Samsung Galaxy S24 با نمایشگر Dynamic AMOLED 2X، دوربین اصلی 50 مگاپیکسلی و قابلیت‌های هوش مصنوعی Galaxy AI.",
    stock: 12,
    specs: {
      "حافظه داخلی": "256 گیگابایت",
      "حافظه رم": "8 گیگابایت",
      "نمایشگر": "6.2 اینچ Dynamic AMOLED 2X",
      "دوربین اصلی": "50 مگاپیکسل",
      "پردازنده": "Exynos 2400",
      "شبکه": "5G",
    },
  },
  {
    title: "Apple MacBook Air M2 13-inch",
    slug: "apple-macbook-air-m2-13",
    category: "لپ تاپ",
    brand: "Apple",
    price: 265000000,
    originalPrice: 265000000,
    discount: 0,
    image: "/images/macbook-air.jpg",
    description:
      "مک‌بوک ایر 13 اینچی مجهز به تراشه Apple M2، طراحی باریک و بدون فن، مناسب برای کارهای روزمره، برنامه‌نویسی و استفاده دانشجویی.",
    stock: 5,
    specs: {
      "پردازنده": "Apple M2",
      "اندازه نمایشگر": "13.6 اینچ",
      "حافظه رم": "8 گیگابایت",
      "حافظه داخلی": "256 گیگابایت SSD",
      "سیستم عامل": "macOS",
    },
  },
  {
    title: "Lenovo IdeaPad Slim 3 15IRH8",
    slug: "lenovo-ideapad-slim-3-15",
    category: "لپ تاپ",
    brand: "Lenovo",
    price: 32900000,
    originalPrice: 32900000,
    discount: 0,
    image: "/images/laptop.jpg",
    description:
      "لپ‌تاپ اقتصادی لنوو از سری IdeaPad Slim 3 برای کارهای اداری، تحصیل، وب‌گردی و استفاده روزمره.",
    stock: 8,
    specs: {
      "سری محصول": "IdeaPad Slim 3",
      "اندازه نمایشگر": "15.6 اینچ",
      "نوع دستگاه": "لپ‌تاپ روزمره",
      "کاربری": "اداری و دانشجویی",
    },
  },
  {
    title: "Sony WH-1000XM5",
    slug: "sony-wh-1000xm5",
    category: "هدفون",
    brand: "Sony",
    price: 12900000,
    originalPrice: 14500000,
    discount: 11,
    image: "/images/sony-headphone.jpg",
    description:
      "هدفون بی‌سیم Sony WH-1000XM5 با حذف نویز فعال، صدای باکیفیت و طراحی مناسب برای گوش دادن به موسیقی و استفاده روزمره.",
    stock: 7,
    specs: {
      "نوع اتصال": "Bluetooth",
      "حذف نویز": "فعال (ANC)",
      "نوع هدفون": "روگوشی",
      "میکروفون": "دارد",
      "کاربری": "موسیقی و مکالمه",
    },
  },
  {
    title: "Samsung Galaxy Buds FE",
    slug: "samsung-galaxy-buds-fe",
    category: "هدفون",
    brand: "Samsung",
    price: 3490000,
    originalPrice: 3490000,
    discount: 0,
    image: "/images/headphone.jpg",
    description:
      "هدفون بی‌سیم Galaxy Buds FE با طراحی جمع‌وجور، حذف نویز فعال و اتصال آسان به دستگاه‌های سازگار.",
    stock: 15,
    specs: {
      "نوع اتصال": "Bluetooth",
      "حذف نویز": "فعال (ANC)",
      "نوع هدفون": "کاملاً بی‌سیم",
      "میکروفون": "دارد",
    },
  },
  {
    title: "Apple Watch Series 9 GPS 45mm",
    slug: "apple-watch-series-9-gps-45mm",
    category: "ساعت",
    brand: "Apple",
    price: 18900000,
    originalPrice: 18900000,
    discount: 0,
    image: "/images/apple-watch.jpg",
    description:
      "ساعت هوشمند Apple Watch Series 9 با نمایشگر Retina، پایش فعالیت‌های روزانه و پشتیبانی از قابلیت‌های سلامت سازگار.",
    stock: 6,
    specs: {
      "اندازه بدنه": "45 میلی‌متر",
      "اتصال": "GPS",
      "نمایشگر": "Always-On Retina",
      "مقاومت در برابر آب": "تا عمق 50 متر",
      "سازگاری": "iPhone",
    },
  },
  {
    title: "Sony Alpha a6400 16-50mm",
    slug: "sony-alpha-a6400-16-50mm",
    category: "دوربین",
    brand: "Sony",
    price: 54900000,
    originalPrice: 59900000,
    discount: 8,
    image: "/images/sony-camera.jpg",
    description:
      "دوربین بدون آینه Sony Alpha a6400 همراه لنز 16-50 میلی‌متری، مناسب عکاسی، تولید محتوا و ضبط ویدئو.",
    stock: 3,
    specs: {
      "نوع دوربین": "بدون آینه",
      "حسگر": "APS-C",
      "وضوح حسگر": "24.2 مگاپیکسل",
      "لنز همراه": "16-50mm",
      "فیلم‌برداری": "4K",
      "مانت لنز": "Sony E",
    },
  },
  {
    title: "Nike Dri-FIT Legend T-Shirt",
    slug: "nike-dri-fit-legend-t-shirt",
    category: "پوشاک",
    brand: "Nike",
    price: 1490000,
    originalPrice: 1490000,
    discount: 0,
    image: "/images/nike-shirt.jpg",
    description:
      "تیشرت ورزشی Nike Dri-FIT Legend با طراحی مناسب تمرین و پارچه‌ای با قابلیت کمک به مدیریت رطوبت.",
    stock: 20,
    specs: {
      "برند": "Nike",
      "مدل": "Dri-FIT Legend",
      "نوع لباس": "تیشرت ورزشی",
      "کاربری": "تمرین و استفاده روزمره",
    },
  },
];

export async function seedProducts(prisma) {
  console.log("📦 Seeding products...");

  // دسته‌بندی‌های موردنیاز
  const categories = [
    ...new Set(products.map((p) => p.category)),
  ];

  for (const title of categories) {
    await prisma.category.upsert({
      where: { title },
      update: {},
      create: {
        title,
        slug: slugify(title),
      },
    });
  }

  // برندهای موردنیاز
  const brands = [...new Set(products.map((p) => p.brand))];

  for (const title of brands) {
    await prisma.brand.upsert({
      where: { title },
      update: {},
      create: {
        title,
        slug: slugify(title),
      },
    });
  }

  for (const item of products) {
    const {
      specs,
      images,
      category,
      brand,
      ...productData
    } = item;

    // ایجاد یا به‌روزرسانی محصول؛ اجرای مجدد، محصول تکراری نمی‌سازد.
    const product = await prisma.product.upsert({
      where: { slug: productData.slug },
      update: {
        ...productData,
        category: { connect: { title: category } },
        brand: { connect: { title: brand } },
        rating: 0,
        reviewCount: 0,
        isPublished: true,
      },
      create: {
        ...productData,
        category: { connect: { title: category } },
        brand: { connect: { title: brand } },
        rating: 0,
        reviewCount: 0,
        isPublished: true,
      },
    });

    // همگام‌سازی مشخصات فنی
    await prisma.productSpec.deleteMany({
      where: { productId: product.id },
    });

    if (specs && Object.keys(specs).length > 0) {
      await prisma.productSpec.createMany({
        data: Object.entries(specs).map(([key, value]) => ({
          productId: product.id,
          key,
          value,
        })),
      });
    }

    // فقط Galaxy S24 گالری چندتصویری دارد.
    // تصاویر قبلی همین محصول همگام‌سازی می‌شوند.
    await prisma.productImage.deleteMany({
      where: { productId: product.id },
    });

    if (images?.length) {
      await prisma.productImage.createMany({
        data: images.map((url) => ({
          productId: product.id,
          url,
        })),
      });
    }
  }

  console.log(`✅ ${products.length} products seeded`);
}
