"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProductCard from "./ProductCard";
import SpecialOfferMobileCard from "./SpecialOfferMobile";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
} from "@heroicons/react/24/solid";

export default function SpecialOffers() {
    const [swiperInstance, setSwiperInstance] = useState(null);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        fetch("/api/products?discount=true")
            .then((res) => res.json())
            .then((data) => {

                if (Array.isArray(data)) {
                    setProducts(data);
                } else if (Array.isArray(data.products)) {
                    setProducts(data.products);
                } else if (Array.isArray(data.data)) {
                    setProducts(data.data);
                } else {
                    setProducts([]);
                }
            })
            .catch((err) => {
                console.error(err);
                setProducts([]);
            });
    }, []);

    return (
        <section className="card relative overflow-hidden px-6 py-8 lg:px-8">
            <div className="absolute inset-0 bg-linear-to-r from-orange-500/10 via-transparent to-orange-400/5 pointer-events-none" />

            <div className="relative z-10 mb-6 flex items-center justify-between gap-3 sm:mb-8">
                <div className="min-w-0">
                    <h2 className="text-2xl font-black text-[var(--color-primary)] dark:text-white sm:text-3xl">
                        پیشنهاد ویژه
                    </h2>

                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
                        محصولات دارای تخفیف ویژه
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                    <Link
                        href="/search?discount=true"
                        className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-[var(--color-accent)] transition hover:opacity-75 sm:text-sm"
                    >
                        مشاهده همه
                        <ChevronLeftIcon className="h-4 w-4" />
                    </Link>

                    <div className="hidden items-center gap-2 lg:flex">
                        <button
                            type="button"
                            onClick={() => swiperInstance?.slidePrev()}
                            aria-label="محصولات قبلی"
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text)] transition hover:bg-[var(--color-surface-2)]"
                        >
                            <ChevronRightIcon className="h-5 w-5" />
                        </button>

                        <button
                            type="button"
                            onClick={() => swiperInstance?.slideNext()}
                            aria-label="محصولات بعدی"
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text)] transition hover:bg-[var(--color-surface-2)]"
                        >
                            <ChevronLeftIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>


            {products.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-[430px] rounded-3xl bg-zinc-200 dark:bg-zinc-800 animate-pulse"
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <Swiper
                    className="overflow-visible! pb-3"
                    modules={[Autoplay]}
                    onSwiper={setSwiperInstance}
                    spaceBetween={12}
                    autoplay={{ delay: 3000, disableOnInteraction: false }}
                    breakpoints={{
                        0: {
                            slidesPerView: 1,
                            spaceBetween: 12,
                        },

                        480: {
                            slidesPerView: 1,
                            spaceBetween: 12,
                        },

                        640: {
                            slidesPerView: 1.15,
                            spaceBetween: 16,
                        },
                        768: {
                            slidesPerView: 3,
                            spaceBetween: 20,
                        },
                        1024: {
                            slidesPerView: 3,
                            spaceBetween: 20,
                        },
                        1280: {
                            slidesPerView: 4,
                            spaceBetween: 24,
                        },
                        1536: {
                            slidesPerView: 5,
                            spaceBetween: 24,
                        },
                    }}
                >
                    {products.map((product) => (
                        <SwiperSlide key={product.id}>

                            <div className="hidden md:block h-full">
                                <ProductCard product={product} />
                            </div>

                            <div className="block md:hidden">
                                <SpecialOfferMobileCard product={product} />
                            </div>

                        </SwiperSlide>
                    ))}
                </Swiper>

            )}
        </section>
    );
}