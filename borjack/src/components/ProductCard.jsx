export default function ProductCard() {
    return (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-lg">

            <div className="aspect-square bg-gray-100">
                عکس محصول
            </div>

            <div className="p-4">

                <h3 className="mb-3 line-clamp-2 text-sm">
                    گوشی سامسونگ
                </h3>

                <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-red-500 px-2 py-1 text-xs text-white">
                        15%
                    </span>

                    <span className="text-xs text-gray-400 line-through">
                        12,000,000
                    </span>
                </div>

                <p className="font-bold">
                    10,200,000 تومان
                </p>

            </div>

        </div>
    )
}