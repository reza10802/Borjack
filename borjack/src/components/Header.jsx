export default function Header() {
    return (
        <header className="w-full border-b border-gray-300">

            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

                <div className="flex items-center gap-3">

                    <button className="px-4 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-100 transition">
                        ورود
                    </button>

                    <button className="px-4 py-1.5 text-sm rounded-md bg-red-500 text-white hover:bg-red-600 transition">
                        پروفایل
                    </button>

                </div>
                <nav className="hidden md:flex gap-6 text-gray-700 text-sm">
                    <a href="#" className="hover:text-red-500 transition">
                        موبایل
                    </a>
                    <a href="#" className="hover:text-red-500 transition">
                        لپ‌تاپ
                    </a>
                    <a href="#" className="hover:text-red-500 transition">
                        لوازم جانبی
                    </a>
                    <a href="#" className="hover:text-red-500 transition">
                        پوشاک
                    </a>
                </nav>


                <div className="flex items-center">
                    <img className="w-14 rounded-2xl" src="/images/photo_2026-06-20_01-20-44.jpg" alt="Site's Logo" />
                </div>

            </div>
        </header>
    );
}