<?php
declare(strict_types=1);

namespace App\Services;

use RuntimeException;

/**
 * Pure PHP cURL Razorpay Integration (Zero Composer dependencies - works out of the box on Shared cPanel).
 */
final class RazorpayService
{
    public function __construct(
        private string $keyId,
        private string $keySecret,
        private string $webhookSecret = ''
    ) {}

    public function isConfigured(): bool
    {
        return $this->keyId !== '' && $this->keySecret !== '';
    }

    public function createOrder(int $amountInr, string $bookingRef): array
    {
        if (!$this->isConfigured()) {
            throw new RuntimeException('Razorpay credentials are not configured in .env.');
        }

        $payload = json_encode([
            'amount' => $amountInr * 100, // paise
            'currency' => 'INR',
            'receipt' => $bookingRef,
            'notes' => [
                'booking_ref' => $bookingRef,
                'property' => 'Nightingale Tea Tourism',
            ],
        ]);

        $ch = curl_init('https://api.razorpay.com/v1/orders');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_USERPWD => $this->keyId . ':' . $this->keySecret,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 15,
        ]);

        $resp = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($resp === false || $code >= 400) {
            throw new RuntimeException('Razorpay Order creation failed: ' . ($err ?: $resp));
        }

        $data = json_decode((string) $resp, true);
        if (!is_array($data) || empty($data['id'])) {
            throw new RuntimeException('Invalid response from Razorpay Orders API.');
        }

        return $data;
    }

    public function verifyCheckoutSignature(string $orderId, string $paymentId, string $signature): bool
    {
        if (!$this->isConfigured()) {
            return false;
        }
        $expected = hash_hmac('sha256', $orderId . '|' . $paymentId, $this->keySecret);
        return hash_equals($expected, $signature);
    }

    public function verifyWebhookSignature(string $rawBody, string $headerSignature): bool
    {
        $secret = $this->webhookSecret !== '' ? $this->webhookSecret : $this->keySecret;
        if ($secret === '' || $headerSignature === '') {
            return false;
        }
        $expected = hash_hmac('sha256', $rawBody, $secret);
        return hash_equals($expected, $headerSignature);
    }
}
