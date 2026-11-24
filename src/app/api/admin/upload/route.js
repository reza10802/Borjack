
import { NextResponse } from "next/server";
import { mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { requireRoles, ROLES } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.resolve(
  /*turbopackIgnore: true*/
  process.env.UPLOAD_DIR ||
  path.join(process.cwd(), "storage", "uploads")
);

const MAX_STANDARD_SIZE = 15 * 1024 * 1024;
const MAX_HEIC_SIZE = 25 * 1024 * 1024;

const MAX_PIXELS = 50_000_000;
const MAX_OUTPUT_DIMENSION = 1600;
const MIN_INPUT_DIMENSION = 500;

const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
]);

const HEIC_EXTENSIONS = new Set([
  ".heic",
  ".heif",
]);

const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
]);

const AVIF_BRANDS = new Set([
  "avif",
  "avis",
]);

const ALLOWED_MIME_TYPES = {
  "image/jpeg": ["jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "image/avif": ["heif", "avif"],
};

let sharpModule = null;
let heifModulePromise = null;

async function getSharp() {
  if (!sharpModule) {
    const imported = await import("sharp");
    sharpModule = imported.default || imported;
  }

  return sharpModule;
}

async function getHeif() {
  if (!heifModulePromise) {
    heifModulePromise = import("libheif-js").then(
      (imported) => imported.default || imported
    );
  }

  return heifModulePromise;
}

function createBadRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function getFileTypeBrands(header) {
  if (
    !Buffer.isBuffer(header) ||
    header.length < 16 ||
    header.toString("ascii", 4, 8) !== "ftyp"
  ) {
    return [];
  }

  const declaredSize = header.readUInt32BE(0);

  const boxEnd = Math.min(
    header.length,
    declaredSize >= 16 ? declaredSize : header.length
  );

  const brands = [
    header.toString("ascii", 8, 12),
  ];

  // چهار بایت اول بعد از major brand مربوط به minor version است.
  for (let offset = 16; offset + 4 <= boxEnd; offset += 4) {
    brands.push(
      header.toString("ascii", offset, offset + 4)
    );
  }

  return brands;
}

function isHeifContainer(header) {
  const brands = getFileTypeBrands(header);

  // AVIF نباید به‌عنوان فایل آیفون با سقف ۲۵ مگابایت شناخته شود.
  if (brands.some((brand) => AVIF_BRANDS.has(brand))) {
    return false;
  }

  return brands.some(
    (brand) =>
      HEIC_BRANDS.has(brand) ||
      brand === "mif1" ||
      brand === "msf1"
  );
}

function isHeicUpload(file, header) {
  const mimeType = String(file.type || "")
    .trim()
    .toLowerCase();

  const extension = path.extname(
    String(file.name || "")
  ).toLowerCase();

  const declaredAsHeic = HEIC_MIME_TYPES.has(mimeType);

  const hasUnknownMimeWithHeicExtension =
    (!mimeType || mimeType === "application/octet-stream") &&
    HEIC_EXTENSIONS.has(extension);

  const declaredAsHeicFile =
    declaredAsHeic || hasUnknownMimeWithHeicExtension;

  if (!declaredAsHeicFile) {
    return false;
  }

  if (!isHeifContainer(header)) {
    throw createBadRequest(
      "محتوای فایل با فرمت HEIC یا HEIF اعلام‌شده مطابقت ندارد."
    );
  }

  return true;
}

function validateDimensions(widthValue, heightValue) {
  const width = Number(widthValue);
  const height = Number(heightValue);

  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw createBadRequest(
      "ابعاد تصویر معتبر نیست."
    );
  }

  if (width * height > MAX_PIXELS) {
    throw createBadRequest(
      "ابعاد تصویر بیش از ۵۰ مگاپیکسل است."
    );
  }

  if (
    width < MIN_INPUT_DIMENSION ||
    height < MIN_INPUT_DIMENSION
  ) {
    throw createBadRequest(
      "ابعاد تصویر باید حداقل ۵۰۰ در ۵۰۰ پیکسل باشد. لطفاً تصویر باکیفیت‌تری انتخاب کنید."
    );
  }

  return { width, height };
}


async function decodeHeicImage(buffer) {
  let libheif;

  try {
    libheif = await getHeif();
  } catch {
    throw new Error(
      "کتابخانه پردازش HEIC در سرور بارگذاری نشد."
    );
  }

  let images = [];

  try {
    const decoder = new libheif.HeifDecoder();
    images = decoder.decode(buffer);

    if (!Array.isArray(images) || images.length === 0) {
      throw createBadRequest(
        "فایل HEIC یا HEIF معتبر نیست یا قابل رمزگشایی نیست."
      );
    }

    const image = images[0];

    const { width, height } = validateDimensions(
      image.get_width(),
      image.get_height()
    );

    const rgbaData = new Uint8ClampedArray(
      width * height * 4
    );

    const imageData = await new Promise(
      (resolve, reject) => {
        image.display(
          {
            data: rgbaData,
            width,
            height,
          },
          (displayData) => {
            if (!displayData || !displayData.data) {
              reject(
                createBadRequest(
                  "رمزگشایی تصویر HEIC ناموفق بود."
                )
              );
              return;
            }

            resolve(displayData);
          }
        );
      }
    );

    const outputWidth = Number(imageData.width);
    const outputHeight = Number(imageData.height);

    validateDimensions(outputWidth, outputHeight);

    const pixels = imageData.data;

    if (
      !pixels ||
      pixels.byteLength !== outputWidth * outputHeight * 4
    ) {
      throw createBadRequest(
        "داده‌های تصویر HEIC ناقص یا نامعتبر هستند."
      );
    }

    return {
      buffer: Buffer.from(
        pixels.buffer,
        pixels.byteOffset,
        pixels.byteLength
      ),
      width: outputWidth,
      height: outputHeight,
    };
  } catch (error) {
    if (error?.status === 400) {
      throw error;
    }

    console.error("HEIC_DECODE_ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    throw createBadRequest(
      "فایل HEIC یا HEIF سالم نیست یا رمزگشایی آن امکان‌پذیر نیست."
    );
  } finally {
    for (const image of images) {
      try {
        image?.free?.();
      } catch {
        // خطای آزادسازی نباید نتیجه پردازش را تغییر دهد.
      }
    }
  }
}


function getSafeRelativePath(date, filename) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return path.join("products", year, month, filename);
}

function getPublicUrl(relativePath) {
  return `/uploads/${relativePath
    .split(path.sep)
    .join("/")}`;
}

async function removeFileSafely(filePath) {
  if (!filePath) return;

  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        "UPLOAD_CLEANUP_ERROR:",
        error.message
      );
    }
  }
}

async function inspectImage(buffer, expectedMimeType) {
  const sharp = await getSharp();

  let metadata;

  try {
    metadata = await sharp(buffer, {
      failOn: "error",
      limitInputPixels: MAX_PIXELS,
    }).metadata();
  } catch {
    throw createBadRequest(
      "فایل انتخاب‌شده یک تصویر سالم و قابل پردازش نیست."
    );
  }

  const allowedFormats =
    ALLOWED_MIME_TYPES[expectedMimeType];

  if (
    !allowedFormats ||
    !allowedFormats.includes(metadata.format)
  ) {
    throw createBadRequest(
      "فرمت واقعی فایل با فرمت اعلام‌شده مطابقت ندارد."
    );
  }

  const dimensions = validateDimensions(
    metadata.width,
    metadata.height
  );

  if (Number(metadata.pages || 1) > 1) {
    throw createBadRequest(
      "تصاویر متحرک قابل بارگذاری نیستند. لطفاً تصویر ثابت محصول را انتخاب کنید."
    );
  }

  return {
    ...dimensions,
    format: metadata.format,
  };
}

async function optimizeImage(
  buffer,
  outputPath,
  rawOptions = null
) {
  const sharp = await getSharp();

  let pipeline = sharp(buffer, {
    failOn: "error",
    limitInputPixels: MAX_PIXELS,
    ...(rawOptions ? { raw: rawOptions } : {}),
  });

  // تصاویر رمزگشایی‌شده HEIC به‌صورت RGBA هستند.
  // سایر تصاویر جهت EXIF خود را حفظ می‌کنند.
  if (!rawOptions) {
    pipeline = pipeline.rotate();
  }

  return pipeline
    .resize({
      width: MAX_OUTPUT_DIMENSION,
      height: MAX_OUTPUT_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
      kernel: "lanczos3",
    })
    .webp({
      quality: 84,
      effort: 5,
      smartSubsample: true,
    })
    .toFile(outputPath);
}

export async function POST(req) {
  const check = await requireRoles([
    ROLES.ADMIN,
    ROLES.SUPPLIER,
  ]);

  if (check.error) {
    return check.error;
  }

  let outputPath = null;

  try {
    const formData = await req.formData();
    const file = formData.get("image");

    if (
      !file ||
      typeof file === "string" ||
      file.size === 0
    ) {
      return NextResponse.json(
        { error: "لطفاً یک تصویر معتبر انتخاب کنید." },
        { status: 400 }
      );
    }

    // فقط سربرگ کوچک فایل برای تشخیص نوع واقعی خوانده می‌شود.
    const header = Buffer.from(
      await file.slice(0, 256).arrayBuffer()
    );

    const mimeType = String(file.type || "")
      .trim()
      .toLowerCase();

    const isHeic = isHeicUpload(file, header);

    if (
      !isHeic &&
      !ALLOWED_MIME_TYPES[mimeType]
    ) {
      return NextResponse.json(
        {
          error:
            "فرمت تصویر پشتیبانی نمی‌شود. فرمت‌های JPG، PNG، WebP، AVIF، HEIC و HEIF مجاز هستند.",
        },
        { status: 400 }
      );
    }

    const maxSize = isHeic
      ? MAX_HEIC_SIZE
      : MAX_STANDARD_SIZE;

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: isHeic
            ? "حجم تصویر HEIC یا HEIF نباید بیشتر از ۲۵ مگابایت باشد."
            : "حجم تصویر نباید بیشتر از ۱۵ مگابایت باشد.",
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    if (buffer.length !== file.size) {
      return NextResponse.json(
        { error: "دریافت فایل تصویر کامل نبود." },
        { status: 400 }
      );
    }

    let originalImage;
    let heicImage = null;

    if (isHeic) {
      heicImage = await decodeHeicImage(buffer);

      originalImage = {
        width: heicImage.width,
        height: heicImage.height,
      };
    } else {
      originalImage = await inspectImage(
        buffer,
        mimeType
      );
    }

    const now = new Date();

    const filename = `${crypto
      .randomBytes(16)
      .toString("hex")}.webp`;

    const relativePath = getSafeRelativePath(
      now,
      filename
    );

    const absoluteDir = path.resolve(
      UPLOAD_DIR,
      path.dirname(relativePath)
    );

    if (
      absoluteDir !== UPLOAD_DIR &&
      !absoluteDir.startsWith(`${UPLOAD_DIR}${path.sep}`)
    ) {
      throw createBadRequest(
        "مسیر ذخیره تصویر معتبر نیست."
      );
    }

    await mkdir(absoluteDir, {
      recursive: true,
    });

    outputPath = path.join(
      absoluteDir,
      filename
    );

    const optimized = await optimizeImage(
      heicImage ? heicImage.buffer : buffer,
      outputPath,
      heicImage
        ? {
          width: heicImage.width,
          height: heicImage.height,
          channels: 4,
        }
        : null
    );

    return NextResponse.json(
      {
        url: getPublicUrl(relativePath),
        image: {
          width: optimized.width,
          height: optimized.height,
          format: "webp",
          size: optimized.size,
          originalWidth: originalImage.width,
          originalHeight: originalImage.height,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    await removeFileSafely(outputPath);

    if (error.status === 400) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error("PRODUCT_IMAGE_UPLOAD_ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      {
        error: "خطا در پردازش یا ذخیره تصویر محصول.",
      },
      { status: 500 }
    );
  }
}
