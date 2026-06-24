import HeroSlider from "../../components/HeroSlider";
import CategorySection from "../../components/CategorySection";
import SpecialOffers from "../../components/SpecialOffers";
import ProductGrid from "../../components/ProductGrid";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <HeroSlider />
      <CategorySection />
      <SpecialOffers />
      <ProductGrid />
    </div>
  );
}