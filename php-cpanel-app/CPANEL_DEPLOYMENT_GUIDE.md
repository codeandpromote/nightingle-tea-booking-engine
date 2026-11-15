# Nightingale Tea Tourism Booking System — Shared cPanel Deployment Guide

## 1. Architecture Designed for Lakhs of Visitors on Shared cPanel
1. **Zero-DB-Hit Public Read Path (`CacheService.php`)**: Public estate listings, tariff schedules, and 30-day availability calendars are served from atomic POSIX-renamed JSON cache files (or APCu when enabled) with `ETag` / `304 Not Modified` headers. Even during traffic spikes of 100,000+ visitors, 99% of reads do **not** open a MySQL connection.
2. **Pessimistic InnoDB Row Locking (`BookingService.php`)**: Reservation creation runs inside `DB::transaction()` with `SELECT ... FOR UPDATE` ordered deterministically by `stay_date ASC`, preventing double-bookings and deadlocks.
3. **Sliding-Window Rate Limiter (`RateLimiter.php`)**: Protects PHP-FPM/LSAPI workers from checkout floods and brute-force logins before touching MySQL.
4. **Cloudflare Free CDN Pairing**: Point `booking.nightingaletea.com` through Cloudflare (Proxy ON). Enable Cache Rules for `/assets/*` and `/api/estates` to offload static and semi-static traffic at the edge.

## 2. Subdomain vs Subfolder Deployment
- **Option A (Recommended — Subdomain `booking.nightingaletea.com`)**:
  1. In cPanel -> **Domains**, create subdomain `booking.nightingaletea.com` pointing to `/home/YOURUSER/booking.nightingaletea.com`.
  2. Upload the contents of `php-cpanel-app/` into that folder.
  3. Set DocumentRoot to `/home/YOURUSER/booking.nightingaletea.com/public` (or leave at root; the root `.htaccess` automatically routes safely to `public/` and blocks `/app`, `/config`, `/database`, `/storage`).
  4. Keep `APP_BASE_PATH=` blank in `.env`.
- **Option B (Subfolder `nightingaletea.com/booking`)**:
  1. Upload contents of `php-cpanel-app/` into `/home/YOURUSER/public_html/booking`.
  2. Set `APP_BASE_PATH=/booking` in `.env`.

## 3. Database & Environment Setup
1. In cPanel -> **MySQL Databases**, create a database and user with `ALL PRIVILEGES`.
2. Open **phpMyAdmin** -> Import `database/schema.sql`, then `database/seed.sql`.
3. Copy `.env.example` to `.env` and fill `DB_NAME`, `DB_USER`, `DB_PASS`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `MERCHANT_UPI_ID`, and `CRON_SECRET`.
4. Ensure `storage/cache`, `storage/uploads`, `storage/logs`, and `storage/ratelimits` have `0750` permissions.

## 4. cPanel Cron Job (Automatic Unpaid Hold Expiry)
In cPanel -> **Cron Jobs**, add a job running every 5 minutes:
```bash
*/5 * * * * /usr/local/bin/php -q /home/YOURUSER/booking.nightingaletea.com/cron/expire_holds.php >/dev/null 2>&1
```

## 5. Razorpay Webhook Setup
In Razorpay Dashboard -> **Webhooks**, add:
`https://booking.nightingaletea.com/api/payments/razorpay/webhook`
Subscribe to `payment.captured` and paste the Webhook Secret into `RAZORPAY_WEBHOOK_SECRET` in `.env`.
