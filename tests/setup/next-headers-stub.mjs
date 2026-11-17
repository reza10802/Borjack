// Test stand-in for `next/headers`. Route handlers read the session cookie through cookies()
// and the client IP through headers(); tests describe the "current request" in
// globalThis.__testRequest (see tests/helpers/http.mjs).
const current = () => globalThis.__testRequest ?? { cookies: {}, headers: {} };

export async function cookies() {
  const jar = () => current().cookies ?? {};
  return {
    get: (name) => (jar()[name] !== undefined ? { name, value: jar()[name] } : undefined),
    getAll: () => Object.entries(jar()).map(([name, value]) => ({ name, value })),
    has: (name) => jar()[name] !== undefined,
    set() {},
    delete() {},
  };
}

export async function headers() {
  return new Headers(current().headers ?? {});
}
