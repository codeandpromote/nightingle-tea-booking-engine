<?php
declare(strict_types=1);

namespace App\Core;

use PDO;

final class Auth
{
    public static function startSession(string $sessionName): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

        session_name($sessionName);
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'httponly' => true,
            'secure' => $isHttps,
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    public static function user(): ?array
    {
        return $_SESSION['admin_user'] ?? null;
    }

    public static function requireAdmin(string $basePath): array
    {
        $user = self::user();
        if (!$user) {
            if (str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') || str_contains($_SERVER['REQUEST_URI'] ?? '', '/api/')) {
                Response::json(['error' => 'Unauthorized'], 401);
            }
            Response::redirect($basePath . '/admin/login');
        }
        return $user;
    }

    public static function attempt(PDO $pdo, string $username, string $password): ?array
    {
        $stmt = $pdo->prepare('SELECT id, username, full_name, email, password_hash, role, is_active FROM admin_users WHERE username = :u LIMIT 1');
        $stmt->execute(['u' => trim($username)]);
        $row = $stmt->fetch();

        if (!$row || !(int) $row['is_active']) {
            return null;
        }
        if (!password_verify($password, $row['password_hash'])) {
            return null;
        }

        session_regenerate_id(true);
        $admin = [
            'id' => (int) $row['id'],
            'username' => $row['username'],
            'full_name' => $row['full_name'],
            'email' => $row['email'],
            'role' => $row['role'],
        ];
        $_SESSION['admin_user'] = $admin;

        $pdo->prepare('UPDATE admin_users SET last_login_at = NOW() WHERE id = :id')->execute(['id' => $row['id']]);
        return $admin;
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
    }
}
