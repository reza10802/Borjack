import bcrypt from "bcryptjs";

export async function seedUsers(prisma) {
  console.log("👥 Seeding users...");

  const password = await bcrypt.hash("wwwwww", 10);

  const users = [
    {
      name: "Reza",
      phone: "09116001260",
      password,
      role: "ADMIN",
      isActive: true,
    },

    {
      name: "Reza2",
      phone: "09116011003",
      password,
      role: "MANAGER",
      isActive: true,
    },

    {
      name: "علی کریمی",
      phone: "09120000003",
      password,
      role: "MANAGER",
      isActive: true,
    },

    {
      name: "امیر محمدی",
      phone: "09120000004",
      password,
      role: "CUSTOMER",
      isActive: true,
    },

    {
      name: "سارا احمدی",
      phone: "09120000005",
      password,
      role: "CUSTOMER",
      isActive: true,
    },

    {
      name: "نگار حسینی",
      phone: "09120000006",
      password,
      role: "CUSTOMER",
      isActive: true,
    },

    {
      name: "میلاد اکبری",
      phone: "09120000007",
      password,
      role: "CUSTOMER",
      isActive: true,
    },

    {
      name: "محمد صالحی",
      phone: "09120000008",
      password,
      role: "CUSTOMER",
      isActive: true,
    },

    {
      name: "مریم شریفی",
      phone: "09120000009",
      password,
      role: "CUSTOMER",
      isActive: true,
    },

    {
      name: "عرفان نادری",
      phone: "09120000010",
      password,
      role: "CUSTOMER",
      isActive: true,
    },

    {
      name: "پویا اسدی",
      phone: "09120000011",
      password,
      role: "CUSTOMER",
      isActive: true,
    },

    {
      name: "زهرا قاسمی",
      phone: "09120000012",
      password,
      role: "CUSTOMER",
      isActive: true,
    },

    {
      name: "حسین عباسی",
      phone: "09120000013",
      password,
      role: "CUSTOMER",
      isActive: false,
    },

    {
      name: "سعید جعفری",
      phone: "09120000014",
      password,
      role: "CUSTOMER",
      isActive: true,
    },

    {
      name: "یگانه موسوی",
      phone: "09120000015",
      password,
      role: "CUSTOMER",
      isActive: true,
    },
  ];

  for (const user of users) {
    await prisma.user.create({
      data: user,
    });
  }

  console.log("✅ Users seeded");
}
