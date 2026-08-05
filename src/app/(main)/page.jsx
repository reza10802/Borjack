import HeroSlider from "@/components/HeroSlider";
import CategorySection from "@/components/CategorySection";
import SpecialOffers from "@/components/SpecialOffers";
import ProductGrid from "@/components/ProductGrid";

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