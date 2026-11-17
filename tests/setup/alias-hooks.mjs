import { pathToFileURL, fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
export async function resolve(specifier, ctx, next) {
  // `next` ships CommonJS without an exports map, so ESM needs the explicit file.
  if (specifier === "next/server") return next("next/server.js", ctx);
  if (specifier === "next/headers") {
    return next(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "next-headers-stub.mjs")).href, ctx);
  }
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    for (const c of [base, base + ".js", base + ".mjs", path.join(base, "index.js")]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return next(pathToFileURL(c).href, ctx);
    }
  }
  return next(specifier, ctx);
}
