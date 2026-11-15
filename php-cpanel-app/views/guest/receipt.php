<?php
declare(strict_types=1);
$base = htmlspecialchars((string) ($config['base_path'] ?? ''), ENT_QUOTES, 'UTF-8');
$pageTitle = $booking ? ('Receipt ' . $booking['booking_ref'] . ' · Nightingale Tea Tourism') : 'Booking Not Found';
ob_start();
?>
<section style="padding:48px 0">
  <div class="container" style="max-width:820px">
    <?php if (!$booking): ?>
      <div class="card">
        <h1 style="margin-top:0">Reservation Not Found</h1>
        <p style="color:var(--text-muted)">Please verify your Booking Reference ID and try again.</p>
        <a href="<?= $base ?>/" class="btn btn-primary">Return to Booking Portal</a>
      </div>
    <?php else: ?>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:24px">
          <div>
            <div style="font-size:0.8rem;color:var(--text-muted)">Official Digital Booking Receipt</div>
            <h1 style="font-size:2rem;margin:4px 0">Nightingale Tea Tourism</h1>
            <div class="tabular" style="font-size:1rem;font-weight:600;color:var(--accent)"><?= htmlspecialchars($booking['booking_ref'], ENT_QUOTES, 'UTF-8') ?></div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;font-size:0.95rem"><?= htmlspecialchars($booking['status'], ENT_QUOTES, 'UTF-8') ?></div>
            <div style="font-size:0.8rem;color:var(--text-muted)"><?= htmlspecialchars($booking['payment_method'], ENT_QUOTES, 'UTF-8') ?></div>
            <button onclick="window.print()" class="btn btn-outline no-print" style="margin-top:10px">Print / Save PDF</button>
          </div>
        </div>

        <div class="table-wrap" style="margin-bottom:20px">
          <table>
            <tbody>
              <tr><th>Estate</th><td><strong><?= htmlspecialchars($booking['estate_name'], ENT_QUOTES, 'UTF-8') ?></strong> (<?= htmlspecialchars($booking['estate_location'], ENT_QUOTES, 'UTF-8') ?>)</td></tr>
              <?php if (!empty($booking['room_summary']) || !empty($booking['room_type_name'])): ?>
                <tr><th>Room Category</th><td><?= htmlspecialchars((string) ($booking['room_summary'] ?: $booking['room_type_name']), ENT_QUOTES, 'UTF-8') ?></td></tr>
              <?php endif; ?>
              <tr><th>Check-in / Check-out</th><td class="tabular"><?= htmlspecialchars($booking['check_in']) ?> to <?= htmlspecialchars($booking['check_out']) ?> (<?= (int) $booking['nights'] ?> nights)</td></tr>
              <tr><th>Guest Details</th><td><?= htmlspecialchars($booking['guest_name']) ?> · <?= htmlspecialchars($booking['guest_phone']) ?> · <?= htmlspecialchars($booking['guest_email']) ?></td></tr>
              <tr><th>Occupancy &amp; Plan</th><td><?= (int) $booking['rooms_count'] ?> Room(s) · <?= (int) $booking['adults'] ?> Adults · <?= (int) $booking['children_5_12'] ?> Child (5-12) · <?= (int) $booking['children_under_5'] ?> Kids (&lt;5 Free) · <?= htmlspecialchars($booking['meal_plan']) ?></td></tr>
              <tr><th>Total Amount</th><td class="tabular"><strong>₹<?= number_format((int) $booking['total_amount']) ?></strong></td></tr>
              <?php if (!empty($booking['upi_utr'])): ?>
                <tr><th>UPI UTR Reference</th><td class="tabular"><?= htmlspecialchars($booking['upi_utr']) ?></td></tr>
              <?php endif; ?>
              <?php if (!empty($booking['razorpay_payment_id'])): ?>
                <tr><th>Razorpay Payment ID</th><td class="tabular"><?= htmlspecialchars($booking['razorpay_payment_id']) ?></td></tr>
              <?php endif; ?>
            </tbody>
          </table>
        </div>
        <p style="font-size:0.82rem;color:var(--text-muted);margin:0">Nearest Station: <?= htmlspecialchars($booking['nearest_station']) ?> · <?= htmlspecialchars($booking['distance_from_airport']) ?>. Present this reference ID upon arrival at the estate bungalow desk.</p>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php
$content = ob_get_clean();
require dirname(__DIR__) . '/layouts/main.php';
