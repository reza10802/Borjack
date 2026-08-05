"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import BackButton from "@/components/BackButton";
import Select from "@/components/ui/Select";
import Pagination from "@/components/pagination";

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

function SearchContent() {
    const searchParams = useSearchParams();
    const [query, setQuery] = useState(searchParams.get("q") || "");
    const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "همه");
    const [selectedBrand, setSelectedBrand] = useState(searchParams.get("brand") || "همه");
    const [selectedTag, setSelectedTag] = useState(
        searchParams.get("tag") || "همه"
    );

    const [tags, setTags] = useState([]);
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [sort, setSort] = useState("default");
    const [priceFilter, setPriceFilter] = useState("all");
    const [onlyDiscount, setOnlyDiscount] = useState(false);
    const [onlyInStock, setOnlyInStock] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({
        total: 0,
        currentPage: 1,
        totalPages: 1,
        limit: 20,
    });
    const fromCategory = searchParams.get("category");

    // خواندن دسته‌بندی‌ها از API
    useEffect(() => {
        fetch("/api/categories")
            .then((r) => (r.ok ? r.json() : []))
            .then((d) => {
                setCategories(["همه", ...d.map((c) => c.title)]);
            });

        fetch("/api/brands")
            .then((r) => (r.ok ? r.json() : { brands: [] }))
            .then((d) => {
                setBrands(["همه", ...(d.brands || []).map((b) => b.title)]);
            });

        fetch("/api/tags")
            .then((r) => (r.ok ? r.json() : { tags: [] }))
            .then((d) => {
                setTags(["همه", ...(d.tags || []).map((t) => t.title)]);
            });
    }, []);

    useEffect(() => {
        setPage(1);
    }, [
        query,
        selectedCategory,
        selectedBrand,
        sort,
        priceFilter,
        onlyDiscount,
        onlyInStock,
    ]);

    useEffect(() => {
        setQuery(searchParams.get("q") || "");
        setSelectedCategory(searchParams.get("category") || "همه");
        setSelectedBrand(searchParams.get("brand") || "همه");
    }, [searchParams]);

    const apiQuery = useMemo(() => {
        const params = new URLSearchParams();
        if (query.trim()) params.set("search", query.trim());
        if (selectedCategory !== "همه") params.set("category", selectedCategory);
        if (selectedBrand !== "همه") params.set("brand", selectedBrand);
        if (selectedTag !== "همه")
            params.set("tag", selectedTag);
        if (sort !== "default") params.set("sort", sort);
        if (priceFilter !== "all") {
            const [min, max] = priceFilter.split("-");
            params.set("minPrice", min);
            params.set("maxPrice", max);
        }
        if (onlyDiscount) params.set("discount", "true");
        if (onlyInStock) params.set("inStock", "true");
        params.set("page", page);
        params.set("limit", 20);
        return params.toString();
    }, [query, selectedCategory, selectedBrand, selectedTag, sort, priceFilter, onlyDiscount, page, onlyInStock,]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        const delay = query ? 350 : 0;
        const timer = setTimeout(() => {
            fetch(`/api/products${apiQuery ? `?${apiQuery}` : ""}`)
                .then(res => res.ok ? res.json() : [])
                .then((data) => {
                    if (!active) return;

                    setProducts(data.products || []);
                    setPagination(data.pagination);
                })
                .catch(() => { if (active) setProducts([]); })
                .finally(() => { if (active) setLoading(false); });
        }, delay);
        return () => { active = false; clearTimeout(timer); };
    }, [apiQuery]);

    const resetFilters = () => {
        setSelectedCategory("همه");
        setSelectedBrand("همه");
        setSelectedTag("همه");
        setPriceFilter("all");
        setOnlyDiscount(false);
        setOnlyInStock(false);
        setSort("default");
    };

    const FilterPanel = () => (
        <div className="flex flex-col gap-5">
            <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">دسته‌بندی</label>
                <Select
                    value={selectedCategory}
                    instanceId="category-select"
                    onChange={setSelectedCategory}
                    options={categories.map(c => ({ value: c, label: c }))}
                />
            </div>
            <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">
                    برند
                </label>

                <Select
                    value={selectedBrand}
                    instanceId="brand-select"
                    onChange={setSelectedBrand}
                    options={brands.map((b) => ({
                        value: b,
                        label: b,
                    }))}
                />
            </div>
            <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">
                    تگ
                </label>

                <Select
                    value={selectedTag}
                    instanceId="tag-select"
                    onChange={setSelectedTag}
                    options={tags.map((t) => ({
                        value: t,
                        label: t,
                    }))}
                />
            </div>
            <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">محدوده قیمت</label>
                <Select value={priceFilter} instanceId="price-select" onChange={setPriceFilter} options={priceOptions} />
            </div>
            <div className="flex flex-col gap-2.5">
                <label onClick={() => setOnlyDiscount(s => !s)} className="flex items-center gap-2.5 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${onlyDiscount ? "bg-orange-500 border-orange-500" : "border-gray-300 group-hover:border-gray-400"}`}
                    >
                        {onlyDiscount && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>}
                    </div>
                    <span className="text-sm text-gray-600">فقط تخفیف‌دار</span>
                </label>
                <label onClick={() => setOnlyInStock(s => !s)} className="flex items-center gap-2.5 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${onlyInStock ? "bg-orange-500 border-orange-500" : "border-gray-300 group-hover:border-gray-400"}`}>
                        {onlyInStock && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>}
                    </div>
                    <span className="text-sm text-gray-600">فقط موجود</span>
                </label>
            </div>
            <button onClick={resetFilters}
                className="w-full py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-accent)] transition">
                پاک کردن فیلترها
            </button>
        </div>
    );

    return (
        <div className="container-page py-10" dir="rtl">
            {fromCategory && <BackButton />}
            <div className="mb-8">
                <h1 className="section-title">جستجوی محصولات</h1>
                <p className="muted mt-2 text-sm">
                    محصول مورد نظر خود را پیدا کنید
                </p>
            </div>
            <div className="relative mb-6">
                <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="جستجو در محصولات..."
                    className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-4 pr-12 pl-10 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)] transition" />
                <svg className="absolute top-4 right-4 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                {query && <button onClick={() => setQuery("")} className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 transition">✕</button>}
            </div>
            <div className="flex gap-6">
                <aside className="hidden lg:block w-56 shrink-0">
                    <div className="card sticky top-24 p-6">
                        <FilterPanel />
                    </div>
                </aside>
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-4 gap-3">
                        {(selectedCategory !== "همه" ||
                            selectedBrand !== "همه" ||
                            onlyDiscount ||
                            onlyInStock ||
                            priceFilter !== "all") && (
                                <div className="mb-5 flex flex-wrap gap-2">
                                    {selectedCategory !== "همه" && (
                                        <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs">
                                            {selectedCategory}
                                        </span>
                                    )}

                                    {selectedBrand !== "همه" && (
                                        <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs">
                                            {selectedBrand}
                                        </span>
                                    )}

                                    {onlyDiscount && (
                                        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs text-orange-600">
                                            تخفیف‌دار
                                        </span>
                                    )}

                                    {onlyInStock && (
                                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs text-green-600">
                                            موجود
                                        </span>
                                    )}
                                </div>
                            )}
                        <span className="muted text-sm">{loading ? "..." : `${products.length} محصول`}</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setShowFilters(s => !s)}
                                className="lg:hidden flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text)] hover:border-[var(--color-accent)] transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h4" />
                                </svg>
                                فیلتر
                            </button>
                            <Select value={sort} instanceId="sort-select" onChange={setSort} options={sortOptions} />
                        </div>
                    </div>
                    {showFilters && (
                        <div className="card lg:hidden mb-5 p-6">
                            <FilterPanel />
                        </div>
                    )}

                    {selectedTag !== "همه" && (
                        <span className="rounded-full bg-[var(--color-surface-2)]px-3 py-1 text-xs">
                            {selectedTag}
                        </span>
                    )}

                    {loading ? (
                        <div className="text-center py-20 text-gray-400 text-sm">در حال بارگذاری...</div>
                    ) : products.length === 0 ? (
                        <div className="card py-20 text-center">
                            <p className="text-4xl mb-3">🔍</p>
                            <p className="muted text-sm">محصولی با این مشخصات پیدا نشد</p>
                            <button onClick={resetFilters} className="mt-5 text-sm font-medium text-orange-500 hover:text-orange-600 transition">پاک کردن فیلترها</button>
                        </div>
                    ) : (
                        <div className="grid gap-7 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                            {products.map(product => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    )}
                    <Pagination
                        currentPage={pagination.currentPage}
                        totalPages={pagination.totalPages}
                        onPageChange={setPage}
                    />
                </div>
            </div>
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={null}>
            <SearchContent />
        </Suspense>
    );
}