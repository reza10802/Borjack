# Cron: reservation expiry, payment reconciliation, retry scheduling and cleanup

The 15-minute reservation policy is enforced by `POST /api/internal/cron` (also lazily when a customer retries checkout). The Cron handler is deliberately bounded:

- At most 20 orders are claimed per invocation (hard cap 50).
- Reconciliation stops after a 65-second wall-clock budget.
- Each ZarinPal HTTP request times out after 10 seconds. A timeout/network error is `UNKNOWN`, never proof of non-payment.
- A per-order database lease is stored in the existing `RateLimitBucket` table. Its 90-second expiry allows recovery after a crashed worker. Lease release is token-checked so an old worker cannot delete a newer lease.
- Retry scheduling is also stored in `RateLimitBucket`; no Prisma schema change or migration is required. `windowStart` for the private `recon:retry:<orderId>` key represents `nextRetryAt`.
- Unknown/error results use exponential backoff: 5m, 10m, 20m, 40m and so on, capped at 6h. Orders whose `nextRetryAt` is still in the future are excluded in SQL, so they cannot occupy the head of the queue.

For each eligible expired RESERVED order, the app follows ZarinPal's two-step flow:

1. `inquiry.json` checks the authority using `merchant_id` + `authority` only.
2. Inquiry `PAID` or `VERIFIED` -> call `verify.json` with the order amount; only Verify `100` or `101` is treated as paid and settled.
3. Inquiry `FAILED` -> release the reservation safely.
4. Inquiry `IN_BANK`, `REVERSED`, invalid Authority (`-54`), network errors, timeouts, or unknown responses -> do not release stock. `REVERSED` and consistency mismatches are sent to manual review.

Inquiry is not a substitute for Verify. `ZARINPAL_UNPAID_CODES` is not used to decide reservation release; the documented Inquiry status `FAILED` is the only automatic unpaid signal.

The handler also purges OTP rows (>24h), expired rate-limit/reconciliation buckets (>48h), and old login-attempt rows. Cron invocations may overlap safely because each order is leased independently; duplicate work is skipped.

## Setup on the VPS

Set a random `CRON_SECRET` (at least 32 characters) in the app's production environment, restart the app, and store the same secret in a root-readable file:

```bash
openssl rand -hex 32 | sudo tee /etc/borjak/cron_secret >/dev/null && sudo chmod 600 /etc/borjak/cron_secret
```

Run every five minutes. The application reconciliation budget is 65 seconds; allow up to 110 seconds for the request and cleanup work:

```cron
*/5 * * * * curl -fsS --max-time 110 -X POST -H "Authorization: Bearer $(cat /etc/borjak/cron_secret)" http://127.0.0.1:3000/api/internal/cron >> /var/log/borjak-cron.log 2>&1
```

Block `/api/internal/` from the public internet in nginx. Only loopback/VPS cron should reach it.

Expected response includes `reconcile.processed`, `reconcile.summary`, `reconcile.deferredByLease`, `reconcile.timeBudgetExceeded`, `reconcile.hasMore`, and duration values. Alert if Cron returns non-200 for >15 minutes, if `hasMore` or `timeBudgetExceeded` is continuously true, or if `UNKNOWN_KEEP`/`ERROR`/`MISMATCH` counts keep growing.

Orders needing human attention (paid but cancelled for stock, paid on a superseded authority, mismatch, or reversed at gateway): `GET /api/admin/payments/issues` (ADMIN).
