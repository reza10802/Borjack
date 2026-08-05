"use client";

import Link from "next/link";
import Image from "next/image";
import { toPersianPrice } from "@/lib/utils";

export default function RelatedProducts({ products }) {
  if (!products?.length) return null;

  return (
    <section className="mt-20">
      <h2 className="mb-8 text-2xl font-bold">
        پیشنهاد ویژه برای شما
      </h2>

      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.slug}`}
            className="card overflow-hidden transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="relative aspect-square">
              <Image
                src={product.image}
                alt={product.title}
                fill
                className="object-cover"
              />
            </div>

            <div className="p-4">
              <h3 className="line-clamp-2 text-sm font-medium">
                {product.title}
              </h3>

              <div className="mt-3 flex items-center justify-between">
                <span className="font-bold text-orange-600">
                  {toPersianPrice(product.price)} تومان
                </span>

                <span className="text-xs text-gray-500">
                  ⭐ {product.rating}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}