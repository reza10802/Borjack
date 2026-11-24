"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Select from "react-select";
import { useAuth } from "@/context/AuthContext";
import {
  getAllProvinces,
  getCitiesByProvinceId,
} from "@/lib/iranLocations";

const SHIPPING_COST_PER_FULFILLMENT = 200_000;

const SHIPPING_OPTIONS = [
  {
    value: "POST",
    label: "پست عادی",
    description: "ارسال از طریق خدمات پستی",
  },
  {
    value: "POST_EXPRESS",
    label: "پست پیشتاز",
    description: "ارسال سریع‌تر از طریق خدمات پستی",
  },
];

const CHECKOUT_STEPS = [
  "اطلاعات گیرنده",
  "روش ارسال",
  "درگاه پرداخت",
  "فاکتور نهایی",
];

// یکسان‌سازی حروف فارسی و عربی برای جست‌وجوی استان و شهر
function normalizeLocationSearch(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fa-IR");
}

// جست‌وجو در نام استان و شهرستان
function filterLocationOption(option, inputValue) {
  const query = normalizeLocationSearch(inputValue);

  if (!query) return true;

  return normalizeLocationSearch(option.label).includes(query);
}

const locationSelectStyles = {
  container: (base) => ({
    ...base,
    width: "100%",
  }),

  control: (base, state) => ({
    ...base,
    minHeight: 48,
    borderRadius: 12,
    borderColor: state.isFocused
      ? "var(--color-accent)"
      : "var(--color-border)",
    backgroundColor: "var(--color-surface)",
    boxShadow: state.isFocused
      ? "0 0 0 1px var(--color-accent)"
      : "none",
    transition: "border-color 150ms ease",
    cursor: "pointer",
    "&:hover": {
      borderColor: "var(--color-accent)",
    },
  }),

  valueContainer: (base) => ({
    ...base,
    padding: "2px 12px",
    minWidth: 0,
  }),

  input: (base) => ({
    ...base,
    color: "var(--color-text)",
  }),

  singleValue: (base) => ({
    ...base,
    color: "var(--color-text)",
    fontSize: 14,
  }),

  placeholder: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
    fontSize: 13,
  }),

  menu: (base) => ({
    ...base,
    zIndex: 50,
    overflow: "hidden",
    borderRadius: 12,
    border: "1px solid var(--color-border)",
    backgroundColor: "var(--color-surface)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  }),

  menuList: (base) => ({
    ...base,
    maxHeight: 240,
    padding: 5,
  }),

  option: (base, state) => ({
    ...base,
    borderRadius: 8,
    marginBottom: 2,
    padding: "10px 12px",
    fontSize: 14,
    cursor: "pointer",
    color: state.isSelected
      ? "#ffffff"
      : "var(--color-text)",
    backgroundColor: state.isSelected
      ? "var(--color-accent)"
      : state.isFocused
        ? "var(--color-surface-2)"
        : "transparent",
  }),

  indicatorsContainer: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
  }),

  indicatorSeparator: () => ({
    display: "none",
  }),

  dropdownIndicator: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
  }),

  clearIndicator: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
  }),

  noOptionsMessage: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
    fontSize: 13,
  }),
};

function CheckoutStepIcon({ step }) {
  const commonProps = {
    width: 19,
    height: 19,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (step) {
    case 1:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.7-3.4 3.2-5.2 7-5.2s6.3 1.8 7 5.2" />
        </svg>
      );

    case 2:
      return (
        <svg {...commonProps}>
          <path d="M3 7h11v11H3z" />
          <path d="M14 11h4l3 3v4h-7" />
          <circle cx="7.5" cy="18" r="1.8" />
          <circle cx="17.5" cy="18" r="1.8" />
        </svg>
      );

    case 3:
      return (
        <svg {...commonProps}>
          <rect x="2.5" y="5" width="19" height="14" rx="2" />
          <path d="M3 10h18" />
          <path d="M6.5 15h3" />
        </svg>
      );

    case 4:
      return (
        <svg {...commonProps}>
          <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h6" />
        </svg>
      );

    default:
      return null;
  }
}

function formatToman(value) {
  const amount = Number(value);

  if (!Number.isSafeInteger(amount)) {
    return "—";
  }

  return `${amount.toLocaleString("fa-IR")} تومان`;
}

function isValidQuote(quote, expectedShipmentCount) {
  if (!quote || typeof quote !== "object") {
    return false;
  }

  const numericFields = [
    "productSubtotalToman",
    "shippingCostToman",
    "couponDiscountToman",
    "couponShippingDiscountToman",
    "totalCouponDiscountToman",
    "requiredAmountToman",
    "gatewayFeeToman",
    "totalAmountToman",
  ];

  if (
    !numericFields.every(
      (field) =>
        Number.isSafeInteger(quote[field]) &&
        quote[field] >= 0,
    )
  ) {
    return false;
  }

  if (
    quote.productSubtotalToman <= 0 ||
    quote.requiredAmountToman <= 0
  ) {
    return false;
  }

  if (
    quote.couponDiscountToman >
    quote.productSubtotalToman
  ) {
    return false;
  }

  if (
    quote.couponShippingDiscountToman >
    quote.shippingCostToman
  ) {
    return false;
  }

  if (
    quote.totalCouponDiscountToman !==
    quote.couponDiscountToman +
    quote.couponShippingDiscountToman
  ) {
    return false;
  }

  const expectedRequiredAmount =
    quote.productSubtotalToman -
    quote.couponDiscountToman +
    quote.shippingCostToman -
    quote.couponShippingDiscountToman;

  if (
    !Number.isSafeInteger(expectedRequiredAmount) ||
    expectedRequiredAmount !== quote.requiredAmountToman
  ) {
    return false;
  }

  if (
    quote.totalAmountToman !==
    quote.requiredAmountToman + quote.gatewayFeeToman
  ) {
    return false;
  }

  if (
    quote.shipmentCount !== expectedShipmentCount ||
    !Array.isArray(quote.shipments) ||
    quote.shipments.length !== expectedShipmentCount
  ) {
    return false;
  }

  let shipmentShippingTotal = 0;
  let shipmentShippingDiscountTotal = 0;

  for (const shipment of quote.shipments) {
    if (
      !Number.isSafeInteger(shipment.shippingCost) ||
      shipment.shippingCost < 0 ||
      !Number.isSafeInteger(shipment.shippingDiscount) ||
      shipment.shippingDiscount < 0 ||
      !Number.isSafeInteger(shipment.finalShippingCost) ||
      shipment.finalShippingCost < 0 ||
      shipment.shippingDiscount > shipment.shippingCost ||
      shipment.finalShippingCost !==
      shipment.shippingCost - shipment.shippingDiscount
    ) {
      return false;
    }

    shipmentShippingTotal += shipment.shippingCost;
    shipmentShippingDiscountTotal +=
      shipment.shippingDiscount;
  }

  if (
    shipmentShippingTotal !== quote.shippingCostToman ||
    shipmentShippingDiscountTotal !==
    quote.couponShippingDiscountToman
  ) {
    return false;
  }

  if (typeof quote.couponApplied !== "boolean") {
    return false;
  }

  if (quote.couponApplied) {
    const coupon = quote.coupon;

    if (
      !coupon ||
      typeof coupon.code !== "string" ||
      !coupon.code.trim() ||
      !["PERCENTAGE", "FIXED", "FREE_SHIPPING"].includes(
        coupon.type,
      ) ||
      !Number.isSafeInteger(coupon.productDiscountToman) ||
      !Number.isSafeInteger(coupon.shippingDiscountToman) ||
      !Number.isSafeInteger(coupon.totalDiscountToman) ||
      coupon.productDiscountToman !==
      quote.couponDiscountToman ||
      coupon.shippingDiscountToman !==
      quote.couponShippingDiscountToman ||
      coupon.totalDiscountToman !==
      quote.totalCouponDiscountToman
    ) {
      return false;
    }

    if (
      coupon.type === "FREE_SHIPPING" &&
      (
        coupon.productDiscountToman !== 0 ||
        coupon.shippingDiscountToman <= 0
      )
    ) {
      return false;
    }

    if (
      ["PERCENTAGE", "FIXED"].includes(coupon.type) &&
      (
        coupon.productDiscountToman <= 0 ||
        coupon.shippingDiscountToman !== 0
      )
    ) {
      return false;
    }
  } else if (
    quote.couponDiscountToman !== 0 ||
    quote.couponShippingDiscountToman !== 0 ||
    quote.totalCouponDiscountToman !== 0
  ) {
    return false;
  }

  return ["MERCHANT", "PAYER"].includes(quote.feeType);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    receiverName: "",
    receiverPhone: "",
    provinceId: "",
    cityId: "",
    address: "",
    postalCode: "",
    requiresPrintedInvoice: false,
  });

  const [receiverNameEdited, setReceiverNameEdited] = useState(false);
  const [receiverPhoneEdited, setReceiverPhoneEdited] = useState(false);

  const [couponCode, setCouponCode] = useState("");

  const [cartItems, setCartItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState("");

  const [shippingMethodsBySeller, setShippingMethodsBySeller] =
    useState({});

  const [paymentProvider, setPaymentProvider] = useState("ZARINPAL");

  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const [paymentLoading, setPaymentLoading] = useState(false);
  const paymentInProgressRef = useRef(false);

  const [error, setError] = useState("");

  const receiverName = receiverNameEdited
    ? form.receiverName
    : user?.name || form.receiverName;

  const receiverPhone = receiverPhoneEdited
    ? form.receiverPhone
    : user?.phone || form.receiverPhone;

  const provinces = useMemo(() => {
    const items = getAllProvinces() || [];

    return items.map((item) => ({
      value: String(item.id),
      label: item.name,
    }));
  }, []);

  const cityOptions = useMemo(() => {
    if (!form.provinceId) return [];

    const items =
      getCitiesByProvinceId(Number(form.provinceId)) || [];

    return items.map((item) => ({
      value: String(item.id),
      label: item.name,
    }));
  }, [form.provinceId]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/checkout");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;

    const controller = new AbortController();

    async function loadCart() {
      setCartLoading(true);
      setCartError("");

      try {
        const response = await fetch("/api/cart", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "خطا در دریافت سبد خرید",
          );
        }

        if (!Array.isArray(data)) {
          throw new Error("اطلاعات سبد خرید معتبر نیست");
        }

        setCartItems(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setCartError(
            err.message || "خطا در دریافت سبد خرید",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCartLoading(false);
        }
      }
    }

    loadCart();

    return () => controller.abort();
  }, [loading, user]);

  const sellerGroups = useMemo(() => {
    const groups = new Map();

    for (const item of cartItems) {
      const product = item?.product;
      const seller = item?.seller;

      if (
        !product ||
        typeof seller?.key !== "string" ||
        !/^seller-\d+$/.test(seller.key)
      ) {
        continue;
      }

      let group = groups.get(seller.key);

      if (!group) {
        group = {
          key: seller.key,
          name: seller.name || "فروشگاه برجک",
          items: [],
          subtotal: 0,
        };

        groups.set(seller.key, group);
      }

      const quantity = Number(item.quantity);
      const price = Number(product.price);

      if (
        !Number.isSafeInteger(quantity) ||
        quantity <= 0 ||
        !Number.isSafeInteger(price) ||
        price <= 0
      ) {
        continue;
      }

      group.items.push(item);
      group.subtotal += price * quantity;
    }

    return [...groups.values()];
  }, [cartItems]);

  const effectiveShippingMethodsBySeller = useMemo(() => {
    const methods = {};

    for (const group of sellerGroups) {
      const savedMethod = shippingMethodsBySeller[group.key];

      methods[group.key] = SHIPPING_OPTIONS.some(
        (option) => option.value === savedMethod,
      )
        ? savedMethod
        : "POST";
    }

    return methods;
  }, [sellerGroups, shippingMethodsBySeller]);

  const shippingTotal =
    sellerGroups.length * SHIPPING_COST_PER_FULFILLMENT;

  const selectedShippingCount = sellerGroups.filter(
    (group) =>
      SHIPPING_OPTIONS.some(
        (option) =>
          option.value ===
          effectiveShippingMethodsBySeller[group.key],
      ),
  ).length;

  const invalidateQuote = () => {
    setQuote(null);
    setError("");
  };

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;

    invalidateQuote();

    if (name === "receiverName") {
      setReceiverNameEdited(true);
    }

    if (name === "receiverPhone") {
      setReceiverPhoneEdited(true);
    }

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCouponCodeChange = (event) => {
    const value = event.target.value
      .toUpperCase()
      .slice(0, 40);

    setCouponCode(value);
    invalidateQuote();
  };

  const handleProvinceChange = (value) => {
    invalidateQuote();

    setForm((previous) => ({
      ...previous,
      provinceId: value,
      cityId: "",
    }));
  };

  const handleCityChange = (value) => {
    invalidateQuote();

    setForm((previous) => ({
      ...previous,
      cityId: value,
    }));
  };

  const handleShippingChange = (sellerKey, method) => {
    invalidateQuote();

    setShippingMethodsBySeller((previous) => ({
      ...previous,
      [sellerKey]: method,
    }));
  };

  const validateAddress = () => {
    if (
      !receiverName.trim() ||
      receiverName.trim().length < 3 ||
      receiverName.trim().length > 100
    ) {
      return "نام گیرنده باید بین ۳ تا ۱۰۰ کاراکتر باشد";
    }

    if (!/^09\d{9}$/.test(receiverPhone.trim())) {
      return "شماره موبایل گیرنده معتبر نیست";
    }

    if (!form.provinceId) {
      return "استان را انتخاب کن";
    }

    if (!form.cityId) {
      return "شهر را انتخاب کن";
    }

    if (form.address.trim().length < 10) {
      return "آدرس باید حداقل ۱۰ کاراکتر باشد";
    }

    if (form.address.trim().length > 500) {
      return "آدرس خیلی طولانی است";
    }

    if (!/^\d{10}$/.test(form.postalCode.trim())) {
      return "کد پستی باید ۱۰ رقم باشد";
    }

    return "";
  };

  const validateShipping = () => {
    if (!sellerGroups.length) {
      return "سبد خرید خالی است";
    }

    if (selectedShippingCount !== sellerGroups.length) {
      return "روش ارسال همه مرسوله‌ها را انتخاب کن";
    }

    return "";
  };

  const getCheckoutPayload = () => ({
    receiverName: receiverName.trim(),
    receiverPhone: receiverPhone.trim(),
    provinceId: Number(form.provinceId),
    cityId: Number(form.cityId),
    address: form.address.trim(),
    postalCode: form.postalCode.trim(),
    requiresPrintedInvoice: form.requiresPrintedInvoice,
    shippingMethodsBySeller: effectiveShippingMethodsBySeller,
    couponCode: couponCode.trim().toUpperCase() || undefined,
  });

  const requestPaymentQuote = async () => {
    setQuoteLoading(true);
    setQuote(null);
    setError("");

    try {
      const response = await fetch("/api/payment/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(getCheckoutPayload()),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "محاسبه پیش‌فاکتور ناموفق بود.",
        );
      }

      if (
        data.success !== true ||
        !isValidQuote(data.quote, sellerGroups.length)
      ) {
        throw new Error(
          "پاسخ پیش‌فاکتور معتبر نیست. لطفاً دوباره تلاش کنید.",
        );
      }

      setQuote(data.quote);
      setStep(4);
    } catch (err) {
      setError(
        err.message ||
        "محاسبه مبلغ سفارش ناموفق بود.",
      );
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleConfirmAndPay = async () => {
    if (paymentInProgressRef.current) return;

    setError("");

    const addressError = validateAddress();

    if (addressError) {
      setStep(1);
      setError(addressError);
      return;
    }

    const shippingError = validateShipping();

    if (shippingError) {
      setStep(2);
      setError(shippingError);
      return;
    }

    if (
      !quote ||
      !isValidQuote(quote, sellerGroups.length)
    ) {
      setError(
        "فاکتور معتبر نیست. دوباره استعلام بگیر.",
      );
      return;
    }

    if (paymentProvider !== "ZARINPAL") {
      setError("درگاه پرداخت معتبر نیست.");
      return;
    }

    paymentInProgressRef.current = true;
    setPaymentLoading(true);

    let redirecting = false;

    try {
      const payload = getCheckoutPayload();

      const quoteResponse = await fetch("/api/payment/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const quoteData = await quoteResponse.json();

      if (
        !quoteResponse.ok ||
        quoteData.success !== true ||
        !isValidQuote(quoteData.quote, sellerGroups.length)
      ) {
        throw new Error(
          quoteData.error ||
          "بررسی نهایی مبلغ سفارش ناموفق بود.",
        );
      }

      const latestQuote = quoteData.quote;

      const quoteFields = [
        "productSubtotalToman",
        "shippingCostToman",
        "couponDiscountToman",
        "couponShippingDiscountToman",
        "totalCouponDiscountToman",
        "requiredAmountToman",
        "gatewayFeeToman",
        "totalAmountToman",
        "shipmentCount",
        "feeType",
        "couponApplied",
      ];

      const quoteUnchanged = quoteFields.every(
        (field) => latestQuote[field] === quote[field],
      );

      const previousCoupon = quote.coupon ?? null;
      const latestCoupon = latestQuote.coupon ?? null;

      const couponUnchanged =
        previousCoupon?.code === latestCoupon?.code &&
        previousCoupon?.type === latestCoupon?.type &&
        previousCoupon?.productDiscountToman ===
        latestCoupon?.productDiscountToman &&
        previousCoupon?.shippingDiscountToman ===
        latestCoupon?.shippingDiscountToman &&
        previousCoupon?.totalDiscountToman ===
        latestCoupon?.totalDiscountToman;

      if (!quoteUnchanged || !couponUnchanged) {
        setQuote(latestQuote);
        setError(
          "مبلغ سفارش تغییر کرده است. فاکتور جدید را بررسی کن و دوباره پرداخت را بزن.",
        );
        return;
      }

      const orderResponse = await fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const orderData = await orderResponse.json();

      const orderId = Number(orderData.orderId);

      if (
        !orderResponse.ok ||
        orderData.success !== true ||
        !Number.isSafeInteger(orderId) ||
        orderId <= 0
      ) {
        throw new Error(
          orderData.error || "ثبت سفارش ناموفق بود.",
        );
      }

      const paymentResponse = await fetch("/api/payment/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ orderId }),
      });

      const paymentData = await paymentResponse.json();

      if (
        !paymentResponse.ok ||
        paymentData.success !== true ||
        typeof paymentData.paymentUrl !== "string"
      ) {
        throw new Error(
          paymentData.error || "ایجاد درخواست پرداخت ناموفق بود.",
        );
      }

      let paymentUrl;

      try {
        paymentUrl = new URL(paymentData.paymentUrl);
      } catch {
        throw new Error("لینک درگاه پرداخت معتبر نیست.");
      }

      if (
        paymentUrl.protocol !== "https:" ||
        !/(^|\.)zarinpal\.com$/i.test(paymentUrl.hostname)
      ) {
        throw new Error("آدرس درگاه پرداخت معتبر نیست.");
      }

      redirecting = true;
      window.location.assign(paymentUrl.toString());
    } catch (err) {
      setError(
        err.message || "در شروع پرداخت خطایی رخ داد.",
      );
    } finally {
      if (!redirecting) {
        paymentInProgressRef.current = false;
        setPaymentLoading(false);
      }
    }
  };

  const goNext = async () => {
    setError("");

    if (step === 1) {
      const validationError = validateAddress();

      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (step === 2) {
      const validationError = validateShipping();

      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (step === 3) {
      if (paymentProvider !== "ZARINPAL") {
        setError("درگاه پرداخت انتخاب‌شده معتبر نیست");
        return;
      }

      await requestPaymentQuote();
      return;
    }

    setStep((previous) => Math.min(4, previous + 1));
  };

  const goBack = () => {
    if (paymentLoading || quoteLoading) return;

    setError("");
    setStep((previous) => Math.max(1, previous - 1));
  };

  if (loading || !user || cartLoading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <p className="text-center text-gray-500">
          در حال بارگذاری اطلاعات سفارش...
        </p>
      </div>
    );
  }

  if (cartError) {
    return (
      <div className="container-page max-w-3xl py-10">
        <div className="card p-6 text-center space-y-4">
          <p className="text-red-500">{cartError}</p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            تلاش دوباره
          </button>
        </div>
      </div>
    );
  }

  if (!cartItems.length || !sellerGroups.length) {
    return (
      <div className="container-page max-w-3xl py-10">
        <div className="card p-6 text-center space-y-4">
          <h1 className="section-title">
            سبد خرید خالی است
          </h1>

          <p className="text-sm muted">
            برای ادامه خرید ابتدا محصولی به سبد خرید اضافه کن.
          </p>

          <button
            type="button"
            onClick={() => router.push("/shop")}
            className="btn-primary"
          >
            بازگشت به فروشگاه
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page max-w-4xl py-10">
      <div className="card p-5 md:p-8 space-y-7">
        <div>
          <h1 className="section-title mb-6 text-[var(--color-text)]">
            تکمیل سفارش
          </h1>

          {/* مراحل Checkout */}
          <div
            className="grid grid-cols-4 gap-2"
            dir="ltr"
          >
            {CHECKOUT_STEPS.map((label, index) => {
              const stepNumber = index + 1;
              const active = step === stepNumber;
              const completed = step > stepNumber;

              return (
                <div
                  key={label}
                  className="text-center space-y-2"
                  dir="rtl"
                >
                  <div
                    className={[
                      "mx-auto flex h-9 w-9 items-center justify-center rounded-full",
                      active || completed
                        ? "bg-[var(--color-accent)] text-white"
                        : "border border-[var(--color-border)] text-[var(--color-text-muted)]",
                    ].join(" ")}
                    aria-label={label}
                    title={label}
                  >
                    <CheckoutStepIcon step={stepNumber} />
                  </div>

                  <div
                    className={[
                      "text-[10px] sm:text-xs",
                      active
                        ? "font-bold text-[var(--color-text)]"
                        : "text-[var(--color-text-muted)]",
                    ].join(" ")}
                  >
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* مرحله اول: اطلاعات گیرنده */}
        {step === 1 && (
          <section className="space-y-5">
            <h2 className="font-bold text-lg">
              اطلاعات گیرنده و آدرس
            </h2>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="receiverName"
                  className="mb-2 block text-sm font-medium"
                >
                  نام گیرنده
                </label>

                <input
                  id="receiverName"
                  type="text"
                  name="receiverName"
                  value={receiverName}
                  onChange={onChange}
                  maxLength={100}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none"
                  placeholder="نام و نام خانوادگی"
                />
              </div>

              <div>
                <label
                  htmlFor="receiverPhone"
                  className="mb-2 block text-sm font-medium"
                >
                  شماره موبایل گیرنده
                </label>

                <input
                  id="receiverPhone"
                  type="text"
                  name="receiverPhone"
                  value={receiverPhone}
                  onChange={onChange}
                  maxLength={11}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none"
                  placeholder="0912xxxxxxx"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {/* انتخاب استان */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  استان
                </label>

                <Select
                  instanceId="checkout-province"
                  isRtl
                  isSearchable
                  isClearable
                  options={provinces}
                  value={
                    provinces.find(
                      (item) => item.value === form.provinceId
                    ) || null
                  }
                  onChange={(selected) =>
                    handleProvinceChange(selected?.value || "")
                  }
                  filterOption={filterLocationOption}
                  styles={locationSelectStyles}
                  placeholder="نام استان را تایپ کن..."
                  noOptionsMessage={() => "استانی پیدا نشد"}
                  loadingMessage={() => "در حال دریافت..."}
                  className="text-sm"
                  classNamePrefix="location-select"
                  menuPlacement="auto"
                  menuShouldScrollIntoView
                />
              </div>

              {/* انتخاب شهر */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  شهر
                </label>

                <Select
                  instanceId="checkout-city"
                  isRtl
                  isSearchable
                  isClearable
                  options={cityOptions}
                  value={
                    cityOptions.find(
                      (item) => item.value === form.cityId
                    ) || null
                  }
                  onChange={(selected) =>
                    handleCityChange(selected?.value || "")
                  }
                  filterOption={filterLocationOption}
                  styles={locationSelectStyles}
                  isDisabled={!form.provinceId}
                  placeholder={
                    form.provinceId
                      ? "نام شهرستان را تایپ کن..."
                      : "ابتدا استان را انتخاب کن"
                  }
                  noOptionsMessage={() => "شهرستانی پیدا نشد"}
                  loadingMessage={() => "در حال دریافت..."}
                  className="text-sm"
                  classNamePrefix="location-select"
                  menuPlacement="auto"
                  menuShouldScrollIntoView
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="address"
                className="mb-2 block text-sm font-medium"
              >
                آدرس کامل
              </label>

              <textarea
                id="address"
                name="address"
                value={form.address}
                onChange={onChange}
                rows={4}
                maxLength={500}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none"
                placeholder="آدرس دقیق، پلاک، واحد و توضیحات لازم برای ارسال"
              />
            </div>

            <div>
              <label
                htmlFor="postalCode"
                className="mb-2 block text-sm font-medium"
              >
                کد پستی
              </label>

              <input
                id="postalCode"
                type="text"
                name="postalCode"
                value={form.postalCode}
                onChange={onChange}
                maxLength={10}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none"
                placeholder="کد پستی ۱۰ رقمی"
              />
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <label
                htmlFor="requiresPrintedInvoice"
                className="flex cursor-pointer items-start gap-3"
              >
                <input
                  id="requiresPrintedInvoice"
                  name="requiresPrintedInvoice"
                  type="checkbox"
                  checked={form.requiresPrintedInvoice}
                  onChange={onChange}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                />

                <span>
                  <span className="block font-bold">
                    درخواست فاکتور چاپی
                  </span>

                  <span className="mt-1 block text-sm leading-6 text-[var(--color-text-muted)]">
                    فاکتور سفارش چاپ شده و همراه بسته برای شما ارسال خواهد شد.
                  </span>
                </span>
              </label>
            </div>
          </section>
        )}

        {/* مرحله دوم: روش ارسال مستقل هر فروشنده */}
        {step === 2 && (
          <section className="space-y-5">
            <div>
              <h2 className="font-bold text-lg">
                انتخاب روش ارسال
              </h2>

              <p className="text-sm muted mt-2">
                هر فروشنده بسته خود را جداگانه ارسال می‌کند؛
                بنابراین برای هر مرسوله یک روش ارسال انتخاب کن.
              </p>
            </div>

            {sellerGroups.map((group) => (
              <div
                key={group.key}
                className="rounded-2xl border border-[var(--color-border)] p-4 space-y-4"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h3 className="font-bold">
                      {group.name}
                    </h3>

                    <p className="text-xs muted mt-1">
                      {group.items.length.toLocaleString("fa-IR")} نوع کالا
                    </p>
                  </div>

                  <div className="text-sm font-medium">
                    {formatToman(group.subtotal)}
                  </div>
                </div>

                <div className="space-y-3">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between gap-3 text-sm"
                    >
                      <span>
                        {item.product.title}
                        {" × "}
                        {Number(item.quantity).toLocaleString("fa-IR")}
                      </span>

                      <span className="whitespace-nowrap">
                        {formatToman(
                          Number(item.product.price) *
                          Number(item.quantity),
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
                  <p className="text-sm font-semibold">
                    روش ارسال این مرسوله
                  </p>

                  {SHIPPING_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] p-3 transition hover:border-[var(--color-accent)]"
                    >
                      <input
                        type="radio"
                        name={`shipping-${group.key}`}
                        value={option.value}
                        checked={
                          effectiveShippingMethodsBySeller[group.key] ===
                          option.value
                        }
                        onChange={() =>
                          handleShippingChange(
                            group.key,
                            option.value,
                          )
                        }
                        className="mt-1 accent-[var(--color-accent)]"
                      />

                      <span className="flex-1">
                        <span className="block font-medium">
                          {option.label}
                        </span>

                        <span className="mt-1 block text-xs muted">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="flex justify-between gap-3 border-t border-[var(--color-border)] pt-3 text-sm">
                  <span className="muted">
                    هزینه این مرسوله
                  </span>

                  <span className="font-semibold">
                    {formatToman(SHIPPING_COST_PER_FULFILLMENT)}
                  </span>
                </div>
              </div>
            ))}

            <div className="flex justify-between rounded-xl bg-[var(--color-surface-2)] p-4 font-bold">
              <span>مجموع هزینه ارسال</span>
              <span>{formatToman(shippingTotal)}</span>
            </div>
          </section>
        )}

        {/* مرحله سوم: درگاه پرداخت و کد تخفیف */}
        {step === 3 && (
          <section className="space-y-5">
            <h2 className="font-bold text-lg">
              انتخاب درگاه پرداخت
            </h2>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-accent)] bg-[var(--color-surface)] p-4">
              <input
                type="radio"
                name="paymentProvider"
                value="ZARINPAL"
                checked={paymentProvider === "ZARINPAL"}
                onChange={() => {
                  setPaymentProvider("ZARINPAL");
                  invalidateQuote();
                }}
                className="accent-[var(--color-accent)]"
              />

              <span className="flex-1">
                <span className="block font-bold">
                  پرداخت آنلاین زرین‌پال
                </span>

                <span className="mt-1 block text-sm muted">
                  پرداخت از طریق درگاه بانکی
                </span>
              </span>
            </label>

            <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-3">
              <div>
                <h3 className="font-bold">
                  کد تخفیف فروشگاه
                </h3>

                <p className="mt-1 text-sm muted leading-6">
                  در صورت داشتن کد تخفیف، آن را وارد کنید.
                </p>
              </div>

              <div>
                <label
                  htmlFor="couponCode"
                  className="mb-2 block text-sm font-medium"
                >
                  کد تخفیف
                </label>

                <input
                  id="couponCode"
                  type="text"
                  value={couponCode}
                  onChange={handleCouponCodeChange}
                  maxLength={40}
                  autoComplete="off"
                  spellCheck={false}
                  dir="ltr"
                  placeholder="کد تخفیف را وارد کنید"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left font-semibold uppercase tracking-wider text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {couponCode.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setCouponCode("");
                    invalidateQuote();
                  }}
                  className="text-sm font-medium text-red-600 hover:underline"
                >
                  حذف کد تخفیف
                </button>
              )}
            </div>
          </section>
        )}

        {/* مرحله چهارم: فاکتور نهایی */}
        {step === 4 && (
          <section className="space-y-5">
            <h2 className="font-bold text-lg">
              فاکتور نهایی سفارش
            </h2>

            {!quote ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                فاکتور معتبر در دسترس نیست. به مرحله قبل برگرد و
                دوباره تلاش کن.
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-3">
                  <h3 className="font-bold">
                    اطلاعات گیرنده
                  </h3>

                  <div className="text-sm space-y-2">
                    <p>{receiverName}</p>
                    <p>{receiverPhone}</p>
                    <p>
                      {provinces.find(
                        (item) => item.value === form.provinceId,
                      )?.label}
                      {"، "}
                      {cityOptions.find(
                        (item) => item.value === form.cityId,
                      )?.label}
                    </p>
                    <p>{form.address}</p>
                    <p>
                      کد پستی: {form.postalCode}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-4">
                  <h3 className="font-bold">
                    جزئیات مرسوله‌ها
                  </h3>

                  {sellerGroups.map((group) => {
                    const selectedMethod = SHIPPING_OPTIONS.find(
                      (option) =>
                        option.value ===
                        effectiveShippingMethodsBySeller[group.key],
                    );

                    return (
                      <div
                        key={group.key}
                        className="border-b last:border-b-0 border-[var(--color-border)] pb-4 last:pb-0 space-y-2"
                      >
                        <div className="flex justify-between gap-3">
                          <span className="font-medium">
                            {group.name}
                          </span>

                          <span className="text-sm">
                            {formatToman(group.subtotal)}
                          </span>
                        </div>

                        <div className="flex justify-between gap-3 text-sm muted">
                          <span>
                            {selectedMethod?.label ||
                              "روش ارسال انتخاب نشده"}
                          </span>

                          <span>
                            {formatToman(
                              SHIPPING_COST_PER_FULFILLMENT,
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl bg-[var(--color-surface-2)] p-4 space-y-3">
                  <h3 className="font-bold">
                    خلاصه مالی سفارش
                  </h3>

                  <div className="flex justify-between gap-3 text-sm">
                    <span>مجموع کالاها</span>
                    <span>
                      {formatToman(quote.productSubtotalToman)}
                    </span>
                  </div>

                  {quote.couponDiscountToman > 0 && (
                    <div className="flex justify-between gap-3 text-sm text-emerald-700">
                      <span>تخفیف کالا</span>
                      <span>
                        − {formatToman(quote.couponDiscountToman)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between gap-3 text-sm">
                    <span>مجموع هزینه ارسال</span>
                    <span>
                      {formatToman(quote.shippingCostToman)}
                    </span>
                  </div>

                  {quote.couponShippingDiscountToman > 0 && (
                    <div className="flex justify-between gap-3 text-sm text-emerald-700">
                      <span>تخفیف ارسال</span>
                      <span>
                        − {formatToman(
                          quote.couponShippingDiscountToman,
                        )}
                      </span>
                    </div>
                  )}

                  {quote.totalCouponDiscountToman > 0 && (
                    <div className="flex justify-between gap-3 border-t border-[var(--color-border)] pt-3 text-sm font-semibold text-emerald-700">
                      <span>مجموع تخفیف کد فروشگاه</span>
                      <span>
                        − {formatToman(
                          quote.totalCouponDiscountToman,
                        )}
                      </span>
                    </div>
                  )}

                  {quote.couponApplied && quote.coupon && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <p className="font-bold" dir="ltr">
                        {quote.coupon.code}
                      </p>

                      <p className="mt-1">
                        {quote.coupon.type === "FREE_SHIPPING"
                          ? "هزینه ارسال تمام مرسوله‌های این سفارش رایگان شده است."
                          : quote.coupon.description ||
                          "کد تخفیف فروشگاه با موفقیت اعمال شد."}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between gap-3 border-t border-[var(--color-border)] pt-3 text-sm">
                    <span>مبلغ پس از اعمال تخفیف</span>
                    <span className="font-semibold">
                      {formatToman(quote.requiredAmountToman)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 text-sm">
                    <span>کارمزد درگاه پرداخت</span>
                    <span>
                      {formatToman(quote.gatewayFeeToman)}
                    </span>
                  </div>

                  <div className="border-t border-[var(--color-border)] pt-3 flex justify-between gap-3 font-bold text-base">
                    <span>مبلغ نهایی قابل پرداخت</span>
                    <span className="text-[var(--color-accent)]">
                      {formatToman(quote.totalAmountToman)}
                    </span>
                  </div>
                </div>

                {/* فقط در سفارش‌های چندفروشنده‌ای نمایش داده می‌شود */}
                {sellerGroups.length > 1 && (
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm leading-7 text-[var(--color-text-muted)]">
                    به‌دلیل ارسال کالاهای سفارش شما از چند انبار
                    متفاوت، هزینه ارسال با سفارش‌های تک‌انباره تفاوت دارد.
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* پیام خطا */}
        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* کنترل مراحل */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 border-t border-[var(--color-border)] pt-5">
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              disabled={quoteLoading || paymentLoading}
              className="btn-outline flex-1 disabled:opacity-50"
            >
              مرحله قبل
            </button>
          )}

          {step < 4 && (
            <button
              type="button"
              onClick={goNext}
              disabled={quoteLoading || paymentLoading}
              className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {quoteLoading
                ? "در حال محاسبه فاکتور..."
                : step === 3
                  ? "محاسبه مبلغ نهایی"
                  : "ادامه"}
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              onClick={handleConfirmAndPay}
              disabled={
                paymentLoading ||
                !quote ||
                !isValidQuote(quote, sellerGroups.length)
              }
              className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paymentLoading
                ? "در حال ثبت سفارش و اتصال به درگاه..."
                : "تأیید سفارش و پرداخت"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}