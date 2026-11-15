<?php
declare(strict_types=1);

/**
 * Nightingale Tea Tourism Booking Engine - Single Front Controller
 * Shared-cPanel Optimized | PHP 8.1+ | Zero Composer Dependencies
 */

$config = require dirname(__DIR__) . '/config/app.php';
date_default_timezone_set($config['timezone']);

// Lightweight PSR-4 Autoloader for App\*
spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $rel = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = dirname(__DIR__) . '/app/' . $rel . '.php';
    if (is_file($file)) {
        require_once $file;
    }
});

// Strict Security Headers & Main Domain CORS Allowlist
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-XSS-Protection: 1; mode=block');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $config['allowed_origins'], true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    header('Vary: Origin');
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

App\Core\Auth::startSession($config['session_name']);

$cache = new App\Core\CacheService($config['paths']['cache']);
$limiter = new App\Core\RateLimiter($config['paths']['ratelimits']);
$bookingService = new App\Services\BookingService($cache, $config);

$home = new App\Controllers\HomeController($cache, $bookingService, $config);
$booking = new App\Controllers\BookingController($bookingService, $cache, $limiter, $config);
$admin = new App\Controllers\AdminController($bookingService, $cache, $limiter, $config);

$router = new App\Core\Router($config['base_path']);

// Guest & Public API Routes
$router->get('/', fn() => $home->index());
$router->get('/receipt/{ref}', fn($p) => $home->receiptPage($p));
$router->get('/api/estates', fn() => $home->apiEstates());
$router->get('/api/search', fn() => $home->apiSearch());
$router->get('/api/availability', fn() => $home->apiAvailability());
$router->get('/api/quote', fn() => $home->apiQuote());
$router->get('/api/bookings/lookup', fn() => $home->apiLookupBooking());

// Checkout & Payment Routes
$router->post('/api/bookings', fn() => $booking->create());
$router->post('/api/payments/razorpay/verify', fn() => $booking->verifyRazorpay());
$router->post('/api/payments/razorpay/webhook', fn() => $booking->razorpayWebhook());
$router->post('/api/payments/upi/submit', fn() => $booking->submitManualUpi());

// Admin Console Routes
$router->get('/admin/login', fn() => $admin->loginPage());
$router->post('/admin/login', fn() => $admin->loginSubmit());
$router->post('/admin/logout', fn() => $admin->logout());
$router->get('/admin', fn() => $admin->dashboard());
$router->post('/api/admin/bookings/status', fn() => $admin->updateBookingStatus());
$router->post('/api/admin/inventory', fn() => $admin->updateInventoryOverride());
$router->post('/api/admin/rooms/update', fn() => $admin->updateRoomCategory());
$router->post('/api/admin/rooms/add', fn() => $admin->addRoomCategory());
$router->get('/admin/export/csv', fn() => $admin->exportCsv());
$router->get('/admin/proof/{file}', fn($p) => $admin->viewProof($p));

$router->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $_SERVER['REQUEST_URI'] ?? '/');
