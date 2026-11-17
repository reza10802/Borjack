"use client";

import Image from "next/image";
import { safeImageSrc } from "@/lib/utils";

// next/image با src نامعتبر (مثل "x") کرش می‌کنه؛ این کامپوننت در اون حالت فقط یه جای‌نگهدار نشون می‌ده
export default function SafeImage({ src, alt = "", ...props }) {
  const valid = safeImageSrc(src);

  if (!valid) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="absolute inset-0 bg-[var(--color-surface-2)]"
      />
    );
  }

  return <Image src={valid} alt={alt} {...props} />;
}