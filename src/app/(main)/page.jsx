import HeroSlider from "@/components/HeroSlider";
import CategorySection from "@/components/CategorySection";
import SpecialOffers from "@/components/SpecialOffers";
import ProductGrid from "@/components/ProductGrid";

export const dynamic = "force-dynamic";

export const metadata = {
  description:
    "فروشگاه اینترنتی برجک (Borjak)؛ مشاهده و خرید کالاهای متنوع از فروشندگان مختلف، بررسی محصولات و قیمت‌ها و ثبت سفارش آنلاین.",

  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <div className="container-page py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-black">
          فروشگاه اینترنتی برجک
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-muted)]">
          برجک (Borjak)، فروشگاه اینترنتی برای مشاهده،
          بررسی و خرید کالاهای متنوع از فروشندگان مختلف است.
          محصولات و قیمت‌ها را بررسی کنید و خرید خود را
          به‌صورت آنلاین انجام دهید.
        </p>
      </header>

      <HeroSlider />

      <CategorySection />

      <SpecialOffers />

      <ProductGrid />
    </div>
  );
}