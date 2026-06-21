import ProductCard from "./ProductCard";

export default function SpecialOffers() {
    return (
        <section className="mb-10 rounded-2xl bg-black p-6 text-white">

            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">
                    پیشنهاد ویژه
                </h2>

                <button className="text-sm text-gray-300 hover:text-white transition">
                    مشاهده همه ←
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <ProductCard />
            </div>

        </section>
    );
}
