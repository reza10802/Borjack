"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { categories as categoryList } from "../../../lib/categories";
import ProductCard from "../../../components/ProductCard";
import BackButton from "../../../components/BackButton";

const MIN_PRICE = 0;
const MAX_PRICE = 150000000;

const categories = ["همه", ...categoryList.map(c => c.title)];
const sortOptions = [
    { value: "default", label: "پیش‌فرض" },
    { value: "price-asc", label: "ارزان‌ترین" },
    { value: "price-desc", label: "گران‌ترین" },
    { value: "rating", label: "بهترین امتیاز" },
    { value: "discount", label: "بیشترین تخفیف" },
];

const priceOptions = [
    { value: "all", label: "همه قیمت‌ها" },
    { value: "0-5000000", label: "زیر ۵ میلیون" },
    { value: "5000000-20000000", label: "۵ تا ۲۰ میلیون" },
    { value: "20000000-50000000", label: "۲۰ تا ۵۰ میلیون" },
    { value: "50000000-150000000", label: "بالای ۵۰ میلیون" },
];

const CustomSelect = ({ value, onChange, options, placeholder }) => (
    <div className="relative">
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="appearance-none w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-gray-400 transition cursor-pointer pr-4 pl-8"
        >
            {options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
        <svg className="absolute left-2.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
    </div>
);

export default function SearchPage() {
    const searchParams = useSearchParams();
    const [query, setQuery] = useState(searchParams.get("q") || "");
    const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "همه");
    const [sort, setSort] = useState("default");
    const [priceFilter, setPriceFilter] = useState("all");
    const [onlyDiscount, setOnlyDiscount] = useState(false);
    const [onlyInStock, setOnlyInStock] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const fromCategory = searchParams.get("category");

    useEffect(() => {
        setQuery(searchParams.get("q") || "");
        setSelectedCategory(searchParams.get("category") || "همه");
    }, [searchParams]);

    // ساخت query string برای API بر اساس فیلترهای فعلی
    const apiQuery = useMemo(() => {
        const params = new URLSearchParams();
        if (query.trim()) params.set("search", query.trim());
        if (selectedCategory !== "همه") params.set("category", selectedCategory);
        if (sort !== "default") params.set("sort", sort);
        if (priceFilter !== "all") {
            const [min, max] = priceFilter.split("-");
            params.set("minPrice", min);
            params.set("maxPrice", max);
        }
        if (onlyDiscount) params.set("discount", "true");
        if (onlyInStock) params.set("inStock", "true");
        return params.toString();
    }, [query, selectedCategory, sort, priceFilter, onlyDiscount, onlyInStock]);

    useEffect(() => {
        let active = true;
        setLoading(true);

        // یه کمی debounce برای جستجوی تایپی، فیلترها فوری اعمال می‌شن
        const delay = query ? 350 : 0;
        const timer = setTimeout(() => {
            fetch(`/api/products${apiQuery ? `?${apiQuery}` : ""}`)
                .then(res => res.ok ? res.json() : [])
                .then(data => { if (active) setProducts(data); })
                .catch(() => { if (active) setProducts([]); })
                .finally(() => { if (active) setLoading(false); });
        }, delay);

        return () => { active = false; clearTimeout(timer); };
    }, [apiQuery]);

    const resetFilters = () => {
        setSelectedCategory("همه");
        setPriceFilter("all");
        setOnlyDiscount(false);
        setOnlyInStock(false);
        setSort("default");
    };

    const FilterPanel = () => (
        <div className="flex flex-col gap-5">

            {/* دسته‌بندی */}
            <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">دسته‌بندی</label>
                <CustomSelect
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    options={categories.map(c => ({ value: c, label: c }))}
                />
            </div>

            {/* محدوده قیمت */}
            <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">محدوده قیمت</label>
                <CustomSelect
                    value={priceFilter}
                    onChange={setPriceFilter}
                    options={priceOptions}
                />
            </div>

            {/* فیلترها */}
            <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${onlyDiscount ? "bg-black border-black" : "border-gray-300 group-hover:border-gray-400"}`}
                        onClick={() => setOnlyDiscount(s => !s)}>
                        {onlyDiscount && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>}
                    </div>
                    <span className="text-sm text-gray-600">فقط تخفیف‌دار</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${onlyInStock ? "bg-black border-black" : "border-gray-300 group-hover:border-gray-400"}`}
                        onClick={() => setOnlyInStock(s => !s)}>
                        {onlyInStock && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>}
                    </div>
                    <span className="text-sm text-gray-600">فقط موجود</span>
                </label>
            </div>

            {/* ریست */}
            <button onClick={resetFilters}
                className="w-full py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition">
                پاک کردن فیلترها
            </button>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8" dir="rtl">

            {fromCategory && <BackButton />}

            <div className="relative mb-6">
                <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="جستجو در محصولات..."
                    className="w-full border border-gray-200 bg-white rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-gray-400 transition pr-12" />
                <svg className="absolute top-4 right-4 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                {query && <button onClick={() => setQuery("")} className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 transition">✕</button>}
            </div>

            <div className="flex gap-6">

                {/* فیلتر دسکتاپ */}
                <aside className="hidden lg:block w-56 shrink-0">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-24">
                        <FilterPanel />
                    </div>
                </aside>

                <div className="flex-1">
                    <div className="flex items-center justify-between mb-4 gap-3">
                        <span className="text-sm text-gray-500">{loading ? "..." : `${products.length} محصول`}</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setShowFilters(s => !s)}
                                className="lg:hidden flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h4" />
                                </svg>
                                فیلتر
                            </button>
                            <CustomSelect value={sort} onChange={setSort} options={sortOptions} />
                        </div>
                    </div>

                    {showFilters && (
                        <div className="lg:hidden bg-white border border-gray-100 rounded-2xl p-5 mb-4">
                            <FilterPanel />
                        </div>
                    )}

                    {loading ? (
                        <div className="text-center py-20 text-gray-400 text-sm">در حال بارگذاری...</div>
                    ) : products.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <p className="text-4xl mb-3">🔍</p>
                            <p className="text-sm">محصولی با این مشخصات پیدا نشد</p>
                            <button onClick={resetFilters} className="mt-4 text-sm text-black underline">پاک کردن فیلترها</button>
                        </div>
                    ) : (
                        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                            {products.map(product => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}