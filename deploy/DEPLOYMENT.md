# Deployment checklist (after this remediation)

1. **Backup first** (pg_dump) and test restore somewhere else.
2. Deploy the code, then run `npx prisma migrate deploy` (service `migrate` in compose). NEVER `prisma db push` / `migrate reset`
   on production — the stock CHECK constraints exist only in SQL migrations.
3. After every deploy/restore: `DATABASE_URL=... npm run db:verify-constraints` (must print OK).
4. Production env: set `CRON_SECRET` (>=32 chars), keep `ZARINPAL_SANDBOX` unset/false, real `ZARINPAL_MERCHANT_ID`,
   `NEXT_PUBLIC_SITE_URL=https://…`, strong `JWT_SECRET`. Optionally `OTP_PEPPER`.
5. nginx: include `deploy/nginx/borjak-security.conf` (X-Real-IP overwrite, block /api/internal) and the existing rate-limit snippets; reload.
6. Install the cron job (`deploy/cron/README.md`).
7. Security headers ship CSP in **Report-Only**: check the browser console on staging, then switch to enforcing.
8. All users logged in before the deploy keep working (tokens without `tv` are treated as version 0). A password reset,
   role change or deactivation revokes that user's sessions. To force-logout everybody: `UPDATE "User" SET "tokenVersion" = "tokenVersion" + 1;`
9. Existing weak passwords still log in (policy applies to register/reset only).
10. Lockfile URLs point to registry.npmjs.org; npm replaces the host with your configured registry (e.g. the Liara mirror) automatically.
