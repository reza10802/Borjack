# BORJAK — گزارش رفع آسیب‌پذیری‌ها (Remediation Report)

> وضعیت کلی: **این نسخه امن‌تر و قابل اتکاتر از نسخه‌ی قبل است، اما هنوز «آماده‌ی production» اعلام نمی‌شود.**
> همه‌ی تست‌ها روی PostgreSQL موقت محلی اجرا شده‌اند؛ هیچ migration یا پرداختی روی محیط واقعی انجام نشده است.

## ۱. نتایج تست و build (واقعاً اجرا شده‌اند)
| مورد | نتیجه |
|---|---|
| `node --test tests/*.test.mjs` (۲۳ تست، شامل concurrency روی DB واقعی) | **۲۳/۲۳ pass** — روی DB اصلی تست و روی DB تازه با کل زنجیره‌ی ۳۸ migration |
| `next build` (Next 16.4.5, Turbopack) | **موفق** (بعد از آخرین تغییر کد) |
| `scripts/verify-db-constraints.mjs` | OK (سه CHECK موجودی وجود دارد) |
| `eslint` روی کدهای بک‌اند تغییرداده‌شده (`src/lib`, `src/app/api`, `proxy.js`, `tests`, `scripts`) | **۰ خطا** |
| `eslint` کل پروژه | ۲۳ خطای **قبلی** در فایل‌های فرانت (`react-hooks/set-state-in-effect` و …) که دست نخورده‌اند؛ build را مختل نمی‌کنند |
| `npm audit` (فقط prod) | قبل: ۱ critical + ۱۵ high. **بعد: ۰ critical، ۱۰ high، ۶ moderate** (همگی زنجیره‌ی build/CLI: `prisma`/`@prisma/dev`، `@serwist/*`، `zod` داخل ابزار build — داخل image نهایی standalone نیستند) |
| **اجرا نشده** | تست HTTP-level روی routeها (نیاز به runtime Next)، تست RBAC (نیاز به request context)، تست E2E مرورگر، تست واقعی Zarinpal/SMS.ir، `prisma migrate deploy` (دانلود schema-engine مسدود بود؛ SQLها مستقیم با `psql` اعمال شدند) |

## ۲. وضعیت هر Finding
**FV** = FIXED AND VERIFIED · **FN** = FIXED BUT NOT FULLY VERIFIED · **PF** = PARTIALLY FIXED · **UR** = UNRESOLVED · **NA** = NOT APPLICABLE

| ID | وضعیت | خلاصه‌ی رفع / آنچه تأیید شد / آنچه باقی است |
|---|---|---|
| AUTH-01 | FN | شمارش اتمیک تلاش‌ها **قبل از** مقایسه (`lib/otp.js verifyOtp`)، حداکثر ۵ تلاش برای هر کد، ابطال بعد از سقف، claim یک‌بارمصرف؛ `reset-password` و `verify-otp` از آن استفاده می‌کنند. تست concurrency (۳۰۰ حدس موازی) پاس شد. wiring روی routeها با HTTP تست نشده |
| AUTH-02 | FN | `randomInt` (CSPRNG)؛ مسیر `forgot-password` فقط alias به `send-otp` است (یک flow واحد). randomness تست آماری نشده |
| AUTH-03 | FN | `User.tokenVersion` + claim `tv` در JWT؛ reset password، تغییر نقش، غیرفعال‌سازی و ثبت‌نام مجدد حساب تأییدنشده آن را افزایش می‌دهند. توکن‌های قدیمی (بدون `tv`) تا اولین رویداد امنیتی معتبرند. ساخت/اعتبارسنجی JWT تست شد؛ مقایسه‌ی `tv` در `getSessionUser` نیاز به context درخواست دارد و اجرا نشد |
| AUTH-04 | FV(هسته) | cooldown اتمیک (۱۰ درخواست موازی ⇒ دقیقاً ۱ SMS)، سقف ۱۰ کد در روز برای هر شماره، ۲۰ در ساعت برای هر IP (/64 برای IPv6). SMS.ir واقعی تست نشد |
| AUTH-05 | FV | `redactSensitive` در `logAction` و خروجی `/api/admin/logs`؛ migration هش‌های موجود را از `AuditLog` پاک می‌کند (رکورد می‌ماند) — تست شد |
| AUTH-06 | FV | `AuditLog.userId` اختیاری + `onDelete: SetNull` + `userLabel`؛ حذف کاربر تاریخچه را نگه می‌دارد — تست شد |
| AUTH-07 | FV | حداقل ۸ کاراکتر، سقف ۷۲ بایت UTF-8 (bcrypt)، رد رمزهای رایج/فقط‌عددی کوتاه/تکراری؛ bcrypt cost=12 برای رمزهای جدید. کاربران قدیمی با رمز ضعیف همچنان وارد می‌شوند (سیاست فقط ثبت‌نام/ریست) |
| AUTH-08 | FN | `send-otp (RESET_PASSWORD)` همیشه پاسخ عمومی می‌دهد؛ `reset-password` خطای عمومی؛ `register` برای شماره‌ی تکراری همان پاسخ ۲۰۱ را می‌دهد (و فقط حساب **تأییدنشده** قابل ثبت مجدد است). فقط با خواندن کد بررسی شده |
| AUTH-09 | FN | قفل per-(phone+IP) ۱۰ شکست/۱۵ دقیقه + سقف per-phone ۱۰۰ و per-IP ۶۰ ⇒ مهاجم از IP دیگر نمی‌تواند حساب قربانی را قفل کند. تست HTTP ندارد |
| AUTH-10 | FN | `sms.js` بازنویسی شد (بدون لاگ شماره/پاسخ/کلید، پیام خطای عمومی، timeout ۱۰ ثانیه)؛ routeهای auth خطای عمومی برمی‌گردانند. بقیه‌ی routeها تک‌به‌تک برای لاگ خام `error` بررسی نشدند |
| AUTH-11 | PF | کوتاه‌شدن عمر JWT کارکنان به ۸ ساعت، `admin-auth.js` حالا نقش/فعال‌بودن/`tv` را از DB می‌خواند. `proxy.js` هنوز فقط به claim JWT تکیه می‌کند (فقط پوسته‌ی صفحه؛ APIها از DB می‌خوانند) و `admin/layout.jsx` کلاینتی است |
| AUTH-12 | FN | OTP به‌صورت HMAC-SHA256 ذخیره می‌شود (تست شد)، migration کدهای plaintext قدیمی را بی‌اثر می‌کند؛ پاک‌سازی در cron است (اجرا نشده) |
| BUG-01 | FN | ستون‌های `User.address/postalCode` برگشتند، ویرایش پروفایل با آدرس پیش‌فرض همگام می‌شود، `getSessionUser` به آن fallback دارد. PATCH اجرا نشده |
| INV-01 | FN | `POST /api/internal/cron` (محافظت‌شده با `CRON_SECRET`) + آزادسازی lazy هنگام تلاش مجدد مشتری. **فقط پس از تأیید درگاه** آزاد می‌کند: PAID⇒settle، UNPAID(کدهای `ZARINPAL_UNPAID_CODES`)⇒release، غیر آن⇒نگه‌داشتن. با mock درگاه تست شد (۴ سناریو). **فرض تأییدنشده:** کدهای -51/-54 به‌معنای «پرداخت‌نشده» هستند — با مستندات/sandbox زرین‌پال تأیید کنید |
| INV-02 | FN | `restockOrderStock` فقط برای سفارش `CONSUMED`، دقیقاً یک‌بار (`stockRestockedAt`)؛ ADMIN دارای state machine (ارسال/تحویل/لغو برگشت‌ناپذیر)؛ لغو سفارش پرداخت‌شده یادداشت «بازپرداخت دستی» ثبت می‌کند. هسته تست شد، route نه |
| PAY-02 | FN | `findPriceMismatches` هنگام رزرو: اگر قیمت کاتالوگ با snapshot سفارش فرق کند ۴۰۹ و مشتری باید سفارش را دوباره ثبت کند. هسته تست شد |
| PAY-03 | FN | `Status=NOK` دیگر رزرو را مستقیم آزاد نمی‌کند؛ ابتدا استعلام از درگاه؛ نتیجه‌ی نامعلوم ⇒ بدون تغییر (`payment=canceled-pending`) |
| PAY-04 | PF | پرداخت‌شده‌ی settle‌نشده با reconcile/callback دیررس تسویه می‌شود؛ پرداخت دیررس بعد از آزادسازی دوباره رزرو می‌کند (در صورت نبود موجودی ⇒ `ISSUE`). **API استرداد/استعلام جدید اختراع نشد**: بازپرداخت دستی می‌ماند؛ لیست موارد نیازمند رسیدگی: `GET /api/admin/payments/issues` (بدون UI) |
| PAY-05 | FN | `assertGatewayConfig()` در production با sandbox خطا می‌دهد (۵۰۳ در payment/request؛ استعلام هم خنثی) |
| CART-01 | FN | `cart/merge`: حداکثر ۵۰ آیتم و ۳۲KB |
| CART-02 | FV | حذف سبد با کسر مقدار خریداری‌شده؛ مقدار اضافه‌شده بعد از checkout می‌ماند (تست شد) |
| DB-01 | FN | ایندکس‌های `Order(userId,paymentStatus,status)`, `Order(paymentStatus,status)`, `OrderItem(orderId/productId)`, `Address(userId)`, `Review(productId,approved)`, `AuditLog`, `OtpCode`. بدون EXPLAIN/بنچمارک |
| DB-02 | FN | حذف سفارش توسط مشتری ⇒ soft-cancel؛ `Transaction→Order` دیگر Cascade نیست (Restrict)؛ جدول `PaymentAttempt` تاریخچه‌ی همه‌ی authorityها را نگه می‌دارد |
| DB-03 | FV | migration CHECKها را idempotent دوباره تضمین می‌کند؛ `npm run db:verify-constraints`؛ تست DB رد مقدار منفی/رزرو بیش از موجودی را تأیید می‌کند. **هرگز `db push`/`migrate reset` روی production** |
| ORD-01 | FN | `GET /api/order` فیلد `authority` و `stockIssueAt` را نمی‌فرستد، `take:100`. |
| shippingCost=0 | **UR** | `order/route.js` همیشه `shippingCost: 0` می‌گذارد در حالی که روش ارسال قابل انتخاب است. **این تصمیم کسب‌وکاری است** (ارسال رایگان یا مشکل حل‌نشده؟) و قیمتی اختراع نشد |
| وابستگی‌ها | FN/PF | `next` 16.2.9→**16.4.5**، `eslint-config-next` 16.4.5، `sharp` →**0.35.5**، `zod` →^4.6.7؛ lockfile سازگار شد. build موفق؛ **آپلود تصویر با sharp جدید اجرا نشده** (باید روی staging تست شود). موارد باقی‌مانده‌ی audit زنجیره‌ی build/CLI هستند |

### یافته‌های اضافه (در حین بررسی)
| مورد | وضعیت | توضیح |
|---|---|---|
| Stored XSS در JSON-LD (نام محصول/دسته/برند داخل `<script>`) | FV | `lib/json-ld.js safeJsonLd` (۴ فایل) — تست شد |
| دکمه‌ی «ادامه پرداخت» پروفایل آدرس **sandbox** زرین‌پال را ثابت می‌ساخت | FN | حالا `POST /api/payment/request` و redirect به `paymentUrl` |
| Service Worker صفحات `/profile`, `/admin`, `/checkout`, APIهای auth/cart/order/payment را کش می‌کرد | FN | NetworkOnly برای مسیرهای حساس |
| هدرهای امنیتی نبود | PF | `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS(prod)، `Cache-Control: no-store` روی APIهای حساس؛ **CSP فقط Report-Only** (بعد از بررسی کنسول staging enforcing شود) |
| دستیار هوشمند: IP قابل جعل، limiter فقط in-memory، بدنه بدون سقف | FN | IP امن، limiter مبتنی بر DB (per-IP/ساعت + سقف روزانه‌ی کل)، سقف بدنه. بدون tool-calling و بدون دسترسی به داده‌ی کاربر (قبلاً هم) |
| JWT بدون `algorithms` صریح | FN | `HS256` در همه‌ی نقاط verify (`session.js`, `proxy.js`, `admin-auth.js`) |

### بررسی نشده / ناقص (صادقانه)
`admin/products` (POST/PATCH و قواعد قیمت/تخفیف) و `categories/reviews/stats/tasks` فقط سطحی (pagination و guard) دیده شدند و **عمق‌دار ممیزی نشدند**؛ صفحات cart/checkout/نتیجه‌ی پرداخت (پروفایل هیچ پیامی برای `?payment=…` نشان نمی‌دهد — UX، نه امنیت)؛ سقف تعداد آیتم‌های متفاوت در `POST /api/cart`؛ TWA/Digital Asset Links؛ اندازه‌ی bundle و تست دسترس‌پذیری؛ نصب scannerهای gitleaks/semgrep (طبق قوانین نصب نشدند).

## ۳. فایل‌ها
**جدید:** `prisma/migrations/20261105000000_security_remediation/migration.sql`, `src/lib/{security,rate-limit,otp,session,json-ld,payment-settlement,payment-recon}.js`, `src/app/api/internal/cron/route.js`, `src/app/api/admin/payments/issues/route.js`, `tests/*` (۲ فایل تست + `setup/`), `scripts/verify-db-constraints.mjs`, `deploy/DEPLOYMENT.md`, `deploy/cron/README.md`, `deploy/nginx/borjak-security.conf`.
**تغییریافته:** `package.json`, `package-lock.json`, `next.config.mjs`, `prisma/schema.prisma`, `src/proxy.js`, `src/app/layout.jsx`, `src/app/sw.js`, `src/lib/{auth,admin-auth,sms,stock-reservation,zarinpal,validations/auth}.js`, routeهای `auth/{login,register,send-otp,verify-otp,reset-password,forgot-password}`, `payment/{request,verify}`, `order`, `order/[id]`, `admin/{logs,orders/[id],users/[id]}`, `cart/merge`, `profile`, `assistant/chat`, صفحات product/category/brand/profile، `deploy/nginx/README.md`, `.env.example`. همچنین `src/generated/prisma/*` با `prisma generate` بازتولید شد.

## ۴. Migration
`20261105000000_security_remediation` — idempotent (`IF NOT EXISTS`)، داده‌ی مشتری را حذف نمی‌کند. **قبل از production: pg_dump بگیرید، روی staging اجرا کنید، سپس `npx prisma migrate deploy`.** (در محیط من `prisma migrate deploy` به‌خاطر مسدودبودن دانلود engine اجرا نشد؛ همان SQL روی دو DB محلی با `psql` اعمال و آزمایش شد.)

## ۵. دستورالعمل VPS/Nginx/Docker/Cron
به `deploy/DEPLOYMENT.md`، `deploy/cron/README.md` و `deploy/nginx/borjak-security.conf` مراجعه کنید. نکات حیاتی: ۱) nginx باید `X-Real-IP`/`X-Forwarded-For` را **overwrite** کند، ۲) `/api/internal/` بیرونی مسدود شود، ۳) `CRON_SECRET` (≥32 کاراکتر) و cron هر ۵ دقیقه، ۴) `ZARINPAL_SANDBOX` در production خاموش، ۵) بعد از هر deploy `npm run db:verify-constraints`.

## ۶. چک‌لیست قبل از راه‌اندازی
- [ ] backup + تست restore؛ اجرای migration روی staging
- [ ] تأیید کدهای «پرداخت‌نشده»‌ی verify.json با مستندات/sandbox زرین‌پال و تنظیم `ZARINPAL_UNPAID_CODES`
- [ ] تست واقعی کامل پرداخت (sandbox): موفق، لغو در درگاه، بستن تب، callback دیررس، پرداخت دوباره
- [ ] نصب cron و مشاهده‌ی پاسخ `{"ok":true}`؛ تست رزرو منقضی روی staging
- [ ] تست آپلود تصویر (sharp 0.35) و کل مسیر ثبت‌نام/OTP/ریست رمز با SMS.ir واقعی
- [ ] بررسی CSP Report-Only و سپس enforcing
- [ ] تصمیم درباره‌ی `shippingCost` و ممیزی عمیق admin products
- [ ] محدودکردن دسترسی به `/api/admin/payments/issues` و تعریف روال بازپرداخت دستی
- [ ] تعویض `JWT_SECRET`/کلیدهای هر نسخه‌ای که قبلاً بیرون رفته؛ اجرای gitleaks روی تاریخچه‌ی git واقعی (zip فاقد `.git` بود)
- [ ] مرور lint فرانت (۲۳ خطای قدیمی) و تست دستی RTL/PWA
