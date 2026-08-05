function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(days = 60) {
  const date = new Date();

  date.setDate(
    date.getDate() - Math.floor(Math.random() * days)
  );

  return date;
}

const titles = [
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

const descriptions = [
  "در اولین فرصت انجام شود.",
  "با مشتری تماس گرفته شود.",
  "بعد از بررسی موجودی اقدام شود.",
  "اولویت بالا دارد.",
  "گزارش تهیه شود.",
  "نتیجه در پنل ثبت شود.",
];

const priorities = [
  "HIGH",
  "MEDIUM",
  "LOW",
];

export async function seedTasks(prisma) {

  console.log("📝 Seeding tasks...");

  const staff = await prisma.user.findMany({

    where: {

      role: {
        in: ["ADMIN", "MANAGER"],
      },

    },

  });

  if (staff.length < 2) return;

  for (let i = 0; i < 35; i++) {

    let from = randomItem(staff);

    let to = randomItem(staff);

    while (to.id === from.id) {
      to = randomItem(staff);
    }

    await prisma.task.create({

      data: {

        title: randomItem(titles),

        description: randomItem(descriptions),

        priority: randomItem(priorities),

        done: Math.random() > 0.6,

        fromId: from.id,

        toId: to.id,

        createdAt: randomDate(),

      },

    });

  }

  console.log("✅ Tasks seeded");

}