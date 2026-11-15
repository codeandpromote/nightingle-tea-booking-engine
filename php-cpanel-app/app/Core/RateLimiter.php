<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Sliding-Window IP Rate Limiter protecting cPanel PHP workers and MySQL connections from flood spikes.
 */
final class RateLimiter
{
    private string $dir;

    public function __construct(string $dir)
    {
        $this->dir = rtrim($dir, '/');
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0750, true);
        }
    }

    public function check(string $bucket, string $ip, int $maxRequests, int $windowSeconds): bool
    {
        $key = hash('sha256', $bucket . '|' . $ip);
        if (function_exists('apcu_inc') && filter_var(ini_get('apc.enabled'), FILTER_VALIDATE_BOOLEAN)) {
            $apcuKey = 'rl_' . $key;
            $count = apcu_fetch($apcuKey, $exists);
            if (!$exists) {
                apcu_store($apcuKey, 1, $windowSeconds);
                return true;
            }
            if ((int) $count >= $maxRequests) {
                return false;
            }
            apcu_inc($apcuKey);
            return true;
        }

        $file = $this->dir . '/' . $key . '.json';
        $now = time();
        $cutoff = $now - $windowSeconds;
        $fh = @fopen($file, 'c+');
        if (!$fh) {
            return true; // Fail open rather than crashing legitimate users if storage is temporarily busy
        }

        $allowed = true;
        if (flock($fh, LOCK_EX)) {
            $content = stream_get_contents($fh);
            $timestamps = $content ? (json_decode($content, true) ?: []) : [];
            $timestamps = array_values(array_filter($timestamps, static fn($ts) => is_int($ts) && $ts > $cutoff));

            if (count($timestamps) >= $maxRequests) {
                $allowed = false;
            } else {
                $timestamps[] = $now;
                ftruncate($fh, 0);
                rewind($fh);
                fwrite($fh, json_encode($timestamps));
            }
            flock($fh, LOCK_UN);
        }
        fclose($fh);
        return $allowed;
    }

    public static function clientIp(): string
    {
        // Support Cloudflare / LiteSpeed / cPanel reverse proxy safely
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'] as $header) {
            if (!empty($_SERVER[$header])) {
                $ip = trim(explode(',', (string) $_SERVER[$header])[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }
        return '0.0.0.0';
    }
}
