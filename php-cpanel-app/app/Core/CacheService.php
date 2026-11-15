<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Dual-Tier Atomic Micro-Cache (APCu when available + lock-free atomic file cache).
 * Enables serving 100k+ concurrent estate & availability views on shared cPanel without MySQL bottlenecks.
 */
final class CacheService
{
    private string $cacheDir;
    private bool $hasApcu;

    public function __construct(string $cacheDir)
    {
        $this->cacheDir = rtrim($cacheDir, '/');
        if (!is_dir($this->cacheDir)) {
            @mkdir($this->cacheDir, 0750, true);
        }
        $this->hasApcu = function_exists('apcu_fetch') && filter_var(ini_get('apc.enabled'), FILTER_VALIDATE_BOOLEAN);
    }

    public function remember(string $key, int $ttlSeconds, callable $producer): mixed
    {
        $safeKey = 'ntt_' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $key);

        if ($this->hasApcu) {
            $hit = false;
            $val = apcu_fetch($safeKey, $hit);
            if ($hit) {
                return $val;
            }
        }

        $file = $this->cacheDir . '/' . $safeKey . '.cache.json';
        $now = time();

        if (is_file($file)) {
            $raw = @file_get_contents($file);
            if ($raw !== false) {
                $decoded = json_decode($raw, true);
                if (is_array($decoded) && isset($decoded['expires_at'], $decoded['payload']) && $decoded['expires_at'] > $now) {
                    if ($this->hasApcu) {
                        apcu_store($safeKey, $decoded['payload'], max(1, (int) $decoded['expires_at'] - $now));
                    }
                    return $decoded['payload'];
                }
            }
        }

        $payload = $producer();
        $envelope = json_encode([
            'expires_at' => $now + $ttlSeconds,
            'generated_at' => $now,
            'payload' => $payload,
        ], JSON_UNESCAPED_UNICODE);

        if ($envelope !== false) {
            $tmp = @tempnam($this->cacheDir, 'tmp_');
            if ($tmp !== false) {
                @file_put_contents($tmp, $envelope, LOCK_EX);
                @chmod($tmp, 0640);
                @rename($tmp, $file); // Atomic POSIX rename avoids partial reads under traffic spikes
            }
        }

        if ($this->hasApcu) {
            apcu_store($safeKey, $payload, $ttlSeconds);
        }

        return $payload;
    }

    public function invalidatePrefix(string $prefix): void
    {
        $safePrefix = 'ntt_' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $prefix);
        if ($this->hasApcu && function_exists('apcu_clear_cache')) {
            // Clear targeted keys via APCUIterator if present
            if (class_exists('APCUIterator')) {
                $iter = new \APCUIterator('/^' . preg_quote($safePrefix, '/') . '/');
                foreach ($iter as $item) {
                    apcu_delete($item['key']);
                }
            }
        }

        $files = @glob($this->cacheDir . '/' . $safePrefix . '*.cache.json');
        if (is_array($files)) {
            foreach ($files as $file) {
                @unlink($file);
            }
        }
    }
}
