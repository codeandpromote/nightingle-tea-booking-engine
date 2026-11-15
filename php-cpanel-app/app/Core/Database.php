<?php
declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;
use Throwable;

final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $cfg = require dirname(__DIR__, 2) . '/config/database.php';
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $cfg['host'],
            $cfg['port'],
            $cfg['database'],
            $cfg['charset']
        );

        self::$pdo = new PDO($dsn, $cfg['username'], $cfg['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_PERSISTENT => false, // Safer on shared cPanel max_user_connections limits
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '+05:30'",
        ]);

        return self::$pdo;
    }

    /**
     * Executes a transaction with automatic retry on InnoDB deadlock (1213 / 40001).
     */
    public static function transaction(callable $fn, int $maxRetries = 3): mixed
    {
        $pdo = self::connection();
        $attempt = 0;

        while (true) {
            $attempt++;
            try {
                if (!$pdo->inTransaction()) {
                    $pdo->beginTransaction();
                }
                $result = $fn($pdo);
                if ($pdo->inTransaction()) {
                    $pdo->commit();
                }
                return $result;
            } catch (PDOException $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                $sqlState = $e->getCode();
                $isDeadlock = $sqlState === '40001' || str_contains($e->getMessage(), '1213');
                if ($isDeadlock && $attempt < $maxRetries) {
                    usleep(random_int(15000, 65000));
                    continue;
                }
                throw $e;
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }
    }
}
