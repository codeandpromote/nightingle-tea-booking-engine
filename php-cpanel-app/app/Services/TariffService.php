<?php
declare(strict_types=1);

namespace App\Services;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

final class TariffService
{
    public static function enumerateNights(string $checkIn, string $checkOut): array
    {
        $tz = new DateTimeZone('UTC');
        $start = DateTimeImmutable::createFromFormat('!Y-m-d', $checkIn, $tz);
        $end = DateTimeImmutable::createFromFormat('!Y-m-d', $checkOut, $tz);

        if (!$start || $start->format('Y-m-d') !== $checkIn) {
            throw new InvalidArgumentException('Invalid check-in date format.');
        }
        if (!$end || $end->format('Y-m-d') !== $checkOut) {
            throw new InvalidArgumentException('Invalid check-out date format.');
        }

        $diff = (int) $start->diff($end)->format('%r%a');
        if ($diff <= 0) {
            throw new InvalidArgumentException('Check-out date must be at least 1 night after check-in.');
        }
        if ($diff > 30) {
            throw new InvalidArgumentException('Maximum online booking length is 30 nights.');
        }

        $nights = [];
        for ($i = 0; $i < $diff; $i++) {
            $nights[] = $start->modify("+{$i} days")->format('Y-m-d');
        }
        return $nights;
    }

    public static function calculate(
        array $estate,
        string $checkIn,
        string $checkOut,
        int $roomsCount,
        int $adults,
        int $children5to12,
        int $childrenUnder5,
        string $mealPlan,
        array $overridesByDate = [],
        float $gstPercentage = 0.0,
        ?array $roomCategory = null
    ): array {
        if ($roomsCount < 1) {
            throw new InvalidArgumentException('At least 1 room must be selected.');
        }
        if ($adults < 1) {
            throw new InvalidArgumentException('At least 1 adult guest is required.');
        }
        if (!in_array($mealPlan, ['MAP', 'ALL_MEALS'], true)) {
            throw new InvalidArgumentException('Invalid meal plan selected.');
        }

        $maxAdults = $roomsCount * (int) $estate['max_adults_per_room'];
        $maxChildren = $roomsCount * (int) $estate['max_children_per_room'];
        if ($adults > $maxAdults) {
            throw new InvalidArgumentException("Maximum {$maxAdults} adults permitted for {$roomsCount} room(s).");
        }
        if (($children5to12 + $childrenUnder5) > $maxChildren) {
            throw new InvalidArgumentException("Maximum {$maxChildren} children permitted for {$roomsCount} room(s).");
        }

        $nightDates = self::enumerateNights($checkIn, $checkOut);
        $nights = count($nightDates);

        $defaultMapRate = $roomCategory ? (int) $roomCategory['map_rate'] : (int) $estate['map_base_rate'];
        $defaultAllMealsRate = $roomCategory ? (int) $roomCategory['all_meals_rate'] : (int) $estate['all_meals_base_rate'];

        $nightlyDetails = [];
        $baseRoomTotal = 0;
        foreach ($nightDates as $date) {
            $ov = $overridesByDate[$date] ?? null;
            if ($mealPlan === 'MAP') {
                $ratePerRoom = ($ov && $ov['map_rate_override'] !== null)
                    ? (int) $ov['map_rate_override']
                    : $defaultMapRate;
            } else {
                $ratePerRoom = ($ov && $ov['all_meals_rate_override'] !== null)
                    ? (int) $ov['all_meals_rate_override']
                    : $defaultAllMealsRate;
            }
            $subtotal = $ratePerRoom * $roomsCount;
            $baseRoomTotal += $subtotal;
            $nightlyDetails[] = [
                'date' => $date,
                'rate_per_room' => $ratePerRoom,
                'subtotal' => $subtotal,
            ];
        }

        $includedAdults = $roomsCount * 2;
        $extraAdults = max(0, $adults - $includedAdults);

        $extraAdultRate = $mealPlan === 'MAP'
            ? (int) $estate['extra_adult_map_rate']
            : (int) $estate['extra_adult_all_meals_rate'];
        $extraAdultTotal = $extraAdults * $extraAdultRate * $nights;

        $childRate = $mealPlan === 'MAP'
            ? (int) $estate['child_5_12_map_rate']
            : (int) $estate['child_5_12_all_meals_rate'];
        $childTotal = max(0, $children5to12) * $childRate * $nights;

        $subtotal = $baseRoomTotal + $extraAdultTotal + $childTotal;
        $gstAmount = $gstPercentage > 0 ? (int) round(($subtotal * $gstPercentage) / 100) : 0;
        $totalAmount = $subtotal + $gstAmount;

        return [
            'nights' => $nights,
            'night_dates' => $nightDates,
            'nightly_details' => $nightlyDetails,
            'rooms_count' => $roomsCount,
            'included_adults' => $includedAdults,
            'extra_adults' => $extraAdults,
            'children_5_12' => $children5to12,
            'children_under_5' => $childrenUnder5,
            'meal_plan' => $mealPlan,
            'base_room_total' => $baseRoomTotal,
            'extra_adult_total' => $extraAdultTotal,
            'child_total' => $childTotal,
            'subtotal' => $subtotal,
            'gst_amount' => $gstAmount,
            'total_amount' => $totalAmount,
        ];
    }
}
