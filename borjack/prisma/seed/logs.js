function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(days = 90) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * days));
  return date;
}

const actions = [
  {
    action: "LOGIN",
    entityType: "Auth",
    description: "ورود به سیستم",
  },
  {
    action: "CREATE_PRODUCT",
    entityType: "Product",
    description: "ایجاد محصول",
  },
  {
    action: "UPDATE_PRODUCT",
    entityType: "Product",
    description: "ویرایش محصول",
  },
  {
    action: "DELETE_PRODUCT",
    entityType: "Product",
    description: "حذف محصول",
  },
  {
    action: "CREATE_ORDER",
    entityType: "Order",
    description: "ثبت سفارش",
  },
  {
    action: "UPDATE_ORDER_STATUS",
    entityType: "Order",
    description: "تغییر وضعیت سفارش",
  },
  {
    action: "UPDATE_USER",
    entityType: "User",
    description: "ویرایش کاربر",
  },
  {
    action: "DELETE_USER",
    entityType: "User",
    description: "حذف کاربر",
  },
  {
    action: "CREATE_TASK",
    entityType: "Task",
    description: "ایجاد تسک",
  },
  {
    action: "DELETE_TASK",
    entityType: "Task",
    description: "حذف تسک",
  },
];

export async function seedLogs(prisma) {
  console.log("📋 Seeding logs...");

  const staff = await prisma.user.findMany({
    where: {
      role: {
        in: ["ADMIN", "MANAGER"],
      },
    },
  });

  const products = await prisma.product.findMany();
  const orders = await prisma.order.findMany();
  const tasks = await prisma.task.findMany();
  const users = await prisma.user.findMany();

  for (let i = 0; i < 150; i++) {
    const actor = randomItem(staff);
    const action = randomItem(actions);

    let entityId = "SYSTEM";

    switch (action.entityType) {
      case "Product":
        entityId = String(randomItem(products).id);
        break;

      case "Order":
        entityId = String(randomItem(orders).id);
        break;

      case "Task":
        entityId = randomItem(tasks).id;
        break;

      case "User":
        entityId = randomItem(users).id;
        break;

      case "Auth":
        entityId = actor.id;
        break;
    }

    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: action.action,
        entityType: action.entityType,
        entityId,
        description: action.description,
        createdAt: randomDate(),
      },
    });
  }

  console.log("✅ Logs seeded");
}