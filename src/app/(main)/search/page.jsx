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

const initialPagination = {
    total: 0,
    currentPage: 1,
    totalPages: 1,
    limit: 20,
};

function SearchContent() {
    const searchParams = useSearchParams();

    const [query, setQuery] = useState(searchParams.get("q") || "");
    const [selectedCategory, setSelectedCategory] = useState(
        searchParams.get("category") || "همه"
    );
    const [selectedBrand, setSelectedBrand] = useState(
        searchParams.get("brand") || "همه"
    );
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
    const [pagination, setPagination] = useState(initialPagination);

    const fromCategory = searchParams.get("category");

    // Load filter options.
    useEffect(() => {
        let active = true;

        Promise.all([
            fetch("/api/categories").then((response) =>
                response.ok ? response.json() : []
            ),
            fetch("/api/brands").then((response) =>
                response.ok ? response.json() : { brands: [] }
            ),
            fetch("/api/tags").then((response) =>
                response.ok ? response.json() : { tags: [] }
            ),
        ])
            .then(([categoryData, brandData, tagData]) => {
                if (!active) return;
                setCategories([
                    "همه",
                    ...(Array.isArray(categoryData)
                        ? categoryData.map((item) => item.title)
                        : []),
                ]);
                setBrands([
                    "همه",
                    ...((brandData?.brands || []).map((item) => item.title)),
                ]);
                setTags([
                    "همه",
                    ...((tagData?.tags || []).map((item) => item.title)),
                ]);
            })
            .catch((error) => {
                console.error("Could not load search filters:", error);
                if (!active) return;
                setCategories(["همه"]);
                setBrands(["همه"]);
                setTags(["همه"]);
            });

        return () => {
            active = false;
        };
    }, []);

    // Return to the first page whenever a filter changes.
    useEffect(() => {
        setPage(1);
    }, [
        query,
        selectedCategory,
        selectedBrand,
        selectedTag,
        sort,
        priceFilter,
        onlyDiscount,
        onlyInStock,
    ]);

    // Keep the controls in sync when the URL search parameters change.
    useEffect(() => {
        setQuery(searchParams.get("q") || "");
        setSelectedCategory(searchParams.get("category") || "همه");
        setSelectedBrand(searchParams.get("brand") || "همه");
        setSelectedTag(searchParams.get("tag") || "همه");
    }, [searchParams]);

    const apiQuery = useMemo(() => {
        const params = new URLSearchParams();

        if (query.trim()) params.set("search", query.trim());
        if (selectedCategory !== "همه") {
            params.set("category", selectedCategory);
        }
        if (selectedBrand !== "همه") {
            params.set("brand", selectedBrand);
        }
        if (selectedTag !== "همه") params.set("tag", selectedTag);
        if (sort !== "default") params.set("sort", sort);

        if (priceFilter !== "all") {
            const [min, max] = priceFilter.split("-");
            params.set("minPrice", min);
            params.set("maxPrice", max);
        }

        if (onlyDiscount) params.set("discount", "true");
        if (onlyInStock) params.set("inStock", "true");

        params.set("page", String(page));
        params.set("limit", "20");

        return params.toString();
    }, [
        query,
        selectedCategory,
        selectedBrand,
        selectedTag,
        sort,
        priceFilter,
        onlyDiscount,
        onlyInStock,
        page,
    ]);

    // Fetch matching products.
    useEffect(() => {
        let active = true;
        setLoading(true);

        const delay = query.trim() ? 350 : 0;
        const timer = setTimeout(async () => {
            try {
                const response = await fetch(
                    `/api/products${apiQuery ? `?${apiQuery}` : ""}`
                );

                if (!response.ok) {
                    throw new Error(`Product request failed: ${response.status}`);
                }

                const data = await response.json();
                if (!active) return;

                setProducts(Array.isArray(data.products) ? data.products : []);
                setPagination(data.pagination || initialPagination);
            } catch (error) {
                if (!active) return;
                console.error("Could not load products:", error);
                setProducts([]);
                setPagination(initialPagination);
            } finally {
                if (active) setLoading(false);
            }
        }, delay);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [apiQuery, query]);

    const resetFilters = () => {
        setSelectedCategory("همه");
        setSelectedBrand("همه");
        setSelectedTag("همه");
        setPriceFilter("all");
        setOnlyDiscount(false);
        setOnlyInStock(false);
        setSort("default");
    };

    // Render as a helper instead of a nested React component so changing a
    // filter does not remount the Select controls on every parent render.
    const renderFilterPanel = (scope) => (
        <div className="flex flex-col gap-5">
            <div>
                <label className="mb-2 block text-xs font-bold text-[var(--color-text-muted)]">
                    دسته‌بندی
                </label>
                <Select
                    value={selectedCategory}
                    instanceId={`${scope}-category-select`}
                    onChange={setSelectedCategory}
                    options={categories.map((category) => ({
                        value: category,
                        label: category,
                    }))}
                />
            </div>

            <div>
                <label className="mb-2 block text-xs font-bold text-[var(--color-text-muted)]">
                    برند
                </label>
                <Select
                    value={selectedBrand}
                    instanceId={`${scope}-brand-select`}
                    onChange={setSelectedBrand}
                    options={brands.map((brand) => ({
                        value: brand,
                        label: brand,
                    }))}
                />
            </div>

            <div>
                <label className="mb-2 block text-xs font-bold text-[var(--color-text-muted)]">
                    تگ
                </label>
                <Select
                    value={selectedTag}
                    instanceId={`${scope}-tag-select`}
                    onChange={setSelectedTag}
                    options={tags.map((tag) => ({
                        value: tag,
                        label: tag,
                    }))}
                />
            </div>

            <div>
                <label className="mb-2 block text-xs font-bold text-[var(--color-text-muted)]">
                    محدوده قیمت
                </label>
                <Select
                    value={priceFilter}
                    instanceId={`${scope}-price-select`}
                    onChange={setPriceFilter}
                    options={priceOptions}
                />
            </div>

            <div className="flex flex-col gap-3">
                <button
                    type="button"
                    onClick={() => setOnlyDiscount((current) => !current)}
                    aria-pressed={onlyDiscount}
                    className="flex items-center gap-2.5 text-right text-sm text-[var(--color-text)]"
                >
                    <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                            onlyDiscount
                                ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                                : "border-[var(--color-border)] bg-[var(--color-surface)]"
                        }`}
                    >
                        {onlyDiscount && (
                            <svg
                                className="h-3 w-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="m5 13 4 4L19 7"
                                />
                            </svg>
                        )}
                    </span>
                    فقط تخفیف‌دار
                </button>

                <button
                    type="button"
                    onClick={() => setOnlyInStock((current) => !current)}
                    aria-pressed={onlyInStock}
                    className="flex items-center gap-2.5 text-right text-sm text-[var(--color-text)]"
                >
                    <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                            onlyInStock
                                ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                                : "border-[var(--color-border)] bg-[var(--color-surface)]"
                        }`}
                    >
                        {onlyInStock && (
                            <svg
                                className="h-3 w-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="m5 13 4 4L19 7"
                                />
                            </svg>
                        )}
                    </span>
                    فقط موجود
                </button>
            </div>

            <button
                type="button"
                onClick={resetFilters}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-sm text-[var(--color-text)] transition hover:border-[var(--color-accent)]"
            >
                پاک کردن فیلترها
            </button>
        </div>
    );

    const activeFilters = [
        selectedCategory !== "همه" ? selectedCategory : null,
        selectedBrand !== "همه" ? selectedBrand : null,
        selectedTag !== "همه" ? selectedTag : null,
        priceFilter !== "all"
            ? priceOptions.find((option) => option.value === priceFilter)?.label
            : null,
        onlyDiscount ? "تخفیف‌دار" : null,
        onlyInStock ? "موجود" : null,
    ].filter(Boolean);

    return (
        <div className="container-page py-6 sm:py-10" dir="rtl">
            {fromCategory && <BackButton />}

            <div className="mb-6 sm:mb-8">
                <h1 className="section-title">جستجوی محصولات</h1>
                <p className="muted mt-2 text-sm">
                    محصول مورد نظر خود را پیدا کنید
                </p>
            </div>

            {/* Search field */}
            <div className="relative mb-6">
                <label htmlFor="product-search" className="sr-only">
                    جستجو در محصولات
                </label>
                <input
                    id="product-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="جستجو در محصولات..."
                    className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3.5 pr-12 pl-10 text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] sm:py-4"
                />
                <svg
                    className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-muted)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0z"
                    />
                </svg>
                {query && (
                    <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label="پاک کردن عبارت جستجو"
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
                    >
                        ✕
                    </button>
                )}
            </div>

            <div className="flex min-w-0 flex-col gap-6 lg:flex-row">
                {/* Desktop filter sidebar */}
                <aside className="hidden w-56 shrink-0 lg:block">
                    <div className="card sticky top-24 p-5 xl:p-6">
                        {renderFilterPanel("desktop")}
                    </div>
                </aside>

                <div className="min-w-0 flex-1">
                    {/* Results count and controls: stacked on mobile */}
                    <div className="mb-5 space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="muted shrink-0 text-sm">
                                {loading ? "در حال جستجو..." : `${products.length} محصول`}
                            </span>

                            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
                                <button
                                    type="button"
                                    onClick={() => setShowFilters((current) => !current)}
                                    aria-expanded={showFilters}
                                    className="flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] transition hover:border-[var(--color-accent)] lg:hidden"
                                >
                                    <svg
                                        className="h-4 w-4 shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M3 4h18M7 8h10M11 12h4"
                                        />
                                    </svg>
                                    {showFilters ? "بستن فیلتر" : "فیلتر"}
                                </button>

                                <div className="min-w-0 w-full sm:w-44">
                                    <Select
                                        value={sort}
                                        instanceId="sort-select"
                                        onChange={setSort}
                                        options={sortOptions}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Mobile filter panel */}
                        {showFilters && (
                            <div className="card p-4 sm:p-6 lg:hidden">
                                {renderFilterPanel("mobile")}
                            </div>
                        )}

                        {/* Active filter chips */}
                        {activeFilters.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                {activeFilters.map((filter, index) => (
                                    <span
                                        key={`${filter}-${index}`}
                                        className="rounded-full bg-[var(--color-surface-2)] px-3 py-1.5 text-xs text-[var(--color-text)]"
                                    >
                                        {filter}
                                    </span>
                                ))}
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="px-1 py-1.5 text-xs text-[var(--color-text-muted)] underline underline-offset-2 transition hover:text-[var(--color-accent)]"
                                >
                                    پاک کردن فیلترها
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Product results */}
                    {loading ? (
                        <div className="py-20 text-center text-sm text-[var(--color-text-muted)]">
                            در حال بارگذاری...
                        </div>
                    ) : products.length === 0 ? (
                        <div className="card px-4 py-16 text-center sm:py-20">
                            <p className="mb-3 text-4xl" aria-hidden="true">
                                🔍
                            </p>
                            <p className="muted text-sm">
                                محصولی با این مشخصات پیدا نشد
                            </p>
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="mt-5 text-sm font-medium text-[var(--color-accent)] transition hover:opacity-80"
                            >
                                پاک کردن فیلترها
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:gap-6 xl:grid-cols-4 2xl:grid-cols-5">
                            {products.map((product) => (
                                <ProductCard key={product.id} product={product} variant="search" />
                            ))}
                        </div>
                    )}

                    <Pagination
                        currentPage={pagination.currentPage || page}
                        totalPages={pagination.totalPages || 1}
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
