import { categories } from "../lib/data/categories";

export default function CategorySection() {
    return (
        <section className="mb-10">
            <h2 className="mb-6 text-xl font-bold">
                دسته‌بندی‌ها
            </h2>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {categories.map((category) => (
                    <div
                        key={category.id}
                        className="flex flex-col items-center rounded-xl bg-white p-4 shadow-sm hover:shadow-md transition cursor-pointer"
                    >
                        <span className="mb-2 text-3xl">
                            {category.icon}
                        </span>
                        <span className="text-sm text-gray-700">
                            {category.title}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
}
