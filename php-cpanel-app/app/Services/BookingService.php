<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\CacheService;
use App\Core\Database;
use PDO;
use RuntimeException;

final class BookingService
{
    public function __construct(
        private CacheService $cache,
        private array $config
    ) {}

    public function getAvailabilityRange(string $estateSlug, string $startDate, int $days = 30): array
    {
        $days = max(1, min(60, $days));
        $cacheKey = "avail_{$estateSlug}_{$startDate}_{$days}";

        return $this->cache->remember($cacheKey, (int) $this->config['cache_ttl_seconds'], function () use ($estateSlug, $startDate, $days) {
            $pdo = Database::connection();
            $stmt = $pdo->prepare('SELECT * FROM estates WHERE slug = :slug AND is_active = 1 LIMIT 1');
            $stmt->execute(['slug' => $estateSlug]);
            $estate = $stmt->fetch();
            if (!$estate) {
                throw new RuntimeException('Estate not found.');
            }

            $rmStmt = $pdo->prepare('SELECT * FROM estate_room_types WHERE estate_id = :eid AND is_active = 1 ORDER BY id ASC');
            $rmStmt->execute(['eid' => $estate['id']]);
            $roomTypes = $rmStmt->fetchAll();
            $activeRoomSum = 0;
            foreach ($roomTypes as &$rt) {
                $rt['unit_labels'] = json_decode((string) $rt['unit_labels_json'], true) ?: [];
                $activeRoomSum += (int) $rt['total_units'];
            }
            unset($rt);
            $derivedTotalRooms = $activeRoomSum > 0 ? $activeRoomSum : (int) $estate['total_rooms'];

            $endDate = date('Y-m-d', strtotime("{$startDate} +{$days} days"));

            // Fetch calendar overrides
            $ovStmt = $pdo->prepare('SELECT * FROM inventory_calendar WHERE estate_id = :eid AND stay_date >= :s AND stay_date < :e');
            $ovStmt->execute(['eid' => $estate['id'], 's' => $startDate, 'e' => $endDate]);
            $overrides = [];
            foreach ($ovStmt->fetchAll() as $row) {
                $overrides[$row['stay_date']] = $row;
            }

            // Fetch active allocations (confirmed, checked in, or non-expired holds)
            $allocStmt = $pdo->prepare(
                "SELECT bn.stay_date,
                        SUM(CASE WHEN b.status IN ('CONFIRMED','CHECKED_IN') THEN bn.rooms_allocated ELSE 0 END) AS booked_rooms,
                        SUM(CASE WHEN b.status IN ('AWAITING_PAYMENT','PENDING_VERIFICATION') AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW()) THEN bn.rooms_allocated ELSE 0 END) AS held_rooms
                 FROM booking_nights bn
                 INNER JOIN bookings b ON b.id = bn.booking_id
                 WHERE bn.estate_id = :eid AND bn.stay_date >= :s AND bn.stay_date < :e
                   AND b.status IN ('CONFIRMED','CHECKED_IN','AWAITING_PAYMENT','PENDING_VERIFICATION')
                 GROUP BY bn.stay_date"
            );
            $allocStmt->execute(['eid' => $estate['id'], 's' => $startDate, 'e' => $endDate]);
            $allocs = [];
            foreach ($allocStmt->fetchAll() as $row) {
                $allocs[$row['stay_date']] = $row;
            }

            $calendar = [];
            for ($i = 0; $i < $days; $i++) {
                $date = date('Y-m-d', strtotime("{$startDate} +{$i} days"));
                $ov = $overrides[$date] ?? null;
                $al = $allocs[$date] ?? ['booked_rooms' => 0, 'held_rooms' => 0];
                $totalRooms = ($ov && $ov['custom_total_rooms'] !== null) ? (int) $ov['custom_total_rooms'] : $derivedTotalRooms;
                $isBlocked = $ov ? (bool) $ov['is_blocked'] : false;
                $booked = (int) $al['booked_rooms'];
                $held = (int) $al['held_rooms'];
                $available = $isBlocked ? 0 : max(0, $totalRooms - $booked - $held);

                $calendar[] = [
                    'date' => $date,
                    'total_rooms' => $totalRooms,
                    'booked_rooms' => $booked,
                    'held_rooms' => $held,
                    'available_rooms' => $available,
                    'is_blocked' => $isBlocked,
                    'block_reason' => $ov['block_reason'] ?? null,
                    'min_stay' => $ov ? max(1, (int) $ov['min_stay']) : 1,
                    'map_rate' => ($ov && $ov['map_rate_override'] !== null) ? (int) $ov['map_rate_override'] : (int) $estate['map_base_rate'],
                    'all_meals_rate' => ($ov && $ov['all_meals_rate_override'] !== null) ? (int) $ov['all_meals_rate_override'] : (int) $estate['all_meals_base_rate'],
                ];
            }

            return [
                'estate' => $estate,
                'room_categories' => $roomTypes,
                'calendar' => $calendar,
            ];
        });
    }

    /**
     * MMT-style live availability search across all estates and room categories for a stay range.
     */
    public function searchAvailability(string $checkIn, string $checkOut, int $roomsRequested = 1, ?string $estateSlug = null): array
    {
        $nightDates = TariffService::enumerateNights($checkIn, $checkOut);
        $pdo = Database::connection();

        if ($estateSlug && $estateSlug !== 'ALL') {
            $eStmt = $pdo->prepare('SELECT * FROM estates WHERE is_active = 1 AND slug = :slug ORDER BY id ASC');
            $eStmt->execute(['slug' => $estateSlug]);
        } else {
            $eStmt = $pdo->query('SELECT * FROM estates WHERE is_active = 1 ORDER BY id ASC');
        }
        $estates = $eStmt->fetchAll();

        $placeholders = implode(',', array_fill(0, count($nightDates), '?'));
        $summaries = [];

        foreach ($estates as $estate) {
            $rmStmt = $pdo->prepare('SELECT * FROM estate_room_types WHERE estate_id = :eid AND is_active = 1 ORDER BY id ASC');
            $rmStmt->execute(['eid' => $estate['id']]);
            $roomTypes = $rmStmt->fetchAll();

            $derivedTotal = 0;
            foreach ($roomTypes as $rt) {
                $derivedTotal += (int) $rt['total_units'];
            }
            if ($derivedTotal <= 0) {
                $derivedTotal = (int) $estate['total_rooms'];
            }

            $ovStmt = $pdo->prepare("SELECT * FROM inventory_calendar WHERE estate_id = ? AND stay_date IN ({$placeholders})");
            $ovStmt->execute(array_merge([$estate['id']], $nightDates));
            $overrides = [];
            foreach ($ovStmt->fetchAll() as $row) {
                $overrides[$row['stay_date']] = $row;
            }

            $allocStmt = $pdo->prepare(
                "SELECT bn.stay_date, bn.room_type_id, COALESCE(SUM(bn.rooms_allocated), 0) AS used_rooms
                 FROM booking_nights bn
                 INNER JOIN bookings b ON b.id = bn.booking_id
                 WHERE bn.estate_id = ? AND bn.stay_date IN ({$placeholders})
                   AND (
                     b.status IN ('CONFIRMED','CHECKED_IN')
                     OR (b.status IN ('AWAITING_PAYMENT','PENDING_VERIFICATION') AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW()))
                   )
                 GROUP BY bn.stay_date, bn.room_type_id"
            );
            $allocStmt->execute(array_merge([$estate['id']], $nightDates));

            $estateUsedByDate = [];
            $roomUsedByDate = [];
            foreach ($allocStmt->fetchAll() as $row) {
                $d = $row['stay_date'];
                $used = (int) $row['used_rooms'];
                $estateUsedByDate[$d] = ($estateUsedByDate[$d] ?? 0) + $used;
                if ($row['room_type_id'] !== null) {
                    $rtId = (int) $row['room_type_id'];
                    $roomUsedByDate[$rtId][$d] = ($roomUsedByDate[$rtId][$d] ?? 0) + $used;
                }
            }

            $minEstateAvail = PHP_INT_MAX;
            $hasBlocked = false;
            $blockReason = null;
            $minMapRate = PHP_INT_MAX;
            $minAllMealsRate = PHP_INT_MAX;

            foreach ($nightDates as $d) {
                $ov = $overrides[$d] ?? null;
                if ($ov && (int) $ov['is_blocked'] === 1) {
                    $hasBlocked = true;
                    $blockReason = $blockReason ?: ($ov['block_reason'] ?: 'Blocked for maintenance / private buyout');
                }
                $dayCap = ($ov && $ov['custom_total_rooms'] !== null) ? (int) $ov['custom_total_rooms'] : $derivedTotal;
                $dayAvail = ($ov && (int) $ov['is_blocked'] === 1) ? 0 : max(0, $dayCap - ($estateUsedByDate[$d] ?? 0));
                $minEstateAvail = min($minEstateAvail, $dayAvail);

                $mapRate = ($ov && $ov['map_rate_override'] !== null) ? (int) $ov['map_rate_override'] : (int) $estate['map_base_rate'];
                $allRate = ($ov && $ov['all_meals_rate_override'] !== null) ? (int) $ov['all_meals_rate_override'] : (int) $estate['all_meals_base_rate'];
                $minMapRate = min($minMapRate, $mapRate);
                $minAllMealsRate = min($minAllMealsRate, $allRate);
            }

            if ($minEstateAvail === PHP_INT_MAX) {
                $minEstateAvail = $derivedTotal;
            }

            $roomSummaries = [];
            foreach ($roomTypes as $rt) {
                $rtId = (int) $rt['id'];
                $minCatAvail = (int) $rt['total_units'];
                foreach ($nightDates as $d) {
                    $ov = $overrides[$d] ?? null;
                    if ($ov && (int) $ov['is_blocked'] === 1) {
                        $minCatAvail = 0;
                        break;
                    }
                    $catAvail = max(0, (int) $rt['total_units'] - ($roomUsedByDate[$rtId][$d] ?? 0));
                    $minCatAvail = min($minCatAvail, $catAvail);
                }
                $effectiveCatAvail = min($minCatAvail, $minEstateAvail);
                $roomSummaries[] = [
                    'id' => $rtId,
                    'slug' => $rt['slug'],
                    'name' => $rt['name'],
                    'bed_type' => $rt['bed_type'],
                    'unit_labels' => json_decode((string) $rt['unit_labels_json'], true) ?: [],
                    'total_units' => (int) $rt['total_units'],
                    'available_units' => $effectiveCatAvail,
                    'map_rate' => (int) $rt['map_rate'],
                    'all_meals_rate' => (int) $rt['all_meals_rate'],
                    'can_fulfill' => !$hasBlocked && $effectiveCatAvail >= $roomsRequested,
                ];
            }

            $summaries[$estate['slug']] = [
                'estate_id' => (int) $estate['id'],
                'estate_slug' => $estate['slug'],
                'total_rooms' => $derivedTotal,
                'available_rooms' => $minEstateAvail,
                'is_blocked' => $hasBlocked,
                'block_reason' => $blockReason,
                'can_fulfill' => !$hasBlocked && $minEstateAvail >= $roomsRequested,
                'starting_map_rate' => $minMapRate === PHP_INT_MAX ? (int) $estate['map_base_rate'] : $minMapRate,
                'starting_all_meals_rate' => $minAllMealsRate === PHP_INT_MAX ? (int) $estate['all_meals_base_rate'] : $minAllMealsRate,
                'room_categories' => $roomSummaries,
            ];
        }

        return $summaries;
    }

    /**
     * Pessimistic InnoDB Row-Locked Reservation Creation: Guarantees zero double-bookings under spike load.
     */
    public function createReservation(array $input): array
    {
        $holdTtl = (int) $this->config['hold_ttl_minutes'];
        $paymentMethod = $input['payment_method'] ?? 'MANUAL_UPI';
        if (!in_array($paymentMethod, ['RAZORPAY', 'MANUAL_UPI'], true)) {
            throw new RuntimeException('Unsupported payment method.');
        }

        $result = Database::transaction(function (PDO $pdo) use ($input, $holdTtl, $paymentMethod) {
            // 1. Lock Estate row
            $eStmt = $pdo->prepare('SELECT * FROM estates WHERE slug = :slug AND is_active = 1 FOR UPDATE');
            $eStmt->execute(['slug' => $input['estate_slug']]);
            $estate = $eStmt->fetch();
            if (!$estate) {
                throw new RuntimeException('Selected tea estate is unavailable.');
            }

            // 1b. Optional Room Category lookup & lock
            $roomCategory = null;
            $roomTypeId = !empty($input['room_type_id']) ? (int) $input['room_type_id'] : null;
            $roomTypeSlug = trim((string) ($input['room_type_slug'] ?? ''));

            if ($roomTypeId) {
                $rmStmt = $pdo->prepare('SELECT * FROM estate_room_types WHERE id = :rid AND estate_id = :eid AND is_active = 1 FOR UPDATE');
                $rmStmt->execute(['rid' => $roomTypeId, 'eid' => $estate['id']]);
                $roomCategory = $rmStmt->fetch() ?: null;
                if (!$roomCategory) {
                    throw new RuntimeException('Selected room category is currently unavailable for this estate.');
                }
            } elseif ($roomTypeSlug !== '') {
                $rmStmt = $pdo->prepare('SELECT * FROM estate_room_types WHERE slug = :rslug AND estate_id = :eid AND is_active = 1 FOR UPDATE');
                $rmStmt->execute(['rslug' => $roomTypeSlug, 'eid' => $estate['id']]);
                $roomCategory = $rmStmt->fetch() ?: null;
                if (!$roomCategory) {
                    throw new RuntimeException('Selected room category is currently unavailable for this estate.');
                }
                $roomTypeId = (int) $roomCategory['id'];
            } else {
                $rmStmt = $pdo->prepare('SELECT * FROM estate_room_types WHERE estate_id = :eid AND is_active = 1 ORDER BY id ASC LIMIT 1 FOR UPDATE');
                $rmStmt->execute(['eid' => $estate['id']]);
                $roomCategory = $rmStmt->fetch() ?: null;
                if ($roomCategory) {
                    $roomTypeId = (int) $roomCategory['id'];
                }
            }

            $sumStmt = $pdo->prepare('SELECT COALESCE(SUM(total_units), 0) FROM estate_room_types WHERE estate_id = :eid AND is_active = 1');
            $sumStmt->execute(['eid' => $estate['id']]);
            $activeSum = (int) $sumStmt->fetchColumn();
            $estateBaseTotalRooms = $activeSum > 0 ? $activeSum : (int) $estate['total_rooms'];

            $nightDates = TariffService::enumerateNights($input['check_in'], $input['check_out']);
            sort($nightDates); // Deterministic ascending lock order prevents InnoDB deadlocks

            // 2. Ensure inventory_calendar rows exist for every stay night so FOR UPDATE always locks a concrete row
            $insCal = $pdo->prepare('INSERT IGNORE INTO inventory_calendar (estate_id, stay_date) VALUES (:eid, :d)');
            foreach ($nightDates as $d) {
                $insCal->execute(['eid' => $estate['id'], 'd' => $d]);
            }

            // 3. Lock inventory_calendar rows for the stay range
            $placeholders = implode(',', array_fill(0, count($nightDates), '?'));
            $lockCal = $pdo->prepare("SELECT * FROM inventory_calendar WHERE estate_id = ? AND stay_date IN ({$placeholders}) ORDER BY stay_date ASC FOR UPDATE");
            $lockCal->execute(array_merge([$estate['id']], $nightDates));
            $overridesByDate = [];
            foreach ($lockCal->fetchAll() as $row) {
                $overridesByDate[$row['stay_date']] = $row;
            }

            // 4. Enforce min_stay and blocks
            $checkInOv = $overridesByDate[$input['check_in']] ?? null;
            if ($checkInOv && (int) $checkInOv['min_stay'] > count($nightDates)) {
                throw new RuntimeException("Minimum stay of {$checkInOv['min_stay']} nights is required for {$input['check_in']}.");
            }

            // 5. Check active allocations under lock
            $allocStmt = $pdo->prepare(
                "SELECT bn.stay_date,
                        COALESCE(SUM(bn.rooms_allocated), 0) AS used_rooms,
                        COALESCE(SUM(CASE WHEN bn.room_type_id = ? THEN bn.rooms_allocated ELSE 0 END), 0) AS cat_used_rooms
                 FROM booking_nights bn
                 INNER JOIN bookings b ON b.id = bn.booking_id
                 WHERE bn.estate_id = ? AND bn.stay_date IN ({$placeholders})
                   AND (
                     b.status IN ('CONFIRMED','CHECKED_IN')
                     OR (b.status IN ('AWAITING_PAYMENT','PENDING_VERIFICATION') AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW()))
                   )
                 GROUP BY bn.stay_date"
            );
            $allocStmt->execute(array_merge([$roomTypeId ?: 0, $estate['id']], $nightDates));
            $usedByDate = [];
            $catUsedByDate = [];
            foreach ($allocStmt->fetchAll() as $row) {
                $usedByDate[$row['stay_date']] = (int) $row['used_rooms'];
                $catUsedByDate[$row['stay_date']] = (int) $row['cat_used_rooms'];
            }

            $roomsRequested = (int) $input['rooms_count'];
            foreach ($nightDates as $d) {
                $ov = $overridesByDate[$d] ?? null;
                if ($ov && (int) $ov['is_blocked'] === 1) {
                    $reason = $ov['block_reason'] ?: 'Estate closed on this date';
                    throw new RuntimeException("{$estate['name']} is blocked on {$d} ({$reason}).");
                }
                $totalRooms = ($ov && $ov['custom_total_rooms'] !== null) ? (int) $ov['custom_total_rooms'] : $estateBaseTotalRooms;
                $used = $usedByDate[$d] ?? 0;
                if (($totalRooms - $used) < $roomsRequested) {
                    throw new RuntimeException("Only " . max(0, $totalRooms - $used) . " room(s) available on {$d}.");
                }
                if ($roomCategory) {
                    $catUsed = $catUsedByDate[$d] ?? 0;
                    $catCap = (int) $roomCategory['total_units'];
                    if (($catCap - $catUsed) < $roomsRequested) {
                        throw new RuntimeException("Only " . max(0, $catCap - $catUsed) . " {$roomCategory['name']} unit(s) open on {$d}.");
                    }
                }
            }

            // 6. Compute official GST setting & tariff
            $gstStmt = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'gst_percentage' LIMIT 1");
            $gstPct = (float) ($gstStmt->fetchColumn() ?: 0);

            $tariff = TariffService::calculate(
                $estate,
                $input['check_in'],
                $input['check_out'],
                $roomsRequested,
                (int) $input['adults'],
                (int) $input['children_5_12'],
                (int) $input['children_under_5'],
                $input['meal_plan'],
                $overridesByDate,
                $gstPct,
                $roomCategory
            );

            // 7. Insert Booking with unique NTT-YYYY-XXXX reference
            $refCode = 'NTT-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
            $holdMinutes = $paymentMethod === 'RAZORPAY' ? 15 : $holdTtl;
            $holdExpiresAt = date('Y-m-d H:i:s', time() + ($holdMinutes * 60));

            $roomTypeName = $roomCategory ? $roomCategory['name'] : $estate['accommodation_type'];
            $roomSummary = "{$roomsRequested} × {$roomTypeName}";

            $bStmt = $pdo->prepare(
                'INSERT INTO bookings (
                    booking_ref, estate_id, room_type_id, room_type_name, room_summary,
                    check_in, check_out, nights, rooms_count,
                    adults, children_5_12, children_under_5, meal_plan,
                    guest_name, guest_phone, guest_email, guest_city, id_proof_type, special_requests,
                    base_room_total, extra_adult_total, child_total, gst_amount, total_amount,
                    payment_method, status, hold_expires_at, source_channel
                ) VALUES (
                    :ref, :eid, :rtid, :rtname, :rsummary,
                    :ci, :co, :nights, :rooms,
                    :adults, :c5, :cu5, :plan,
                    :gname, :gphone, :gemail, :gcity, :idtype, :req,
                    :base, :eadult, :ctotal, :gst, :total,
                    :pmethod, :status, :hold, :channel
                )'
            );
            $bStmt->execute([
                'ref' => $refCode,
                'eid' => $estate['id'],
                'rtid' => $roomTypeId,
                'rtname' => $roomTypeName,
                'rsummary' => $roomSummary,
                'ci' => $input['check_in'],
                'co' => $input['check_out'],
                'nights' => $tariff['nights'],
                'rooms' => $roomsRequested,
                'adults' => (int) $input['adults'],
                'c5' => (int) $input['children_5_12'],
                'cu5' => (int) $input['children_under_5'],
                'plan' => $input['meal_plan'],
                'gname' => trim($input['guest_name']),
                'gphone' => trim($input['guest_phone']),
                'gemail' => trim($input['guest_email']),
                'gcity' => trim($input['guest_city'] ?? ''),
                'idtype' => trim($input['id_proof_type'] ?? ''),
                'req' => trim($input['special_requests'] ?? ''),
                'base' => $tariff['base_room_total'],
                'eadult' => $tariff['extra_adult_total'],
                'ctotal' => $tariff['child_total'],
                'gst' => $tariff['gst_amount'],
                'total' => $tariff['total_amount'],
                'pmethod' => $paymentMethod,
                'status' => 'AWAITING_PAYMENT',
                'hold' => $holdExpiresAt,
                'channel' => $input['source_channel'] ?? 'PORTAL',
            ]);
            $bookingId = (int) $pdo->lastInsertId();

            // 8. Insert nightly ledger rows
            $bnStmt = $pdo->prepare('INSERT INTO booking_nights (booking_id, estate_id, room_type_id, stay_date, rooms_allocated, nightly_rate) VALUES (:bid, :eid, :rtid, :d, :r, :rate)');
            foreach ($tariff['nightly_details'] as $n) {
                $bnStmt->execute([
                    'bid' => $bookingId,
                    'eid' => $estate['id'],
                    'rtid' => $roomTypeId,
                    'd' => $n['date'],
                    'r' => $roomsRequested,
                    'rate' => $n['rate_per_room'],
                ]);
            }

            // 9. Record audit log
            $pdo->prepare('INSERT INTO audit_logs (actor, action, target_ref, details, ip_address) VALUES (:actor, :act, :ref, :det, :ip)')
                ->execute([
                    'actor' => 'GUEST:' . trim($input['guest_phone']),
                    'act' => 'BOOKING_CREATED',
                    'ref' => $refCode,
                    'det' => "Created {$paymentMethod} hold for {$estate['name']} · {$roomSummary} ({$input['check_in']} to {$input['check_out']}), INR {$tariff['total_amount']}",
                    'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
                ]);

            return [
                'booking_id' => $bookingId,
                'booking_ref' => $refCode,
                'estate' => $estate,
                'room_category' => $roomCategory,
                'tariff' => $tariff,
                'hold_expires_at' => $holdExpiresAt,
                'payment_method' => $paymentMethod,
            ];
        });

        $this->cache->invalidatePrefix('avail_');
        return $result;
    }

    public function expireStaleHolds(): int
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            "UPDATE bookings
             SET status = 'EXPIRED', updated_at = NOW()
             WHERE status = 'AWAITING_PAYMENT'
               AND hold_expires_at IS NOT NULL
               AND hold_expires_at < NOW()"
        );
        $stmt->execute();
        $count = $stmt->rowCount();
        if ($count > 0) {
            $this->cache->invalidatePrefix('avail_');
        }
        return $count;
    }
}
