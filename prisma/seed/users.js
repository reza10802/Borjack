import bcrypt from "bcryptjs";
import { MS } from "./_lib.js";

// Real ids from iran-cities-json (the old seed used cityId 1, which is not Tehran).
const LOCATIONS = {
  tehran: { provinceId: 8, provinceName: "تهران", cityId: 394, cityName: "تهران" },
  isfahan: { provinceId: 4, provinceName: "اصفهان", cityId: 122, cityName: "اصفهان" },
  shiraz: { provinceId: 17, provinceName: "فارس", cityId: 911, cityName: "شیراز" },
  tabriz: { provinceId: 1, provinceName: "آذربایجان شرقی", cityId: 361, cityName: "تبریز" },
  mashhad: { provinceId: 11, provinceName: "خراسان رضوی", cityId: 1326, cityName: "مشهد" },
};

const ADDRESSES = [
  ["tehran", "خیابان آزادی، کوچه تست، پلاک ۱۲", "1134567890"],
  ["tehran", "بلوار کشاورز، خیابان شهید نمونه، پلاک ۳", "1416934567"],
  ["isfahan", "خیابان چهارباغ بالا، کوچه ۱۴، پلاک ۸", "8134567890"],
  ["shiraz", "بلوار چمران، کوچه ۵، پلاک ۲۱", "7134567890"],
  ["tabriz", "خیابان ولیعصر، کوچه گلستان، پلاک ۹", "5134567890"],
  ["mashhad", "بلوار وکیل‌آباد، وکیل‌آباد ۱۲، پلاک ۴", "9134567890"],
];

// Phone numbers and names are kept from the previous seed so existing
// bookmarks/tests keep working. `seedNote` is only a hint printed at the end.
function userDefinitions({ ADMIN, SUPPLIER, CUSTOMER }) {
  return [
    { name: "Reza", phone: "09116001260", role: ADMIN, seedNote: "ادمین" },
    { name: "Reza2", phone: "09116011003", role: SUPPLIER, seedNote: "تأمین‌کننده ۱ (موبایل و لپ‌تاپ)" },
    { name: "علی کریمی", phone: "09120000003", role: SUPPLIER, seedNote: "تأمین‌کننده ۲ (هدفون و ساعت)" },
    { name: "سودابه رضایی", phone: "09120000016", role: SUPPLIER, seedNote: "تأمین‌کننده ۳ (دوربین و لپ‌تاپ)" },
    { name: "محسن کاظمی", phone: "09120000017", role: SUPPLIER, seedNote: "تأمین‌کننده ۴ (پوشاک)" },

    { name: "امیر محمدی", phone: "09120000004", role: CUSTOMER, isPhoneVerified: false, seedNote: "تأییدنشده (تست مسیر OTP)" },
    { name: "سارا احمدی", phone: "09120000005", role: CUSTOMER, seedNote: "سبد خرید و علاقه‌مندی دارد" },
    { name: "نگار حسینی", phone: "09120000006", role: CUSTOMER },
    { name: "میلاد اکبری", phone: "09120000007", role: CUSTOMER },
    { name: "محمد صالحی", phone: "09120000008", role: CUSTOMER },
    { name: "مریم شریفی", phone: "09120000009", role: CUSTOMER },
    { name: "عرفان نادری", phone: "09120000010", role: CUSTOMER },
    { name: "پویا اسدی", phone: "09120000011", role: CUSTOMER },
    { name: "زهرا قاسمی", phone: "09120000012", role: CUSTOMER },
    { name: "حسین عباسی", phone: "09120000013", role: CUSTOMER, isActive: false, seedNote: "غیرفعال (تست ورود کاربر مسدود)" },
    { name: "سعید جعفری", phone: "09120000014", role: CUSTOMER },
    { name: "یگانه موسوی", phone: "09120000015", role: CUSTOMER },
  ];
}

export async function seedUsers({ prisma, roles, rng, now }) {
  console.log("👥 Seeding users...");

  const password = await bcrypt.hash(process.env.SEED_PASSWORD || "wwwwww", 10);

  const created = [];
  let addressIndex = 0;

  for (const def of userDefinitions(roles)) {
    const { seedNote, ...data } = def;
    const isPhoneVerified = data.isPhoneVerified ?? true;
    const joinedAt = new Date(now.getTime() - rng.int(100, 200) * MS.day);

    const user = await prisma.user.create({
      data: {
        ...data,
        password,
        isActive: data.isActive ?? true,
        isPhoneVerified,
        phoneVerifiedAt: isPhoneVerified ? joinedAt : null,
        createdAt: joinedAt,
      },
    });

    // Every customer gets one default address (used for order snapshots).
    let address = null;
    if (user.role === roles.CUSTOMER) {
      const [loc, line, postalCode] = ADDRESSES[addressIndex++ % ADDRESSES.length];
      address = await prisma.address.create({
        data: {
          userId: user.id,
          receiverName: user.name,
          receiverPhone: user.phone,
          ...LOCATIONS[loc],
          address: line,
          postalCode,
          isDefault: true,
        },
      });
    }

    created.push({ ...user, seedNote, address });
  }

  console.log(`✅ ${created.length} users seeded`);

  return {
    all: created,
    admins: created.filter((u) => u.role === roles.ADMIN),
    suppliers: created.filter((u) => u.role === roles.SUPPLIER),
    customers: created.filter((u) => u.role === roles.CUSTOMER),
    byPhone: new Map(created.map((u) => [u.phone, u])),
  };
}

// Every phone this seed creates. The seed guard uses it as a tripwire: a database that holds
// any OTHER user is treated as real data and is never wiped.
export const SEED_USER_PHONES = userDefinitions({ ADMIN: "ADMIN", SUPPLIER: "SUPPLIER", CUSTOMER: "CUSTOMER" }).map(
  (u) => u.phone,
);
