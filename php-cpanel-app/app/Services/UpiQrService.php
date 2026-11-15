<?php
declare(strict_types=1);

namespace App\Services;

final class UpiQrService
{
    public static function buildUpiUri(string $vpa, string $merchantName, float $amountInr, string $bookingRef): string
    {
        return sprintf(
            'upi://pay?pa=%s&pn=%s&am=%s&cu=INR&tn=%s',
            rawurlencode(trim($vpa)),
            rawurlencode(trim($merchantName)),
            number_format($amountInr, 2, '.', ''),
            rawurlencode('Nightingale Tea ' . $bookingRef)
        );
    }
}
