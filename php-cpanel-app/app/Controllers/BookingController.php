<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\CacheService;
use App\Core\Csrf;
use App\Core\Database;
use App\Core\RateLimiter;
use App\Core\Response;
use App\Services\BookingService;
use App\Services\RazorpayService;
use App\Services\UpiQrService;
use PDO;
use Throwable;

final class BookingController
{
    public function __construct(
        private BookingService $bookingService,
        private CacheService $cache,
        private RateLimiter $limiter,
        private array $config
    ) {}

    public function create(): never
    {
        $ip = RateLimiter::clientIp();
        if (!$this->limiter->check('booking_create', $ip, $this->config['rate_limits']['booking_create_per_min'], 60)) {
            Response::json(['error' => 'Too many reservation attempts. Please wait a minute and retry.'], 429);
        }

        $body = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($body)) {
            $body = $_POST;
        }

        if (!Csrf::verify($body['_csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null))) {
            Response::json(['error' => 'Security token expired. Please refresh and try again.'], 403);
        }

        foreach (['estate_slug', 'check_in', 'check_out', 'guest_name', 'guest_phone', 'guest_email'] as $req) {
            if (empty(trim((string) ($body[$req] ?? '')))) {
                Response::json(['error' => "Missing required field: {$req}."], 422);
            }
        }
        if (!filter_var((string) $body['guest_email'], FILTER_VALIDATE_EMAIL)) {
            Response::json(['error' => 'Please enter a valid email address.'], 422);
        }

        try {
            $reservation = $this->bookingService->createReservation($body);
            $resp = [
                'booking_ref' => $reservation['booking_ref'],
                'total_amount' => $reservation['tariff']['total_amount'],
                'hold_expires_at' => $reservation['hold_expires_at'],
                'payment_method' => $reservation['payment_method'],
                'tariff' => $reservation['tariff'],
            ];

            if ($reservation['payment_method'] === 'RAZORPAY') {
                $rzp = new RazorpayService(
                    $this->config['razorpay']['key_id'],
                    $this->config['razorpay']['key_secret'],
                    $this->config['razorpay']['webhook_secret']
                );
                if ($rzp->isConfigured()) {
                    $order = $rzp->createOrder((int) $reservation['tariff']['total_amount'], $reservation['booking_ref']);
                    $pdo = Database::connection();
                    $pdo->prepare('UPDATE bookings SET razorpay_order_id = :oid WHERE id = :id')
                        ->execute(['oid' => $order['id'], 'id' => $reservation['booking_id']]);
                    $pdo->prepare("INSERT INTO payments (booking_id, method, amount, gateway_order_id, status) VALUES (:bid, 'RAZORPAY', :amt, :oid, 'INITIATED')")
                        ->execute(['bid' => $reservation['booking_id'], 'amt' => $reservation['tariff']['total_amount'], 'oid' => $order['id']]);
                    $resp['razorpay'] = [
                        'key_id' => $this->config['razorpay']['key_id'],
                        'order_id' => $order['id'],
                        'amount_paise' => $order['amount'],
                    ];
                }
            } else {
                $pdo = Database::connection();
                $settings = $pdo->query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('upi_id','upi_merchant_name')")->fetchAll(PDO::FETCH_KEY_PAIR);
                $vpa = $settings['upi_id'] ?? $this->config['upi']['vpa'];
                $name = $settings['upi_merchant_name'] ?? $this->config['upi']['merchant_name'];
                $resp['upi'] = [
                    'vpa' => $vpa,
                    'merchant_name' => $name,
                    'uri' => UpiQrService::buildUpiUri($vpa, $name, (float) $reservation['tariff']['total_amount'], $reservation['booking_ref']),
                ];
            }

            Response::json($resp, 201);
        } catch (Throwable $e) {
            Response::json(['error' => $e->getMessage()], 422);
        }
    }

    public function verifyRazorpay(): never
    {
        $body = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $ref = strtoupper(trim((string) ($body['booking_ref'] ?? '')));
        $orderId = trim((string) ($body['razorpay_order_id'] ?? ''));
        $paymentId = trim((string) ($body['razorpay_payment_id'] ?? ''));
        $signature = trim((string) ($body['razorpay_signature'] ?? ''));

        $rzp = new RazorpayService(
            $this->config['razorpay']['key_id'],
            $this->config['razorpay']['key_secret'],
            $this->config['razorpay']['webhook_secret']
        );

        if (!$rzp->verifyCheckoutSignature($orderId, $paymentId, $signature)) {
            Response::json(['error' => 'Invalid Razorpay payment signature.'], 400);
        }

        Database::transaction(function (PDO $pdo) use ($ref, $orderId, $paymentId) {
            $stmt = $pdo->prepare('SELECT * FROM bookings WHERE booking_ref = :ref AND razorpay_order_id = :oid FOR UPDATE');
            $stmt->execute(['ref' => $ref, 'oid' => $orderId]);
            $booking = $stmt->fetch();
            if (!$booking) {
                throw new \RuntimeException('Booking/Order mismatch.');
            }

            $pdo->prepare("UPDATE bookings SET status = 'CONFIRMED', razorpay_payment_id = :pid, hold_expires_at = NULL WHERE id = :id")
                ->execute(['pid' => $paymentId, 'id' => $booking['id']]);
            $pdo->prepare("UPDATE payments SET gateway_payment_id = :pid, status = 'VERIFIED', verified_by = 'RAZORPAY_CHECKOUT', verified_at = NOW() WHERE gateway_order_id = :oid")
                ->execute(['pid' => $paymentId, 'oid' => $orderId]);
            $pdo->prepare("INSERT INTO audit_logs (actor, action, target_ref, details) VALUES ('RAZORPAY', 'PAYMENT_CONFIRMED', :ref, :det)")
                ->execute(['ref' => $ref, 'det' => "Auto-confirmed via Razorpay Payment ID {$paymentId}"]);
        });

        $this->cache->invalidatePrefix('avail_');
        Response::json(['status' => 'CONFIRMED', 'booking_ref' => $ref]);
    }

    public function razorpayWebhook(): never
    {
        $rawBody = (string) file_get_contents('php://input');
        $headerSig = (string) ($_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '');
        $rzp = new RazorpayService(
            $this->config['razorpay']['key_id'],
            $this->config['razorpay']['key_secret'],
            $this->config['razorpay']['webhook_secret']
        );

        if (!$rzp->verifyWebhookSignature($rawBody, $headerSig)) {
            Response::json(['error' => 'Invalid webhook signature'], 400);
        }

        $event = json_decode($rawBody, true);
        if (($event['event'] ?? '') === 'payment.captured') {
            $payment = $event['payload']['payment']['entity'] ?? [];
            $orderId = $payment['order_id'] ?? '';
            $paymentId = $payment['id'] ?? '';

            if ($orderId !== '' && $paymentId !== '') {
                Database::transaction(function (PDO $pdo) use ($orderId, $paymentId, $rawBody) {
                    $stmt = $pdo->prepare('SELECT * FROM bookings WHERE razorpay_order_id = :oid FOR UPDATE');
                    $stmt->execute(['oid' => $orderId]);
                    $booking = $stmt->fetch();
                    if ($booking && $booking['status'] !== 'CONFIRMED') {
                        $pdo->prepare("UPDATE bookings SET status = 'CONFIRMED', razorpay_payment_id = :pid, hold_expires_at = NULL WHERE id = :id")
                            ->execute(['pid' => $paymentId, 'id' => $booking['id']]);
                        $pdo->prepare("UPDATE payments SET gateway_payment_id = :pid, status = 'VERIFIED', verified_by = 'RAZORPAY_WEBHOOK', verified_at = NOW(), raw_payload_json = :raw WHERE gateway_order_id = :oid")
                            ->execute(['pid' => $paymentId, 'raw' => $rawBody, 'oid' => $orderId]);
                    }
                });
                $this->cache->invalidatePrefix('avail_');
            }
        }

        Response::json(['received' => true]);
    }

    public function submitManualUpi(): never
    {
        $ref = strtoupper(trim((string) ($_POST['booking_ref'] ?? '')));
        $utr = strtoupper(trim((string) ($_POST['utr_reference'] ?? '')));

        if (!Csrf::verify($_POST['_csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null))) {
            Response::json(['error' => 'Security token expired. Please refresh.'], 403);
        }
        if ($ref === '' || strlen($utr) < 8) {
            Response::json(['error' => 'Please provide a valid Booking Reference and 12-digit UTR / Transaction Reference.'], 422);
        }

        $savedFilename = null;
        if (!empty($_FILES['payment_proof']['tmp_name'])) {
            $file = $_FILES['payment_proof'];
            if ($file['error'] !== UPLOAD_ERR_OK || $file['size'] > 4 * 1024 * 1024) {
                Response::json(['error' => 'Payment proof must be under 4 MB.'], 422);
            }

            // Magic-byte MIME verification (never trust client filename/Content-Type)
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->file($file['tmp_name']);
            $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'application/pdf' => 'pdf'];
            if (!isset($allowed[$mime])) {
                Response::json(['error' => 'Only JPG, PNG, WEBP, or PDF payment proofs are permitted.'], 422);
            }

            $uploadDir = $this->config['paths']['uploads'];
            if (!is_dir($uploadDir)) {
                @mkdir($uploadDir, 0750, true);
            }
            $savedFilename = $ref . '_' . bin2hex(random_bytes(8)) . '.' . $allowed[$mime];
            if (!move_uploaded_file($file['tmp_name'], $uploadDir . '/' . $savedFilename)) {
                Response::json(['error' => 'Failed to store uploaded proof securely.'], 500);
            }
        }

        Database::transaction(function (PDO $pdo) use ($ref, $utr, $savedFilename) {
            $stmt = $pdo->prepare('SELECT * FROM bookings WHERE booking_ref = :ref FOR UPDATE');
            $stmt->execute(['ref' => $ref]);
            $booking = $stmt->fetch();
            if (!$booking) {
                throw new \RuntimeException('Booking reference not found.');
            }
            if (in_array($booking['status'], ['CANCELLED', 'EXPIRED'], true)) {
                throw new \RuntimeException('This reservation hold has already expired or been cancelled.');
            }

            $pdo->prepare("UPDATE bookings SET status = 'PENDING_VERIFICATION', upi_utr = :utr, upi_proof_file = COALESCE(:file, upi_proof_file), hold_expires_at = NULL WHERE id = :id")
                ->execute(['utr' => $utr, 'file' => $savedFilename, 'id' => $booking['id']]);

            $pdo->prepare("INSERT INTO payments (booking_id, method, amount, utr_reference, proof_filename, status) VALUES (:bid, 'MANUAL_UPI', :amt, :utr, :file, 'SUBMITTED')")
                ->execute(['bid' => $booking['id'], 'amt' => $booking['total_amount'], 'utr' => $utr, 'file' => $savedFilename]);

            $pdo->prepare("INSERT INTO audit_logs (actor, action, target_ref, details) VALUES (:actor, 'UPI_UTR_SUBMITTED', :ref, :det)")
                ->execute(['actor' => 'GUEST:' . $booking['guest_phone'], 'ref' => $ref, 'det' => "Submitted Manual UPI UTR {$utr}"]);
        });

        $this->cache->invalidatePrefix('avail_');
        Response::json([
            'status' => 'PENDING_VERIFICATION',
            'booking_ref' => $ref,
            'utr_reference' => $utr,
        ]);
    }
}
