import { MS, addMs } from "./_lib.js";

// Audit logs are derived from the data that was actually seeded (products, orders,
// tasks) instead of random entity ids, so every log points to something that exists
// and its author/time make sense. Only fields that exist on AuditLog are written;
// passwords/tokens are never included.

const STATUS_LABEL = {
  PROCESSING: "در حال پردازش",
  READY_TO_SHIP: "آماده ارسال",
  SHIPPED: "ارسال‌شده",
  DELIVERED: "تحویل‌شده",
  CANCELLED: "لغو‌شده",
};

const FLOW = ["PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"];

export async function seedLogs({ prisma, rng, now }, { users, products, orders, tasks }) {
  console.log("📋 Seeding logs...");

  const staff = [...users.admins]; // only ADMIN performs panel actions in P1
  const admin = users.admins[0];
  const byId = new Map(users.all.map((u) => [u.id, u]));
  const logs = [];

  const add = (actorId, action, entityType, entityId, description, createdAt, extra = {}) => {
    const actor = byId.get(actorId);
    logs.push({
      userId: actorId,
      userLabel: actor?.name ?? null,
      action,
      entityType,
      entityId: String(entityId),
      description,
      ipAddress: `192.0.2.${rng.int(1, 250)}`, // TEST-NET-1 documentation range
      createdAt,
      ...extra,
    });
  };

  // Products: in P1 only ADMIN creates/edits products (supplier editing arrives in P2).
  for (const product of products) {
    const author = admin.id;
    add(author, "CREATE_PRODUCT", "Product", product.id, `محصول «${product.title}» ایجاد شد`, product.createdAt, {
      newValue: { title: product.title, price: product.price, stock: product.stock },
    });

    if (rng.chance(0.3)) {
      add(author, "UPDATE_PRODUCT", "Product", product.id, `ویرایش قیمت «${product.title}»`, addMs(product.createdAt, rng.int(2, 20) * MS.day), {
        oldValue: { price: product.originalPrice },
        newValue: { price: product.price },
      });
    }

    if (product.deletedAt) {
      add(author, "DELETE_PRODUCT", "Product", product.id, `محصول «${product.title}» آرشیو شد`, product.deletedAt);
    }
  }

  // Orders: created by the customer, then moved through the fulfilment flow by staff.
  for (const order of orders) {
    add(order.userId, "CREATE_ORDER", "Order", order.id, `ثبت سفارش #${order.id}`, order.createdAt, {
      newValue: { total: order.total },
    });

    const reached = FLOW.indexOf(order.status);
    if (reached >= 0) {
      let at = order.paidAt ?? order.createdAt;
      for (let i = 0; i <= reached; i++) {
        at = addMs(at, rng.int(1, 18) * MS.hour);
        if (at > now) at = now;
        const status = FLOW[i];
        add(order.staffActorId, "UPDATE_ORDER_STATUS", "Order", order.id, `تغییر وضعیت سفارش به ${STATUS_LABEL[status]}`, at, {
          oldValue: { status: i === 0 ? "PENDING" : FLOW[i - 1] },
          newValue: { status },
        });
      }
    } else if (order.status === "CANCELLED" && order.paymentStatus === "PAID") {
      add(admin.id, "UPDATE_ORDER_STATUS", "Order", order.id, `لغو سفارش پرداخت‌شده #${order.id}`, order.updatedAt, {
        newValue: { status: "CANCELLED" },
      });
    }
  }

  for (const task of tasks) {
    add(task.fromId, "CREATE_TASK", "Task", task.id, "ایجاد تسک", task.createdAt);
    if (task.done) {
      add(task.toId, "UPDATE_TASK", "Task", task.id, "انجام‌شده علامت خورد", addMs(task.createdAt, rng.int(1, 5) * MS.day));
    }
  }

  for (const user of users.all.filter((u) => !u.isActive)) {
    add(admin.id, "BLOCK_USER", "User", user.id, `کاربر ${user.name} مسدود شد`, new Date(now.getTime() - 10 * MS.day));
  }

  // Logins over the last 30 days.
  for (let i = 0; i < 60; i++) {
    const actor = rng.chance(0.6) ? rng.pick(staff) : rng.pick(users.customers.filter((u) => u.isActive));
    add(actor.id, "LOGIN", "Auth", actor.id, "ورود به سیستم", new Date(now.getTime() - rng.int(0, 30 * 24 * 60) * MS.minute));
  }

  // Never in the future.
  for (const log of logs) if (log.createdAt > now) log.createdAt = now;

  await prisma.auditLog.createMany({ data: logs });

  console.log(`✅ ${logs.length} logs seeded`);
}
