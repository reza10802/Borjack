const orderStatuses = [
  "PENDING",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const paymentStatuses = [
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(days = 90) {
  const date = new Date();

  date.setDate(
    date.getDate() - Math.floor(Math.random() * days)
  );

  return date;
}

export async function seedOrders(prisma) {
  console.log("🛒 Seeding orders...");

  const customers = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
    },
  });

  const products = await prisma.product.findMany();

  for (let i = 0; i < 70; i++) {
    const customer = randomItem(customers);

    const itemsCount = Math.floor(Math.random() * 5) + 1;

    let total = 0;

    const order = await prisma.order.create({
      data: {
        userId: customer.id,

        total: 0,

        status: randomItem(orderStatuses),

        paymentStatus: randomItem(paymentStatuses),

        receiverName: customer.name,
        receiverPhone: customer.phone,

        provinceId: 8,
        provinceName: "تهران",

        cityId: 1,
        cityName: "تهران",

        address: "خیابان آزادی، کوچه تست، پلاک ۱۲",

        postalCode: "1234567890",

        createdAt: randomDate(),
      },
    });

    for (let j = 0; j < itemsCount; j++) {
      const product = randomItem(products);

      const quantity = Math.floor(Math.random() * 3) + 1;

      total += product.price * quantity;

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          quantity,
          price: product.price,
        },
      });
    }

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        total,
      },
    });
  }

  console.log("✅ Orders seeded");
}