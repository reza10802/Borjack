import Link from "next/link";
import { categories } from "../lib/categories";

export default function CategorySection() {
    return (
        <section className="mb-10">
            <h2 className="mb-6 text-xl font-bold">دسته‌بندی‌ها</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {categories.map((category) => (
                    <Link
                        key={category.id}
                        href={`/search?category=${encodeURIComponent(category.title)}`}
                        className="flex flex-col items-center rounded-xl bg-white p-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition"
                    >
                        <span className="mb-2 text-3xl">{category.icon}</span>
                        <span className="text-sm text-gray-700">{category.title}</span>
                    </Link>
                ))}
            </div>
        </section>
    );
}