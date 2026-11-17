// Shared helpers for the seed modules.
//
// Everything random goes through createRng(), a seeded PRNG, so the same
// SEED_RANDOM_SEED always produces the same database (same ids, same orders).
// That makes test data reproducible and removes the "works on the 2nd run" class of bugs.

export const INT32_MAX = 2_147_483_647; // Postgres INTEGER limit (Order.total, Transaction.amount, ...)

export const MS = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

// mulberry32 — tiny, fast, deterministic.
export function createRng(seed = 1337) {
  let a = Number(seed) >>> 0;

  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min, max) => Math.floor(next() * (max - min + 1)) + min;

  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    // weighted: [[value, weight], ...]
    weighted(pairs) {
      const total = pairs.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [value, weight] of pairs) {
        r -= weight;
        if (r < 0) return value;
      }
      return pairs[pairs.length - 1][0];
    },
    shuffle(arr) {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

// Fails loudly in the seed instead of with a cryptic Postgres error halfway through.
export function assertInt32(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > INT32_MAX) {
    throw new Error(`[seed] ${label} = ${value} does not fit in a 32-bit INTEGER column`);
  }
  return value;
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]+/g, "")
    .replace(/--+/g, "-");
}

export const minutesAgo = (now, n) => new Date(now.getTime() - n * MS.minute);
export const daysAgo = (now, n) => new Date(now.getTime() - n * MS.day);
export const addMs = (date, ms) => new Date(date.getTime() + ms);
export const minDate = (a, b) => (a.getTime() <= b.getTime() ? a : b);
