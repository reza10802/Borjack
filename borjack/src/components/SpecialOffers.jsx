"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProductCard from "./ProductCard";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";

export default function SpecialOffers() {
    const [swiperInstance, setSwiperInstance] = useState(null);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        fetch("/api/products?discount=true")
            .then(res => res.json())
            .then(data => setProducts(data))
            .catch(console.error);
    }, []);

    return (
        <section className="mb-10 rounded-2xl bg-black p-6 text-white relative">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">پیشنهاد ویژه</h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => swiperInstance?.slidePrev()}
                        className="w-9 h-9 rounded-full border border-white/20 bg-white/10 hover:bg-white/25 transition flex items-center justify-center text-white text-lg">
                        ‹
                    </button>
                    <button onClick={() => swiperInstance?.slideNext()}
                        className="w-9 h-9 rounded-full border border-white/20 bg-white/10 hover:bg-white/25 transition flex items-center justify-center text-white text-lg">
                        ›
                    </button>
                    <Link href="/search" className="text-sm text-gray-300 hover:text-white transition mr-2">
                        مشاهده همه ←
                    </Link>
                </div>
            </div>

            {products.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                    در حال بارگذاری...
                </div>
            ) : (
                <Swiper
                    modules={[Autoplay]}
                    onSwiper={setSwiperInstance}
                    autoplay={{ delay: 3000, disableOnInteraction: false }}
                    spaceBetween={16}
                    breakpoints={{
                        0: { slidesPerView: 2 },
                        640: { slidesPerView: 3 },
                        1024: { slidesPerView: 5 },
                    }}
                >
                    {products.map((product) => (
                        <SwiperSlide key={product.id}>
                            <ProductCard product={product} />
                        </SwiperSlide>
                    ))}
                </Swiper>
            )}
        </section>
    );
}