
import { MS, slugify } from "./_lib.js";
import { calculateProductPricing } from "../../src/lib/pricing.js";

// owner = phone of the SUPPLIER user who owns the product.
// owner: null = Borjak-owned product.
const SUPPLIER_1 = "09116011003";
const SUPPLIER_2 = "09120000003";
const SUPPLIER_3 = "09120000016";
const SUPPLIER_4 = "09120000017";

const products = [
  {
    title: "Samsung Galaxy S24 256GB",
    slug: "samsung-galaxy-s24-256gb",
    category: "موبایل",
    brand: "Samsung",
    owner: SUPPLIER_1,
    basePrice: 42_252_251,
    tags: ["پرفروش", "تخفیف‌دار"],
    price: 42_678_998,
    originalPrice: 46_900_000,
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
    owner: SUPPLIER_1,
    basePrice: 240_909_090,
    tags: ["جدید"],
    price: 265_000_000,
    originalPrice: 265_000_000,
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
    owner: SUPPLIER_1,
    basePrice: 29_374_999,
    tags: [],
    price: 32_900_000,
    originalPrice: 32_900_000,
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
    owner: SUPPLIER_2,
    basePrice: 12_946_427,
    tags: ["پرفروش", "تخفیف‌دار"],
    price: 12_904_998,
    originalPrice: 14_500_000,
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
    owner: SUPPLIER_2,
    basePrice: 3_088_494,
    tags: ["پرفروش"],
    price: 3_490_000,
    originalPrice: 3_490_000,
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
    owner: SUPPLIER_2,
    basePrice: 16_874_999,
    tags: ["جدید"],
    price: 18_900_000,
    originalPrice: 18_900_000,
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
    owner: SUPPLIER_3,
    basePrice: 53_963_963,
    tags: ["تخفیف‌دار"],
    price: 55_107_999,
    originalPrice: 59_900_000,
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
    owner: SUPPLIER_4,
    basePrice: 1_307_016,
    tags: ["پرفروش"],
    price: 1_490_000,
    originalPrice: 1_490_000,
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

  // Scenario products
  {
    title: "Sony WH-CH720N",
    slug: "sony-wh-ch720n",
    category: "هدفون",
    brand: "Sony",
    owner: SUPPLIER_2,
    basePrice: 6_106_193,
    tags: [],
    scenario: "ناموجود (stock = 0)",
    price: 6_900_000,
    originalPrice: 6_900_000,
    discount: 0,
    image: "/images/sony-headphone.jpg",
    description:
      "هدفون بی‌سیم سبک Sony با حذف نویز فعال. این محصول عمداً ناموجود است.",
    stock: 0,
    specs: {
      "نوع اتصال": "Bluetooth",
      "حذف نویز": "فعال (ANC)",
    },
  },
  {
    title: "Lenovo IdeaPad Slim 5 14",
    slug: "lenovo-ideapad-slim-5-14",
    category: "لپ تاپ",
    brand: "Lenovo",
    owner: SUPPLIER_3,
    basePrice: 43_693_692,
    tags: [],
    scenario: "فقط ۱ عدد موجودی (تست رقابت رزرو)",
    price: 48_500_000,
    originalPrice: 48_500_000,
    discount: 0,
    image: "/images/laptop.jpg",
    description:
      "لپ‌تاپ ۱۴ اینچی لنوو. این محصول عمداً فقط یک عدد موجودی دارد.",
    stock: 1,
    specs: {
      "اندازه نمایشگر": "14 اینچ",
      "حافظه رم": "16 گیگابایت",
    },
  },
  {
    title: "Nike Air Zoom Pegasus (پیش‌نویس)",
    slug: "nike-air-zoom-pegasus-draft",
    category: "پوشاک",
    brand: "Nike",
    owner: SUPPLIER_4,
    basePrice: 6_991_149,
    tags: [],
    scenario: "منتشرنشده (isPublished = false)",
    isPublished: false,
    price: 7_900_000,
    originalPrice: 7_900_000,
    discount: 0,
    image: "/images/nike-shirt.jpg",
    description:
      "محصول پیش‌نویس که هنوز منتشر نشده و نباید در فروشگاه دیده شود.",
    stock: 10,
    specs: {
      "نوع": "کفش ورزشی",
    },
  },
  {
    title: "Apple Watch Series 8 GPS 41mm",
    slug: "apple-watch-series-8-gps-41mm",
    category: "ساعت",
    brand: "Apple",
    owner: SUPPLIER_2,
    basePrice: 12_946_427,
    tags: [],
    scenario: "آرشیوشده (deletedAt) ولی دارای سفارش قدیمی",
    archivedDaysAgo: 20,
    price: 14_500_000,
    originalPrice: 14_500_000,
    discount: 0,
    image: "/images/apple-watch.jpg",
    description:
      "مدل قدیمی که آرشیو شده است؛ سفارش‌های قبلی آن باید سالم بمانند.",
    stock: 4,
    specs: {
      "اندازه بدنه": "41 میلی‌متر",
      "اتصال": "GPS",
    },
  },
  {
    title: "JBL Tune 520BT",
    slug: "jbl-tune-520bt",
    category: "هدفون",
    brand: "JBL",
    owner: null,
    scenario: "مالکیت Borjak (supplierId = NULL)",
    tags: ["جدید"],
    price: 3_150_000,
    originalPrice: 3_500_000,
    discount: 10,
    image: "/images/headphone.jpg",
    description:
      "هدفون بی‌سیم JBL Tune 520BT با باتری ۵۷ ساعته و صدای Pure Bass.",
    stock: 14,
    specs: {
      "نوع اتصال": "بلوتوث 5.3",
      "عمر باتری": "57 ساعت",
      "وزن": "157 گرم",
    },
  },
  {
    title: "Xiaomi Redmi Watch 5 Active",
    slug: "xiaomi-redmi-watch-5-active",
    category: "ساعت",
    brand: "Xiaomi",
    owner: null,
    scenario: "مالکیت Borjak (supplierId = NULL)",
    tags: ["جدید"],
    price: 4_200_000,
    originalPrice: 4_200_000,
    discount: 0,
    image: "/images/apple-watch.jpg",
    description:
      "ساعت هوشمند Xiaomi Redmi Watch 5 Active با نمایشگر ۲ اینچی و پایش ورزش.",
    stock: 9,
    specs: {
      "نمایشگر": "2 اینچ LCD",
      "ضدآب": "5 ATM",
      "عمر باتری": "18 روز",
    },
  },
];

export async function seedProducts({ prisma, rng, now }, { users }) {
  console.log("📦 Seeding products...");

  const categoryTitles = [
    ...new Set(products.map((product) => product.category)),
  ];

  const brandTitles = [
    ...new Set(products.map((product) => product.brand)),
  ];

  const tagTitles = [
    ...new Set(products.flatMap((product) => product.tags)),
  ];

  const categoryIds = new Map();

  for (const title of categoryTitles) {
    const row = await prisma.category.create({
      data: {
        title,
        slug: slugify(title),
      },
    });

    categoryIds.set(title, row.id);
  }

  const brandIds = new Map();

  for (const title of brandTitles) {
    const row = await prisma.brand.create({
      data: {
        title,
        slug: slugify(title),
      },
    });

    brandIds.set(title, row.id);
  }

  const tagIds = new Map();

  for (const title of tagTitles) {
    const row = await prisma.tag.create({
      data: {
        title,
        slug: slugify(title),
      },
    });

    tagIds.set(title, row.id);
  }

  const created = [];

  for (const item of products) {
    const {
      specs,
      images,
      category,
      brand,
      tags,
      owner,
      scenario,
      archivedDaysAgo,
      basePrice,
      ...data
    } = item;

    const supplierId = owner
      ? users.byPhone.get(owner)?.id ?? null
      : null;

    if (owner && !supplierId) {
      throw new Error(
        `[seed] unknown product owner ${owner} (${item.slug})`,
      );
    }

    let pricingData;

    if (supplierId) {
      if (!Number.isSafeInteger(basePrice) || basePrice <= 0) {
        throw new Error(
          `[seed] supplier product has invalid basePrice: ${item.slug}`,
        );
      }

      const pricing = calculateProductPricing({
        basePrice,
        discount: data.discount ?? 0,
      });

      if (
        pricing.originalPrice !== data.originalPrice ||
        pricing.price !== data.price
      ) {
        throw new Error(
          `[seed] pricing mismatch for ${item.slug}: ` +
          `expected price ${data.price} / originalPrice ${data.originalPrice}, ` +
          `calculated price ${pricing.price} / originalPrice ${pricing.originalPrice}`,
        );
      }

      pricingData = {
        basePrice: pricing.basePrice,
        commissionPercent: pricing.commissionPercent,
        price: pricing.price,
        originalPrice: pricing.originalPrice,
        discount: pricing.discount,
      };
    } else {
      // محصولات خود برجک Snapshot تسویه تأمین‌کننده ندارند.
      pricingData = {
        basePrice: null,
        commissionPercent: null,
      };
    }

    const createdAt = new Date(
      now.getTime() - rng.int(30, 150) * MS.day,
    );

    const deletedAt = archivedDaysAgo
      ? new Date(now.getTime() - archivedDaysAgo * MS.day)
      : null;

    const row = await prisma.product.create({
      data: {
        ...data,
        ...pricingData,

        supplierId,
        categoryId: categoryIds.get(category),
        brandId: brandIds.get(brand),

        isPublished: data.isPublished ?? true,

        // rating / reviewCount are filled by seedReviews.
        rating: 0,
        reviewCount: 0,

        // reservedStock is filled by seedOrders.
        reservedStock: 0,

        deletedAt,
        createdAt,

        images: images?.length
          ? {
              create: images.map((url) => ({ url })),
            }
          : undefined,

        specs: {
          create: Object.entries(specs ?? {}).map(
            ([key, value]) => ({ key, value }),
          ),
        },

        tags: tags.length
          ? {
              create: tags.map((tag) => ({
                tagId: tagIds.get(tag),
              })),
            }
          : undefined,
      },
    });

    created.push({
      ...row,
      ownerId: supplierId,
      scenario: scenario ?? null,
    });
  }

  console.log(`✅ ${created.length} products seeded`);

  return created;
}
