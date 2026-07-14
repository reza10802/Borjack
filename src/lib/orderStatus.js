// نگاشت وضعیت‌های enum (انگلیسی، سمت دیتابیس) به برچسب فارسی برای نمایش در UI
export const ORDER_STATUSES = [
    "PENDING",
    "PROCESSING",
    "READY_TO_SHIP",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
];

export const ORDER_STATUS_LABELS = {
    PENDING: "در انتظار پرداخت",
    PROCESSING: "در حال پردازش",
    READY_TO_SHIP: "آماده ارسال",
    SHIPPED: "ارسال شده",
    DELIVERED: "تحویل داده شده",
    CANCELLED: "لغو شده",
};

export const ORDER_STATUS_COLORS = {
    PENDING: "bg-yellow-100 text-yellow-700",
    PROCESSING: "bg-blue-100 text-blue-700",
    READY_TO_SHIP: "bg-indigo-100 text-indigo-700",
    SHIPPED: "bg-purple-100 text-purple-700",
    DELIVERED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
};