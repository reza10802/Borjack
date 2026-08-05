"use client";

export default function Pagination({
    currentPage,
    totalPages,
    onPageChange,
}) {
    if (totalPages <= 1) return null;

    const pages = [];

    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    for (let i = start; i <= end; i++) {
        pages.push(i);
    }

    return (
        <div className="mt-12 flex items-center justify-center gap-2">

            <button
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="rounded-xl border px-4 py-2 disabled:opacity-40"
            >
                قبلی
            </button>

            {start > 1 && (
                <>
                    <button
                        onClick={() => onPageChange(1)}
                        className="rounded-xl border px-4 py-2"
                    >
                        1
                    </button>

                    {start > 2 && (
                        <span className="px-2">
                            ...
                        </span>
                    )}
                </>
            )}

            {pages.map((page) => (
                <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`rounded-xl px-4 py-2 transition
                        ${
                            page === currentPage
                                ? "bg-orange-500 text-white"
                                : "border hover:border-orange-400"
                        }`}
                >
                    {page}
                </button>
            ))}

            {end < totalPages && (
                <>
                    {end < totalPages - 1 && (
                        <span className="px-2">
                            ...
                        </span>
                    )}

                    <button
                        onClick={() => onPageChange(totalPages)}
                        className="rounded-xl border px-4 py-2"
                    >
                        {totalPages}
                    </button>
                </>
            )}

            <button
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="rounded-xl border px-4 py-2 disabled:opacity-40"
            >
                بعدی
            </button>

        </div>
    );
}