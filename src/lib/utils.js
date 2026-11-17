export function toPersianPrice(price) {
  return new Intl.NumberFormat("fa-IR").format(price);
}

// فقط مسیرهای معتبر برای next/image: "/..." یا http(s)://
// مقدارهای خراب مثل "x" به null تبدیل می‌شن تا صفحه کرش نکنه
export function safeImageSrc(src) {
  if (typeof src !== "string") return null;
  const s = src.trim();
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:" ? s : null;
  } catch {
    return null;
  }
}