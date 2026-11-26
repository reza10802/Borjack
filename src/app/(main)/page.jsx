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

      <HeroSlider />

      <CategorySection />

      <SpecialOffers />

      <ProductGrid />
    </div>
  );
}