<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\CacheService;
use App\Core\Csrf;
use App\Core\Database;
use App\Core\Response;
use App\Services\BookingService;
use App\Services\TariffService;
use Throwable;

final class HomeController
{
    public function __construct(
        private CacheService $cache,
        private BookingService $bookingService,
        private array $config
    ) {}

    public function index(): never
    {
        $estates = $this->getCachedEstates();
        $settings = $this->getCachedSettings();
        $selectedEstate = $_GET['estate'] ?? ($estates[0]['slug'] ?? 'mateli');
        $defaultCheckIn = date('Y-m-d', strtotime('+1 day'));
        $defaultCheckOut = date('Y-m-d', strtotime('+2 days'));
        $searchSummaries = $this->bookingService->searchAvailability($defaultCheckIn, $defaultCheckOut, 1, null);

        Response::view($this->config['paths']['views'] . '/guest/home.php', [
            'config' => $this->config,
            'estates' => $estates,
            'settings' => $settings,
            'selectedEstate' => $selectedEstate,
            'searchSummaries' => $searchSummaries,
            'csrfToken' => Csrf::token(),
        ]);
    }

    public function apiEstates(): never
    {
        $estates = $this->getCachedEstates();
        $checkIn = trim((string) ($_GET['check_in'] ?? ''));
        $checkOut = trim((string) ($_GET['check_out'] ?? ''));
        $rooms = max(1, (int) ($_GET['rooms'] ?? 1));

        $payload = ['estates' => $estates];
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $checkIn) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $checkOut)) {
            $payload['search_summaries'] = $this->bookingService->searchAvailability($checkIn, $checkOut, $rooms, null);
        }
        Response::cachedJson($payload, (int) $this->config['cache_ttl_seconds']);
    }

    public function apiSearch(): never
    {
        $checkIn = trim((string) ($_GET['check_in'] ?? date('Y-m-d', strtotime('+1 day'))));
        $checkOut = trim((string) ($_GET['check_out'] ?? date('Y-m-d', strtotime('+2 days'))));
        $rooms = max(1, (int) ($_GET['rooms'] ?? 1));
        $estate = trim((string) ($_GET['estate'] ?? 'ALL'));

        try {
            $summaries = $this->bookingService->searchAvailability($checkIn, $checkOut, $rooms, $estate);
            Response::json(['search_summaries' => $summaries]);
        } catch (Throwable $e) {
            Response::json(['error' => $e->getMessage()], 422);
        }
    }

    public function apiAvailability(): never
    {
        $slug = trim((string) ($_GET['estate'] ?? 'mateli'));
        $start = trim((string) ($_GET['start'] ?? date('Y-m-d')));
        $days = (int) ($_GET['days'] ?? 30);

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start)) {
            Response::json(['error' => 'Invalid start date format.'], 422);
        }

        try {
            $data = $this->bookingService->getAvailabilityRange($slug, $start, $days);
            Response::cachedJson($data, (int) $this->config['cache_ttl_seconds']);
        } catch (Throwable $e) {
            Response::json(['error' => $e->getMessage()], 404);
        }
    }

    public function apiQuote(): never
    {
        $slug = trim((string) ($_GET['estate'] ?? 'mateli'));
        $checkIn = trim((string) ($_GET['check_in'] ?? ''));
        $checkOut = trim((string) ($_GET['check_out'] ?? ''));
        $rooms = max(1, (int) ($_GET['rooms'] ?? 1));
        $adults = max(1, (int) ($_GET['adults'] ?? 2));
        $c5 = max(0, (int) ($_GET['children_5_12'] ?? 0));
        $cu5 = max(0, (int) ($_GET['children_under_5'] ?? 0));
        $plan = trim((string) ($_GET['meal_plan'] ?? 'MAP'));
        $roomTypeId = (int) ($_GET['room_type_id'] ?? 0);

        try {
            $estates = $this->getCachedEstates();
            $estate = null;
            foreach ($estates as $e) {
                if ($e['slug'] === $slug) {
                    $estate = $e;
                    break;
                }
            }
            if (!$estate) {
                Response::json(['error' => 'Estate not found.'], 404);
            }

            $roomCategory = null;
            if ($roomTypeId > 0 && !empty($estate['room_categories'])) {
                foreach ($estate['room_categories'] as $rc) {
                    if ((int) $rc['id'] === $roomTypeId) {
                        $roomCategory = $rc;
                        break;
                    }
                }
            } elseif (!empty($estate['room_categories'])) {
                $roomCategory = $estate['room_categories'][0];
            }

            $avail = $this->bookingService->getAvailabilityRange($slug, $checkIn, 31);
            $overrides = [];
            foreach ($avail['calendar'] as $day) {
                $overrides[$day['date']] = [
                    'map_rate_override' => $day['map_rate'] !== (int) $estate['map_base_rate'] ? $day['map_rate'] : null,
                    'all_meals_rate_override' => $day['all_meals_rate'] !== (int) $estate['all_meals_base_rate'] ? $day['all_meals_rate'] : null,
                ];
            }
            $settings = $this->getCachedSettings();
            $gstPct = (float) ($settings['gst_percentage'] ?? 0);

            $tariff = TariffService::calculate($estate, $checkIn, $checkOut, $rooms, $adults, $c5, $cu5, $plan, $overrides, $gstPct, $roomCategory);
            Response::json(['tariff' => $tariff, 'room_category' => $roomCategory]);
        } catch (Throwable $e) {
            Response::json(['error' => $e->getMessage()], 422);
        }
    }

    public function receiptPage(array $params): never
    {
        $ref = strtoupper(trim((string) ($params['ref'] ?? '')));
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT b.*, e.name AS estate_name, e.location AS estate_location, e.nearest_station, e.distance_from_airport
             FROM bookings b
             INNER JOIN estates e ON e.id = b.estate_id
             WHERE b.booking_ref = :ref LIMIT 1'
        );
        $stmt->execute(['ref' => $ref]);
        $booking = $stmt->fetch();
        if (!$booking) {
            Response::view($this->config['paths']['views'] . '/guest/receipt.php', [
                'config' => $this->config,
                'booking' => null,
                'settings' => $this->getCachedSettings(),
            ], 404);
        }

        Response::view($this->config['paths']['views'] . '/guest/receipt.php', [
            'config' => $this->config,
            'booking' => $booking,
            'settings' => $this->getCachedSettings(),
        ]);
    }

    public function apiLookupBooking(): never
    {
        $ref = strtoupper(trim((string) ($_GET['ref'] ?? '')));
        $contact = trim((string) ($_GET['contact'] ?? ''));

        if ($ref === '' || $contact === '') {
            Response::json(['error' => 'Booking Reference ID and Phone/Email are required.'], 422);
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT b.*, e.name AS estate_name, e.location AS estate_location
             FROM bookings b
             INNER JOIN estates e ON e.id = b.estate_id
             WHERE b.booking_ref = :ref
               AND (b.guest_phone = :c1 OR LOWER(b.guest_email) = LOWER(:c2))
             LIMIT 1'
        );
        $stmt->execute(['ref' => $ref, 'c1' => $contact, 'c2' => $contact]);
        $booking = $stmt->fetch();
        if (!$booking) {
            Response::json(['error' => 'No reservation found matching that Reference ID and contact details.'], 404);
        }

        Response::json(['booking' => $booking]);
    }

    private function getCachedEstates(): array
    {
        return $this->cache->remember('estates_active', 120, static function () {
            $pdo = Database::connection();
            $rows = $pdo->query('SELECT * FROM estates WHERE is_active = 1 ORDER BY id ASC')->fetchAll();
            $roomRows = $pdo->query('SELECT * FROM estate_room_types WHERE is_active = 1 ORDER BY id ASC')->fetchAll();
            $byEstate = [];
            foreach ($roomRows as $rt) {
                $rt['unit_labels'] = json_decode((string) $rt['unit_labels_json'], true) ?: [];
                $byEstate[(int) $rt['estate_id']][] = $rt;
            }
            foreach ($rows as &$r) {
                $r['amenities'] = json_decode((string) $r['amenities_json'], true) ?: [];
                $r['nearby'] = json_decode((string) $r['nearby_json'], true) ?: [];
                $r['room_categories'] = $byEstate[(int) $r['id']] ?? [];
                if (!empty($r['room_categories'])) {
                    $r['total_rooms'] = array_sum(array_map(static fn($c) => (int) $c['total_units'], $r['room_categories']));
                }
            }
            return $rows;
        });
    }

    private function getCachedSettings(): array
    {
        return $this->cache->remember('settings_all', 120, static function () {
            $pdo = Database::connection();
            $rows = $pdo->query('SELECT setting_key, setting_value FROM settings')->fetchAll();
            $out = [];
            foreach ($rows as $row) {
                $out[$row['setting_key']] = $row['setting_value'];
            }
            return $out;
        });
    }
}
