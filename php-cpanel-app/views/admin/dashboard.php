<?php
declare(strict_types=1);
$base = htmlspecialchars((string) ($config['base_path'] ?? ''), ENT_QUOTES, 'UTF-8');
$pageTitle = 'Admin Management Console · Nightingale Tea Tourism';
ob_start();
?>
<section style="padding:36px 0">
  <div class="container">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:24px">
      <div>
        <div style="font-size:0.8rem;color:var(--text-muted)">Signed in as <?= htmlspecialchars($admin['full_name']) ?> (<?= htmlspecialchars($admin['role']) ?>)</div>
        <h1 style="font-size:2rem;margin:4px 0 0">Operations &amp; Booking Console</h1>
      </div>
      <div style="display:flex;gap:10px">
        <a href="<?= $base ?>/admin/export/csv" class="btn btn-outline">Export Guest CSV</a>
        <button onclick="window.print()" class="btn btn-outline">Print PDF Report</button>
        <form method="POST" action="<?= $base ?>/admin/logout" style="margin:0">
          <button type="submit" class="btn btn-primary">Sign Out</button>
        </form>
      </div>
    </div>

    <div class="grid-4" style="margin-bottom:28px">
      <div class="card"><div class="label">Check-ins Today</div><div class="tabular" style="font-size:1.75rem;font-weight:700"><?= (int) $kpis['checkins_today'] ?></div></div>
      <div class="card"><div class="label">Check-outs Today</div><div class="tabular" style="font-size:1.75rem;font-weight:700"><?= (int) $kpis['checkouts_today'] ?></div></div>
      <div class="card"><div class="label">Pending UPI Verifications</div><div class="tabular" style="font-size:1.75rem;font-weight:700;color:var(--amber)"><?= (int) $kpis['pending_verifications'] ?></div></div>
      <div class="card"><div class="label">Monthly Occupancy / Revenue</div><div class="tabular" style="font-size:1.35rem;font-weight:700;color:var(--accent)"><?= $kpis['monthly_occupancy_pct'] ?>% · ₹<?= number_format((int) $kpis['confirmed_revenue']) ?></div></div>
    </div>

    <div class="card" style="margin-bottom:28px">
      <h2 style="font-size:1.5rem;margin:0 0 16px">Reservation &amp; Payment Verification Queue</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ref ID</th><th>Guest</th><th>Estate &amp; Stay</th><th>Payment</th><th>Amount</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($bookings as $b): ?>
              <tr>
                <td class="tabular"><strong><?= htmlspecialchars($b['booking_ref']) ?></strong></td>
                <td><?= htmlspecialchars($b['guest_name']) ?><br><span style="font-size:12px;color:var(--text-muted)"><?= htmlspecialchars($b['guest_phone']) ?></span></td>
                <td><?= htmlspecialchars($b['estate_name']) ?><?php if (!empty($b['room_summary'])): ?><br><span style="font-size:12px;color:var(--accent);font-weight:600"><?= htmlspecialchars($b['room_summary']) ?></span><?php endif; ?><br><span class="tabular" style="font-size:12px;color:var(--text-muted)"><?= htmlspecialchars($b['check_in']) ?> → <?= htmlspecialchars($b['check_out']) ?> (<?= (int) $b['rooms_count'] ?> rm)</span></td>
                <td>
                  <?= htmlspecialchars($b['payment_method']) ?>
                  <?php if (!empty($b['upi_utr'])): ?><br><span class="tabular" style="font-size:12px">UTR: <?= htmlspecialchars($b['upi_utr']) ?></span><?php endif; ?>
                  <?php if (!empty($b['upi_proof_file'])): ?><br><a href="<?= $base ?>/admin/proof/<?= urlencode($b['upi_proof_file']) ?>" target="_blank" style="font-size:12px;color:var(--accent)">View Proof</a><?php endif; ?>
                </td>
                <td class="tabular"><strong>₹<?= number_format((int) $b['total_amount']) ?></strong></td>
                <td><?= htmlspecialchars($b['status']) ?></td>
                <td style="white-space:nowrap">
                  <?php if ($b['status'] === 'PENDING_VERIFICATION' || $b['status'] === 'AWAITING_PAYMENT'): ?>
                    <button class="btn btn-primary" style="padding:6px 10px;font-size:12px" onclick="nttAdminAction('<?= htmlspecialchars($b['booking_ref']) ?>','APPROVE_UPI')">Approve</button>
                  <?php endif; ?>
                  <?php if ($b['status'] === 'CONFIRMED'): ?>
                    <button class="btn btn-outline" style="padding:6px 10px;font-size:12px" onclick="nttAdminAction('<?= htmlspecialchars($b['booking_ref']) ?>','MARK_CHECKED_IN')">Check In</button>
                  <?php endif; ?>
                  <?php if ($b['status'] !== 'CANCELLED' && $b['status'] !== 'EXPIRED'): ?>
                    <button class="btn btn-outline" style="padding:6px 10px;font-size:12px;color:var(--danger)" onclick="nttAdminAction('<?= htmlspecialchars($b['booking_ref']) ?>','REJECT_CANCEL')">Cancel</button>
                  <?php endif; ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-bottom:28px">
      <h2 style="font-size:1.5rem;margin:0 0 6px">Room Inventory &amp; Category Allocation</h2>
      <p style="font-size:0.875rem;color:var(--text-muted);margin:0 0 18px">Adjust room unit counts, unit numbers, and category tariffs per tea estate. Total estate room capacity updates immediately across the guest search bar.</p>
      <?php foreach ($estates as $est): ?>
        <div style="border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px;background:var(--bg)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <strong style="font-size:1.05rem"><?= htmlspecialchars($est['name']) ?></strong>
            <span class="tabular" style="font-size:0.85rem;color:var(--accent);font-weight:700">Active Total: <?= (int) $est['total_rooms'] ?> Units</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Room Category</th><th>Bed / View</th><th>Unit Labels</th><th>Units</th><th>MAP Rate (₹)</th><th>All Meals (₹)</th><th>Status</th><th>Save</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach (($est['room_categories'] ?? []) as $rc): ?>
                  <tr data-room-row data-estate-id="<?= (int) $est['id'] ?>" data-room-id="<?= (int) $rc['id'] ?>">
                    <td><input class="input" data-field="name" value="<?= htmlspecialchars($rc['name']) ?>" /></td>
                    <td><input class="input" data-field="bed_type" value="<?= htmlspecialchars($rc['bed_type']) ?>" /></td>
                    <td><input class="input tabular" data-field="unit_labels" value="<?= htmlspecialchars(implode(', ', $rc['unit_labels'] ?? [])) ?>" /></td>
                    <td style="width:90px"><input class="input tabular" type="number" min="0" max="50" data-field="total_units" value="<?= (int) $rc['total_units'] ?>" /></td>
                    <td style="width:120px"><input class="input tabular" type="number" min="1000" data-field="map_rate" value="<?= (int) $rc['map_rate'] ?>" /></td>
                    <td style="width:120px"><input class="input tabular" type="number" min="1000" data-field="all_meals_rate" value="<?= (int) $rc['all_meals_rate'] ?>" /></td>
                    <td style="width:120px">
                      <select class="select" data-field="is_active">
                        <option value="1" <?= !empty($rc['is_active']) ? 'selected' : '' ?>>Active</option>
                        <option value="0" <?= empty($rc['is_active']) ? 'selected' : '' ?>>Maintenance</option>
                      </select>
                    </td>
                    <td><button type="button" class="btn btn-primary" style="padding:7px 12px;font-size:12px" onclick="nttSaveRoomCategory(this)">Save</button></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        </div>
      <?php endforeach; ?>

      <form id="ntt-add-room-form" class="grid-4" style="align-items:end;padding-top:12px;border-top:1px solid var(--border)">
        <div>
          <label class="label">Estate</label>
          <select class="select" name="estate_id">
            <?php foreach ($estates as $e): ?>
              <option value="<?= (int) $e['id'] ?>"><?= htmlspecialchars($e['name']) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div><label class="label">New Category Name</label><input class="input" name="name" required placeholder="e.g. Tea Garden Villa" /></div>
        <div><label class="label">Bed / View</label><input class="input" name="bed_type" placeholder="King Bed · Tea View" /></div>
        <div><label class="label">Unit Numbers (comma-sep)</label><input class="input tabular" name="unit_labels" placeholder="M-107, M-108" /></div>
        <div><label class="label">Total Units</label><input class="input tabular" type="number" name="total_units" value="2" min="1" max="30" required /></div>
        <div><label class="label">MAP Rate (₹)</label><input class="input tabular" type="number" name="map_rate" value="10000" min="1000" required /></div>
        <div><label class="label">All Meals Rate (₹)</label><input class="input tabular" type="number" name="all_meals_rate" value="12000" min="1000" required /></div>
        <div><button type="submit" class="btn btn-outline" style="width:100%">+ Add Room Category</button></div>
      </form>
    </div>

    <div class="card">
      <h2 style="font-size:1.5rem;margin:0 0 16px">Date-Level Inventory Block &amp; Seasonal Rate Override</h2>
      <form id="ntt-inv-form" class="grid-4" style="align-items:end">
        <div>
          <label class="label">Estate</label>
          <select class="select" name="estate_id">
            <?php foreach ($estates as $e): ?>
              <option value="<?= (int) $e['id'] ?>"><?= htmlspecialchars($e['name']) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div><label class="label">Stay Date</label><input class="input" type="date" name="stay_date" value="<?= date('Y-m-d') ?>" required /></div>
        <div><label class="label">MAP Rate Override (₹)</label><input class="input" type="number" name="map_rate_override" placeholder="Leave blank for default" /></div>
        <div><label class="label">All Meals Override (₹)</label><input class="input" type="number" name="all_meals_rate_override" placeholder="Leave blank for default" /></div>
        <div><label class="label">Custom Room Count</label><input class="input" type="number" name="custom_total_rooms" placeholder="Optional" /></div>
        <div><label class="label">Min Stay (Nights)</label><input class="input" type="number" name="min_stay" value="1" min="1" max="10" /></div>
        <div><label class="label">Block Date?</label><select class="select" name="is_blocked"><option value="0">Open for Booking</option><option value="1">Blocked / Closed</option></select></div>
        <div><button type="submit" class="btn btn-primary" style="width:100%">Save Date Rule</button></div>
      </form>
    </div>
  </div>
</section>
<script>
  const csrf = <?= json_encode($csrfToken) ?>;
  const base = <?= json_encode($config['base_path'] ?? '') ?>;
  async function nttAdminAction(ref, action) {
    const res = await fetch(`${base}/api/admin/bookings/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _csrf: csrf, booking_ref: ref, action })
    });
    if (res.ok) location.reload();
    else alert('Action failed');
  }
  async function nttSaveRoomCategory(btn) {
    const row = btn.closest('tr[data-room-row]');
    if (!row) return;
    const val = (f) => row.querySelector(`[data-field="${f}"]`)?.value ?? '';
    const res = await fetch(`${base}/api/admin/rooms/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _csrf: csrf,
        estate_id: Number(row.getAttribute('data-estate-id')),
        room_type_id: Number(row.getAttribute('data-room-id')),
        name: val('name'),
        bed_type: val('bed_type'),
        unit_labels: val('unit_labels'),
        total_units: Number(val('total_units')),
        map_rate: Number(val('map_rate')),
        all_meals_rate: Number(val('all_meals_rate')),
        is_active: val('is_active') === '1'
      })
    });
    if (res.ok) location.reload();
    else alert('Failed to save room category.');
  }
  document.getElementById('ntt-add-room-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body._csrf = csrf;
    const res = await fetch(`${base}/api/admin/rooms/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) location.reload();
    else alert('Failed to add room category.');
  });
  document.getElementById('ntt-inv-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body._csrf = csrf;
    body.is_blocked = body.is_blocked === '1';
    const res = await fetch(`${base}/api/admin/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) alert('Inventory rule saved and availability cache purged.');
    else alert('Failed to save inventory rule.');
  });
</script>
<?php
$content = ob_get_clean();
require dirname(__DIR__) . '/layouts/main.php';
