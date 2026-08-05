export function toPersianPrice(price) {
  return new Intl.NumberFormat("fa-IR").format(price);
}