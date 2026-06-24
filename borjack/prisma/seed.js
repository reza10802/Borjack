import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("🌱 Seeding database...");

    await prisma.review.deleteMany();
    await prisma.productSpec.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();

    await prisma.product.create({
        data: {
            title: "گوشی سامسونگ Galaxy S24",
            price: 32000000, originalPrice: 38000000, discount: 15,
            category: "موبایل", image: "/images/samsung-s24.jpg",
            description: "گوشی سامسونگ Galaxy S24 با پردازنده Snapdragon 8 Gen 3.",
            inStock: true, rating: 4.5, reviewCount: 128,
            images: { create: [{ url: "/images/samsung-s24.jpg" }] },
            specs: { create: [{ key: "پردازنده", value: "Snapdragon 8 Gen 3" }, { key: "رم", value: "8 گیگابایت" }, { key: "حافظه", value: "256 گیگابایت" }, { key: "دوربین", value: "50 مگاپیکسل" }, { key: "باتری", value: "4000 mAh" }] },
            reviews: { create: [{ user: "علی رضایی", rating: 5, comment: "عالیه", date: "1403/03/10" }, { user: "مریم احمدی", rating: 4, comment: "خوبه ولی گرونه", date: "1403/02/25" }] }
        }
    });

    await prisma.product.create({
        data: {
            title: "لپ‌تاپ اپل MacBook Air M3",
            price: 85000000, originalPrice: 95000000, discount: 10,
            category: "لپ‌تاپ", image: "/images/macbook-air.jpg",
            description: "مک‌بوک ایر با تراشه M3 اپل، باتری ۱۸ ساعته.",
            inStock: true, rating: 4.8, reviewCount: 74,
            images: { create: [{ url: "/images/macbook-air.jpg" }] },
            specs: { create: [{ key: "پردازنده", value: "Apple M3" }, { key: "رم", value: "8 گیگابایت" }, { key: "باتری", value: "18 ساعت" }] },
            reviews: { create: [{ user: "سارا حسینی", rating: 5, comment: "باتریش عالیه", date: "1403/03/05" }] }
        }
    });

    await prisma.product.create({
        data: {
            title: "هدفون Sony WH-1000XM5",
            price: 12500000, originalPrice: 15000000, discount: 17,
            category: "هدفون", image: "/images/sony-headphone.jpg",
            description: "هدفون بی‌سیم سونی با بهترین حذف نویز.",
            inStock: true, rating: 4.7, reviewCount: 210,
            images: { create: [{ url: "/images/sony-headphone.jpg" }] },
            specs: { create: [{ key: "باتری", value: "30 ساعت" }, { key: "بلوتوث", value: "5.2" }] },
            reviews: { create: [{ user: "کیان مرادی", rating: 5, comment: "حذف نویزش فوق‌العاده‌ست", date: "1403/03/01" }] }
        }
    });

    await prisma.product.create({
        data: {
            title: "ساعت هوشمند Apple Watch Series 9",
            price: 18000000, originalPrice: 18000000, discount: 0,
            category: "ساعت", image: "/images/apple-watch.jpg",
            description: "اپل واچ سری ۹ با تراشه S9.",
            inStock: false, rating: 4.6, reviewCount: 95,
            images: { create: [{ url: "/images/apple-watch.jpg" }] },
            specs: { create: [{ key: "تراشه", value: "Apple S9" }, { key: "مقاومت آب", value: "50 متر" }] },
            reviews: { create: [{ user: "دانیال صفری", rating: 5, comment: "بهترین ساعت بازاره", date: "1403/02/28" }] }
        }
    });

    await prisma.product.create({
        data: {
            title: "دوربین Sony Alpha A7 IV",
            price: 120000000, originalPrice: 130000000, discount: 8,
            category: "دوربین", image: "/images/sony-camera.jpg",
            description: "دوربین میرورلس فول‌فریم سونی با سنسور ۳۳ مگاپیکسل.",
            inStock: true, rating: 4.9, reviewCount: 43,
            images: { create: [{ url: "/images/sony-camera.jpg" }] },
            specs: { create: [{ key: "سنسور", value: "33 مگاپیکسل" }, { key: "فیلمبرداری", value: "4K 60fps" }] },
            reviews: { create: [{ user: "پیمان نادری", rating: 5, comment: "حرفه‌ای‌ترین دوربین", date: "1403/03/08" }] }
        }
    });

    await prisma.product.create({
        data: {
            title: "تی‌شرت اسپرت نایک",
            price: 850000, originalPrice: 1200000, discount: 29,
            category: "پوشاک", image: "/images/nike-shirt.jpg",
            description: "تی‌شرت ورزشی نایک با پارچه Dri-FIT.",
            inStock: true, rating: 4.3, reviewCount: 312,
            images: { create: [{ url: "/images/nike-shirt.jpg" }] },
            specs: { create: [{ key: "جنس", value: "Dri-FIT" }, { key: "سایزبندی", value: "S, M, L, XL" }] },
            reviews: { create: [{ user: "نوید صالحی", rating: 4, comment: "کیفیت خوبیه", date: "1403/03/12" }] }
        }
    });

    console.log("✅ Database seeded successfully!");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());