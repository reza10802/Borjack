# Borjak Nginx Rate Limiting

These files are the version-controlled source for Borjak's Nginx
rate-limiting configuration.

## Files

- `borjak-rate-limit-zones.conf`
  - Contains `map` and `limit_req_zone` directives.
  - Install in `/etc/nginx/conf.d/`, which is included inside Nginx's
    `http` context on the current VPS.

- `borjak-rate-limit-server.conf`
  - Contains `limit_req` directives and the rejection status.
  - Install in `/etc/nginx/snippets/` and include it only in the HTTPS
    server block for `borjak.site` and `www.borjak.site`.

## Deployment safety

1. Back up the existing Nginx site configuration before changing it.
2. Install both files from this repository.
3. Add the server-snippet include to the existing HTTPS server block.
4. Do not replace the Certbot-managed site configuration wholesale.
5. Run `sudo nginx -t`.
6. Reload Nginx only if the configuration test succeeds.
7. Verify the homepage and API endpoints after reload.

## Rollback

Restore the backed-up site configuration, remove the two installed
rate-limit files, run `sudo nginx -t`, and reload Nginx only if the
restored configuration passes validation.

## Notes

The limits currently use the client IP address. They do not replace
application-level protections such as per-account or per-phone OTP
limits, authorization checks, and payment idempotency.
'@ | Set-Content .\deploy\nginx\README.md -Encoding utf8

git status --short