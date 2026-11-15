<?php
declare(strict_types=1);

namespace App\Core;

final class Response
{
    public static function json(mixed $data, int $status = 200, array $extraHeaders = []): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        foreach ($extraHeaders as $k => $v) {
            header("$k: $v");
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function cachedJson(mixed $data, int $maxAgeSeconds = 30): never
    {
        $body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $etag = '"' . sha1((string) $body) . '"';
        header('Content-Type: application/json; charset=utf-8');
        header("Cache-Control: public, max-age={$maxAgeSeconds}, stale-while-revalidate=60");
        header("ETag: {$etag}");

        if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim((string) $_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
            http_response_code(304);
            exit;
        }
        echo $body;
        exit;
    }

    public static function view(string $viewPath, array $vars = [], int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: text/html; charset=utf-8');
        extract($vars, EXTR_SKIP);
        require $viewPath;
        exit;
    }

    public static function redirect(string $url): never
    {
        header('Location: ' . $url, true, 302);
        exit;
    }

    public static function escapeCsv(mixed $value): string
    {
        $raw = $value === null ? '' : (string) $value;
        if (preg_match('/^[=+\-@\t\r]/', $raw)) {
            $raw = "'" . $raw;
        }
        return '"' . str_replace('"', '""', $raw) . '"';
    }
}
