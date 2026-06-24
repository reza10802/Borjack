"use client";

import Link from "next/link";

export default function ProductCard({ product }) {
    const { id, title, price, originalPrice, discount, image, rating, reviewCount } = product;

    return (
        <Link href={`/products/${id}`} className="group block overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-lg">
            <div className="aspect-square bg-gray-100 overflow-hidden relative">
                <img
                    src={image}
                    alt={title}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                    onError={e => { e.target.style.display = "none"; }}
                />
                {discount > 0 && (
                    <span className="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded-lg">
                        {discount}%
                    </span>
                )}
            </div>
            <div className="p-4">
                <h3 className="mb-2 line-clamp-2 text-sm text-gray-800 font-medium">{title}</h3>
                <div className="flex items-center gap-1 mb-3">
                    <span className="text-yellow-400 text-sm">★</span>
                    <span className="text-xs text-gray-500">{rating} ({reviewCount})</span>
                </div>
                <div className="mt-auto">
                    {discount > 0 && (
                        <span className="text-xs text-gray-400 line-through block mb-0.5">
                            {originalPrice.toLocaleString()} تومان
                        </span>
                    )}
                    <p className="font-bold text-gray-900 text-sm">{price.toLocaleString()} تومان</p>
                </div>

            </div>
        </Link>
    );
}