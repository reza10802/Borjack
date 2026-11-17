
export const TASK_PRIORITIES = Object.freeze([
  "LOW",
  "MEDIUM",
  "HIGH",
]);

export const TASK_STATUSES = Object.freeze([
  "TODO",
  "IN_PROGRESS",
  "COMPLETED",
]);

export const TASK_MAX_TITLE_LENGTH = 160;
export const TASK_MAX_DESCRIPTION_LENGTH = 5000;

export const TASK_DEFAULT_PAGE_SIZE = 10;
export const TASK_MAX_PAGE_SIZE = 50;

// اطلاعات مشترک ایجادکننده و دریافت‌کننده تسک
export const TASK_RELATIONS = {
  from: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
  to: {
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
    },
  },
};

// اعتبارسنجی اطلاعات ایجاد تسک
export function validateTaskCreateInput(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      valid: false,
      status: 400,
      error: "اطلاعات ارسالی معتبر نیست",
    };
  }

  const allowedKeys = [
    "title",
    "description",
    "priority",
    "toId",
    "dueAt",
  ];

  if (
    Object.keys(body).some(
      (key) => !allowedKeys.includes(key)
    )
  ) {
    return {
      valid: false,
      status: 400,
      error: "فیلد ارسالی مجاز نیست",
    };
  }

  const {
    title,
    description,
    priority = "MEDIUM",
    toId,
    dueAt,
  } = body;

  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > TASK_MAX_TITLE_LENGTH
  ) {
    return {
      valid: false,
      status: 400,
      error: `عنوان تسک الزامی است و نباید بیشتر از ${TASK_MAX_TITLE_LENGTH} کاراکتر باشد`,
    };
  }

  if (
    typeof toId !== "string" ||
    !toId.trim() ||
    toId.length > 128
  ) {
    return {
      valid: false,
      status: 400,
      error: "انتخاب گیرنده تسک الزامی است",
    };
  }

  if (!TASK_PRIORITIES.includes(priority)) {
    return {
      valid: false,
      status: 400,
      error: "اولویت تسک معتبر نیست",
    };
  }

  if (
    description != null &&
    (
      typeof description !== "string" ||
      description.trim().length >
        TASK_MAX_DESCRIPTION_LENGTH
    )
  ) {
    return {
      valid: false,
      status: 400,
      error: `توضیحات نباید بیشتر از ${TASK_MAX_DESCRIPTION_LENGTH} کاراکتر باشد`,
    };
  }

  let parsedDueAt = null;

  if (dueAt != null && dueAt !== "") {
    if (typeof dueAt !== "string") {
      return {
        valid: false,
        status: 400,
        error: "مهلت انجام تسک معتبر نیست",
      };
    }

    parsedDueAt = new Date(dueAt);

    if (Number.isNaN(parsedDueAt.getTime())) {
      return {
        valid: false,
        status: 400,
        error: "تاریخ مهلت انجام معتبر نیست",
      };
    }
  }

  return {
    valid: true,
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      priority,
      toId: toId.trim(),
      dueAt: parsedDueAt,
    },
  };
}

// دریافت تمام تسک‌ها با روابط مشترک
// برای بخش‌هایی که هنوز Pagination ندارند.
export async function getTasks(client, where) {
  return client.task.findMany({
    where,
    include: TASK_RELATIONS,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });
}

// دریافت صفحه‌ای تسک‌ها
export async function getPaginatedTasks(
  client,
  where,
  {
    page = 1,
    limit = TASK_DEFAULT_PAGE_SIZE,
  } = {}
) {
  const requestedPage = Number.isSafeInteger(Number(page))
    ? Math.max(1, Number(page))
    : 1;

  const pageSize = Number.isSafeInteger(Number(limit))
    ? Math.min(
        TASK_MAX_PAGE_SIZE,
        Math.max(1, Number(limit))
      )
    : TASK_DEFAULT_PAGE_SIZE;

  const total = await client.task.count({
    where,
  });

  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize)
  );

  // اگر آخرین تسک یک صفحه حذف شده باشد،
  // صفحه درخواستی به آخرین صفحه معتبر برمی‌گردد.
  const currentPage = Math.min(
    requestedPage,
    totalPages
  );

  const tasks = await client.task.findMany({
    where,
    include: TASK_RELATIONS,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });

  return {
    tasks,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages,
    },
  };
}

// ساخت تسک با اطلاعات مشترک
export async function createTask(client, {
  title,
  description,
  priority,
  dueAt,
  fromId,
  toId,
}) {
  return client.task.create({
    data: {
      title,
      description,
      priority,
      status: "TODO",
      done: false,
      dueAt,
      fromId,
      toId,
    },
    include: TASK_RELATIONS,
  });
}

// هماهنگ‌سازی وضعیت جدید با فیلد قدیمی done
export function buildTaskStatusUpdate(status, currentTask) {
  if (!TASK_STATUSES.includes(status)) {
    throw new Error("INVALID_TASK_STATUS");
  }

  const now = new Date();
  const completed = status === "COMPLETED";

  return {
    status,
    done: completed,
    completedAt: completed
      ? currentTask.status === "COMPLETED"
        ? currentTask.completedAt || now
        : now
      : null,
  };
}
