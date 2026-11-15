<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\CacheService;
use App\Core\Csrf;
use App\Core\Database;
use App\Core\RateLimiter;
use App\Core\Response;
use App\Services\BookingService;
use PDO;

final class AdminController
{
    public function __construct(
        private BookingService $bookingService,
        private CacheService $cache,
        private RateLimiter $limiter,
        private array $config
    ) {}

    public function loginPage(): never
    {
        if (Auth::user()) {
            Response::redirect($this->config['base_path'] . '/admin');
        }
        Response::view($this->config['paths']['views'] . '/admin/login.php', [
            'config' => $this->config,
            'csrfToken' => Csrf::token(),
            'error' => null,
        ]);
    }

    public function loginSubmit(): never
    {
        $ip = RateLimiter::clientIp();
        if (!$this->limiter->check('admin_login', $ip, $this->config['rate_limits']['admin_login_per_5min'], 300)) {
            Response::view($this->config['paths']['views'] . '/admin/login.php', [
                'config' => $this->config,
                'csrfToken' => Csrf::token(),
                'error' => 'Too many failed login attempts. Try again in 5 minutes.',
            ], 429);
        }

        if (!Csrf::verify($_POST['_csrf'] ?? null)) {
            Response::view($this->config['paths']['views'] . '/admin/login.php', [
                'config' => $this->config,
                'csrfToken' => Csrf::token(),
                'error' => 'Session expired. Please reload and try again.',
            ], 403);
        }

        $pdo = Database::connection();
        $admin = Auth::attempt($pdo, (string) ($_POST['username'] ?? ''), (string) ($_POST['password'] ?? ''));
        if (!$admin) {
            Response::view($this->config['paths']['views'] . '/admin/login.php', [
                'config' => $this->config,
                'csrfToken' => Csrf::token(),
                'error' => 'Invalid username or password.',
            ], 401);
        }

        Response::redirect($this->config['base_path'] . '/admin');
    }

    public function logout(): never
    {
        Auth::logout();
        Response::redirect($this->config['base_path'] . '/admin/login');
    }

    public function dashboard(): never
    {
        $admin = Auth::requireAdmin($this->config['base_path']);
        $pdo = Database::connection();
        $today = date('Y-m-d');
        $monthStart = date('Y-m-01');
        $monthEnd = date('Y-m-t');

        $kpis = [
            'checkins_today' => (int) $pdo->query("SELECT COUNT(*) FROM bookings WHERE check_in = '{$today}' AND status IN ('CONFIRMED','CHECKED_IN')")->fetchColumn(),
            'checkouts_today' => (int) $pdo->query("SELECT COUNT(*) FROM bookings WHERE check_out = '{$today}' AND status IN ('CONFIRMED','CHECKED_IN')")->fetchColumn(),
            'pending_verifications' => (int) $pdo->query("SELECT COUNT(*) FROM bookings WHERE status = 'PENDING_VERIFICATION'")->fetchColumn(),
            'confirmed_revenue' => (int) $pdo->query("SELECT COALESCE(SUM(total_amount),0) FROM bookings WHERE status IN ('CONFIRMED','CHECKED_IN')")->fetchColumn(),
        ];

        $totalRoomCap = (int) $pdo->query('SELECT COALESCE(SUM(total_rooms),0) FROM estates WHERE is_active = 1')->fetchColumn();
        $daysInMonth = (int) date('t');
        $bookedNights = (int) $pdo->query(
            "SELECT COALESCE(SUM(bn.rooms_allocated),0)
             FROM booking_nights bn
             INNER JOIN bookings b ON b.id = bn.booking_id
             WHERE bn.stay_date BETWEEN '{$monthStart}' AND '{$monthEnd}' AND b.status IN ('CONFIRMED','CHECKED_IN')"
        )->fetchColumn();
        $kpis['monthly_occupancy_pct'] = ($totalRoomCap * $daysInMonth) > 0
            ? round(($bookedNights / ($totalRoomCap * $daysInMonth)) * 100, 1)
            : 0;

        $estates = $pdo->query('SELECT * FROM estates ORDER BY id ASC')->fetchAll();
        $roomTypesRaw = $pdo->query('SELECT * FROM estate_room_types ORDER BY estate_id ASC, id ASC')->fetchAll();
        $roomsByEstate = [];
        foreach ($roomTypesRaw as $rt) {
            $rt['unit_labels'] = json_decode((string) $rt['unit_labels_json'], true) ?: [];
            $roomsByEstate[(int) $rt['estate_id']][] = $rt;
        }
        foreach ($estates as &$est) {
            $est['room_categories'] = $roomsByEstate[(int) $est['id']] ?? [];
        }
        unset($est);

        $bookings = $pdo->query(
            'SELECT b.*, e.name AS estate_name
             FROM bookings b
             INNER JOIN estates e ON e.id = b.estate_id
             ORDER BY b.created_at DESC LIMIT 200'
        )->fetchAll();
        $settings = $pdo->query('SELECT setting_key, setting_value FROM settings')->fetchAll(PDO::FETCH_KEY_PAIR);
        $audits = $pdo->query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 40')->fetchAll();

        Response::view($this->config['paths']['views'] . '/admin/dashboard.php', [
            'config' => $this->config,
            'admin' => $admin,
            'kpis' => $kpis,
            'estates' => $estates,
            'bookings' => $bookings,
            'settings' => $settings,
            'audits' => $audits,
            'csrfToken' => Csrf::token(),
        ]);
    }

    public function updateRoomCategory(): never
    {
        $admin = Auth::requireAdmin($this->config['base_path']);
        $body = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        if (!Csrf::verify($body['_csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null))) {
            Response::json(['error' => 'Invalid CSRF token'], 403);
        }

        $roomId = (int) ($body['room_type_id'] ?? 0);
        $estateId = (int) ($body['estate_id'] ?? 0);
        $name = trim((string) ($body['name'] ?? ''));
        $bedType = trim((string) ($body['bed_type'] ?? ''));
        $totalUnits = max(0, min(50, (int) ($body['total_units'] ?? 1)));
        $mapRate = max(1000, (int) ($body['map_rate'] ?? 10000));
        $allMealsRate = max(1000, (int) ($body['all_meals_rate'] ?? 12000));
        $isActive = !empty($body['is_active']) ? 1 : 0;
        $labelsRaw = trim((string) ($body['unit_labels'] ?? ''));
        $labels = array_values(array_filter(array_map('trim', explode(',', $labelsRaw))));

        if ($roomId <= 0 || $estateId <= 0 || $name === '') {
            Response::json(['error' => 'Valid estate, room category ID, and name are required.'], 422);
        }

        $newEstateTotal = Database::transaction(function (PDO $pdo) use ($roomId, $estateId, $name, $bedType, $totalUnits, $mapRate, $allMealsRate, $isActive, $labels, $admin) {
            $stmt = $pdo->prepare(
                'UPDATE estate_room_types
                 SET name = :name, bed_type = :bed, unit_labels_json = :labels,
                     total_units = :units, map_rate = :map, all_meals_rate = :allm, is_active = :act
                 WHERE id = :id AND estate_id = :eid'
            );
            $stmt->execute([
                'name' => $name,
                'bed' => $bedType,
                'labels' => json_encode($labels),
                'units' => $totalUnits,
                'map' => $mapRate,
                'allm' => $allMealsRate,
                'act' => $isActive,
                'id' => $roomId,
                'eid' => $estateId,
            ]);

            $sumStmt = $pdo->prepare('SELECT COALESCE(SUM(total_units), 0) FROM estate_room_types WHERE estate_id = :eid AND is_active = 1');
            $sumStmt->execute(['eid' => $estateId]);
            $totalRooms = (int) $sumStmt->fetchColumn();

            $pdo->prepare('UPDATE estates SET total_rooms = :tr WHERE id = :eid')
                ->execute(['tr' => $totalRooms, 'eid' => $estateId]);

            $pdo->prepare('INSERT INTO audit_logs (actor, action, target_ref, details) VALUES (:actor, :act, :ref, :det)')
                ->execute([
                    'actor' => 'ADMIN:' . $admin['username'],
                    'act' => 'ROOM_INVENTORY_UPDATED',
                    'ref' => "EST-{$estateId}-RM-{$roomId}",
                    'det' => "Updated {$name} -> {$totalUnits} units (MAP INR {$mapRate} / All Meals INR {$allMealsRate}); Estate total: {$totalRooms}",
                ]);

            return $totalRooms;
        });

        $this->cache->invalidatePrefix('estates_');
        $this->cache->invalidatePrefix('avail_');
        Response::json(['saved' => true, 'estate_total_rooms' => $newEstateTotal]);
    }

    public function addRoomCategory(): never
    {
        $admin = Auth::requireAdmin($this->config['base_path']);
        $body = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        if (!Csrf::verify($body['_csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null))) {
            Response::json(['error' => 'Invalid CSRF token'], 403);
        }

        $estateId = (int) ($body['estate_id'] ?? 0);
        $name = trim((string) ($body['name'] ?? ''));
        $bedType = trim((string) ($body['bed_type'] ?? 'King Bed · Garden View'));
        $totalUnits = max(1, min(30, (int) ($body['total_units'] ?? 1)));
        $mapRate = max(1000, (int) ($body['map_rate'] ?? 10000));
        $allMealsRate = max(1000, (int) ($body['all_meals_rate'] ?? 12000));
        $labelsRaw = trim((string) ($body['unit_labels'] ?? ''));
        $labels = array_values(array_filter(array_map('trim', explode(',', $labelsRaw))));

        if ($estateId <= 0 || $name === '') {
            Response::json(['error' => 'Estate and room category name are required.'], 422);
        }

        $slug = 'rm-' . strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name)) . '-' . substr(bin2hex(random_bytes(2)), 0, 4);

        $newEstateTotal = Database::transaction(function (PDO $pdo) use ($estateId, $slug, $name, $bedType, $labels, $totalUnits, $mapRate, $allMealsRate, $admin) {
            $pdo->prepare(
                'INSERT INTO estate_room_types (estate_id, slug, name, bed_type, unit_labels_json, total_units, map_rate, all_meals_rate, is_active)
                 VALUES (:eid, :slug, :name, :bed, :labels, :units, :map, :allm, 1)'
            )->execute([
                'eid' => $estateId,
                'slug' => $slug,
                'name' => $name,
                'bed' => $bedType,
                'labels' => json_encode($labels),
                'units' => $totalUnits,
                'map' => $mapRate,
                'allm' => $allMealsRate,
            ]);

            $sumStmt = $pdo->prepare('SELECT COALESCE(SUM(total_units), 0) FROM estate_room_types WHERE estate_id = :eid AND is_active = 1');
            $sumStmt->execute(['eid' => $estateId]);
            $totalRooms = (int) $sumStmt->fetchColumn();

            $pdo->prepare('UPDATE estates SET total_rooms = :tr WHERE id = :eid')
                ->execute(['tr' => $totalRooms, 'eid' => $estateId]);

            $pdo->prepare('INSERT INTO audit_logs (actor, action, target_ref, details) VALUES (:actor, :act, :ref, :det)')
                ->execute([
                    'actor' => 'ADMIN:' . $admin['username'],
                    'act' => 'ROOM_CATEGORY_ADDED',
                    'ref' => $slug,
                    'det' => "Added room category {$name} ({$totalUnits} units); Estate total: {$totalRooms}",
                ]);

            return $totalRooms;
        });

        $this->cache->invalidatePrefix('estates_');
        $this->cache->invalidatePrefix('avail_');
        Response::json(['saved' => true, 'estate_total_rooms' => $newEstateTotal]);
    }

    public function updateBookingStatus(): never
    {
        $admin = Auth::requireAdmin($this->config['base_path']);
        $body = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        if (!Csrf::verify($body['_csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null))) {
            Response::json(['error' => 'Invalid CSRF token'], 403);
        }

        $ref = strtoupper(trim((string) ($body['booking_ref'] ?? '')));
        $action = trim((string) ($body['action'] ?? ''));
        $notes = trim((string) ($body['admin_notes'] ?? ''));

        $allowedActions = [
            'APPROVE_UPI' => 'CONFIRMED',
            'MARK_CHECKED_IN' => 'CHECKED_IN',
            'REJECT_CANCEL' => 'CANCELLED',
        ];
        if (!isset($allowedActions[$action])) {
            Response::json(['error' => 'Invalid booking action.'], 422);
        }
        $nextStatus = $allowedActions[$action];

        Database::transaction(function (PDO $pdo) use ($ref, $nextStatus, $action, $notes, $admin) {
            $stmt = $pdo->prepare('SELECT * FROM bookings WHERE booking_ref = :ref FOR UPDATE');
            $stmt->execute(['ref' => $ref]);
            $booking = $stmt->fetch();
            if (!$booking) {
                throw new \RuntimeException('Booking not found.');
            }

            $pdo->prepare('UPDATE bookings SET status = :st, hold_expires_at = NULL, admin_notes = COALESCE(NULLIF(:notes, ""), admin_notes) WHERE id = :id')
                ->execute(['st' => $nextStatus, 'notes' => $notes, 'id' => $booking['id']]);

            if ($action === 'APPROVE_UPI') {
                $pdo->prepare("UPDATE payments SET status = 'VERIFIED', verified_by = :by, verified_at = NOW() WHERE booking_id = :bid AND status = 'SUBMITTED'")
                    ->execute(['by' => $admin['username'], 'bid' => $booking['id']]);
            }

            $pdo->prepare('INSERT INTO audit_logs (actor, action, target_ref, details) VALUES (:actor, :act, :ref, :det)')
                ->execute([
                    'actor' => 'ADMIN:' . $admin['username'],
                    'act' => $action,
                    'ref' => $ref,
                    'det' => "Changed status to {$nextStatus}" . ($notes ? " ({$notes})" : ''),
                ]);
        });

        $this->cache->invalidatePrefix('avail_');
        Response::json(['status' => $nextStatus, 'booking_ref' => $ref]);
    }

    public function updateInventoryOverride(): never
    {
        $admin = Auth::requireAdmin($this->config['base_path']);
        $body = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        if (!Csrf::verify($body['_csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null))) {
            Response::json(['error' => 'Invalid CSRF token'], 403);
        }

        $estateId = (int) ($body['estate_id'] ?? 0);
        $date = trim((string) ($body['stay_date'] ?? ''));
        if ($estateId <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            Response::json(['error' => 'Invalid estate or date.'], 422);
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'INSERT INTO inventory_calendar (estate_id, stay_date, is_blocked, block_reason, custom_total_rooms, min_stay, map_rate_override, all_meals_rate_override, updated_by)
             VALUES (:eid, :d, :blk, :reason, :rooms, :min, :map, :allm, :by)
             ON DUPLICATE KEY UPDATE
               is_blocked = VALUES(is_blocked),
               block_reason = VALUES(block_reason),
               custom_total_rooms = VALUES(custom_total_rooms),
               min_stay = VALUES(min_stay),
               map_rate_override = VALUES(map_rate_override),
               all_meals_rate_override = VALUES(all_meals_rate_override),
               updated_by = VALUES(updated_by)'
        );
        $stmt->execute([
            'eid' => $estateId,
            'd' => $date,
            'blk' => !empty($body['is_blocked']) ? 1 : 0,
            'reason' => trim((string) ($body['block_reason'] ?? '')) ?: null,
            'rooms' => isset($body['custom_total_rooms']) && $body['custom_total_rooms'] !== '' ? (int) $body['custom_total_rooms'] : null,
            'min' => max(1, (int) ($body['min_stay'] ?? 1)),
            'map' => isset($body['map_rate_override']) && $body['map_rate_override'] !== '' ? (int) $body['map_rate_override'] : null,
            'allm' => isset($body['all_meals_rate_override']) && $body['all_meals_rate_override'] !== '' ? (int) $body['all_meals_rate_override'] : null,
            'by' => $admin['username'],
        ]);

        $this->cache->invalidatePrefix('avail_');
        Response::json(['saved' => true, 'stay_date' => $date]);
    }

    public function exportCsv(): never
    {
        Auth::requireAdmin($this->config['base_path']);
        $pdo = Database::connection();
        $rows = $pdo->query(
            'SELECT b.booking_ref, e.name AS estate_name, b.check_in, b.check_out, b.nights, b.rooms_count,
                    b.adults, b.children_5_12, b.children_under_5, b.meal_plan, b.guest_name, b.guest_phone,
                    b.guest_email, b.guest_city, b.id_proof_type, b.payment_method, b.status,
                    b.upi_utr, b.razorpay_payment_id, b.total_amount, b.created_at
             FROM bookings b
             INNER JOIN estates e ON e.id = b.estate_id
             ORDER BY b.check_in DESC'
        )->fetchAll();

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="nightingale-guest-manifest-' . date('Ymd') . '.csv"');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['Booking Ref', 'Estate', 'Check In', 'Check Out', 'Nights', 'Rooms', 'Adults', 'Child 5-12', 'Child <5', 'Plan', 'Guest Name', 'Phone', 'Email', 'City', 'ID Proof', 'Payment Mode', 'Status', 'UPI UTR', 'Razorpay ID', 'Total INR', 'Created At']);

        foreach ($rows as $row) {
            $safe = array_map(static fn($v) => preg_match('/^[=+\-@\t\r]/', (string) $v) ? "'" . $v : $v, array_values($row));
            fputcsv($out, $safe);
        }
        fclose($out);
        exit;
    }

    public function viewProof(array $params): never
    {
        Auth::requireAdmin($this->config['base_path']);
        $filename = basename((string) ($params['file'] ?? ''));
        $fullPath = $this->config['paths']['uploads'] . '/' . $filename;

        if ($filename === '' || !is_file($fullPath)) {
            Response::json(['error' => 'Proof file not found.'], 404);
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($fullPath) ?: 'application/octet-stream';
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($fullPath));
        header('X-Content-Type-Options: nosniff');
        readfile($fullPath);
        exit;
    }
}
