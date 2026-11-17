import { MS } from "./_lib.js";

const TITLES = [
  "بررسی سفارش",
  "پیگیری ارسال",
  "بررسی موجودی انبار",
  "پاسخ به مشتری",
  "ثبت محصول جدید",
  "بررسی مرجوعی",
  "اصلاح قیمت",
  "هماهنگی با انبار",
  "بررسی نظرات",
  "کنترل کیفیت",
];

const DESCRIPTIONS = [
  "در اولین فرصت انجام شود.",
  "با مشتری تماس گرفته شود.",
  "بعد از بررسی موجودی اقدام شود.",
  "اولویت بالا دارد.",
  "گزارش تهیه شود.",
  "نتیجه در پنل ثبت شود.",
];

export async function seedTasks({ prisma, rng, now }, { users }) {
  console.log("📝 Seeding tasks...");

  // Tasks are ADMIN-only now. With a single admin they are personal to-dos (from = to).
  const staff = [...users.admins].filter((u) => u.isActive);

  if (!staff.length) {
    console.log("⚠️  No active admin for tasks, skipping");
    return [];
  }

  const tasks = [];

  for (let i = 0; i < 12; i++) {
    const from = rng.pick(staff);
    const to = rng.pick(staff);

    const task = await prisma.task.create({
      data: {
        title: rng.pick(TITLES),
        description: rng.pick(DESCRIPTIONS),
        priority: rng.pick(["HIGH", "MEDIUM", "LOW"]),
        done: rng.chance(0.4),
        fromId: from.id,
        toId: to.id,
        createdAt: new Date(now.getTime() - rng.int(0, 60) * MS.day),
      },
    });

    tasks.push(task);
  }

  console.log(`✅ ${tasks.length} tasks seeded`);
  return tasks;
}
