<?php
declare(strict_types=1);
$base = htmlspecialchars((string) ($config['base_path'] ?? ''), ENT_QUOTES, 'UTF-8');
$pageTitle = 'Nightingale Tea Tourism · Book Your Dooars Heritage Stay';
$today = date('Y-m-d');
$tomorrow = date('Y-m-d', strtotime('+1 day'));
$dayAfter = date('Y-m-d', strtotime('+2 days'));
$searchSummaries = $searchSummaries ?? [];
$estatesJson = json_encode($estates, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
$summariesJson = json_encode($searchSummaries, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
ob_start();
?>
<section style="padding:20px 0 12px;background:linear-gradient(180deg, #1b4332 0%, #23533f 68%, var(--bg) 68%)">
  <div class="container">
    <div class="mmt-search-shell">
      <form id="ntt-mmt-search" class="mmt-search-grid">
        <div class="mmt-seg">
          <label for="mmt-estate">Tea Estate / Location</label>
          <select id="mmt-estate" name="search_estate">
            <option value="ALL">All Dooars Estates (3)</option>
            <?php foreach ($estates as $e): ?>
              <option value="<?= htmlspecialchars($e['slug'], ENT_QUOTES, 'UTF-8') ?>" <?= ($selectedEstate === $e['slug'] && !empty($_GET['estate'])) ? 'selected' : '' ?>>
                <?= htmlspecialchars($e['name'], ENT_QUOTES, 'UTF-8') ?> · <?= (int) $e['total_rooms'] ?> Rooms
              </option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="mmt-seg">
          <label for="mmt-checkin">Check-In</label>
          <input id="mmt-checkin" type="date" name="search_check_in" value="<?= $tomorrow ?>" min="<?= $today ?>" required />
        </div>
        <div class="mmt-seg">
          <label for="mmt-checkout">Check-Out</label>
          <input id="mmt-checkout" type="date" name="search_check_out" value="<?= $dayAfter ?>" min="<?= $tomorrow ?>" required />
        </div>
        <div class="mmt-seg" id="mmt-guest-trigger" style="cursor:pointer">
          <label>Rooms &amp; Guests</label>
          <div id="mmt-guest-summary" style="font-size:0.92rem;font-weight:600;padding:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">1 Room · 2 Adults</div>
          <div id="mmt-guest-popover" class="mmt-popover" style="display:none" onclick="event.stopPropagation()">
            <div class="mmt-stepper-row">
              <div><div style="font-size:0.85rem;font-weight:600">Rooms</div><div style="font-size:11px;color:var(--text-muted)">Multiple units</div></div>
              <div class="mmt-stepper-ctrl">
                <button type="button" data-step="rooms" data-delta="-1">−</button>
                <span class="tabular" id="step-val-rooms">1</span>
                <button type="button" data-step="rooms" data-delta="1">+</button>
              </div>
            </div>
            <div class="mmt-stepper-row">
              <div><div style="font-size:0.85rem;font-weight:600">Adults</div><div style="font-size:11px;color:var(--text-muted)">13+ yrs</div></div>
              <div class="mmt-stepper-ctrl">
                <button type="button" data-step="adults" data-delta="-1">−</button>
                <span class="tabular" id="step-val-adults">2</span>
                <button type="button" data-step="adults" data-delta="1">+</button>
              </div>
            </div>
            <div class="mmt-stepper-row">
              <div><div style="font-size:0.85rem;font-weight:600">Children (5–12)</div><div style="font-size:11px;color:var(--text-muted)">Child tariff</div></div>
              <div class="mmt-stepper-ctrl">
                <button type="button" data-step="c5" data-delta="-1">−</button>
                <span class="tabular" id="step-val-c5">0</span>
                <button type="button" data-step="c5" data-delta="1">+</button>
              </div>
            </div>
            <div class="mmt-stepper-row">
              <div><div style="font-size:0.85rem;font-weight:600">Kids (&lt;5 yrs)</div><div style="font-size:11px;color:var(--text-muted)">Complimentary</div></div>
              <div class="mmt-stepper-ctrl">
                <button type="button" data-step="cu5" data-delta="-1">−</button>
                <span class="tabular" id="step-val-cu5">0</span>
                <button type="button" data-step="cu5" data-delta="1">+</button>
              </div>
            </div>
            <button type="button" id="mmt-guest-done" class="btn btn-primary" style="width:100%;margin-top:8px;padding:7px">Apply Guests</button>
          </div>
        </div>
        <div class="mmt-seg">
          <label for="mmt-plan">Meal Plan</label>
          <select id="mmt-plan" name="search_meal_plan">
            <option value="MAP">MAP (Breakfast + Dinner)</option>
            <option value="ALL_MEALS">All Meals (3 Meals)</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" style="padding:12px 24px;font-size:0.95rem">Search Stays</button>
      </form>
      <div id="ntt-search-status" style="font-size:0.8rem;color:var(--text-muted);padding:8px 6px 2px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <span>Showing live room inventory across Mateli, Jainti &amp; Chuapara Tea Estates.</span>
        <span class="tabular" id="ntt-search-dates-badge"><?= $tomorrow ?> → <?= $dayAfter ?></span>
      </div>
    </div>
  </div>
</section>

<section style="padding:28px 0 24px">
  <div class="container">
    <div class="grid-2" style="align-items:center;gap:40px">
      <div>
        <p style="font-size:0.85rem;color:var(--text-muted);margin:0 0 10px">Dooars Heritage Retreats · Mateli · Jainti · Chuapara</p>
        <h1 style="font-size:clamp(2.1rem,3.6vw,3.1rem);line-height:1.08;margin:0 0 14px">Heritage tea estate stays, booked direct with live room inventory.</h1>
        <p style="color:var(--text-muted);font-size:0.98rem;margin:0 0 20px">Choose specific suites, heritage rooms, or plantation cottages across Mateli (6 units), Jainti (6 units), and Chuapara (8 units) with transparent MAP and All Meals tariffs, Razorpay checkout, or zero-fee direct UPI.</p>
        <a href="#estates" class="btn btn-primary">Explore Estates &amp; Rooms</a>
      </div>
      <div style="border-radius:14px;overflow:hidden;border:1px solid var(--border)">
        <img src="<?= $base ?>/assets/images/hero_tea_estate.jpg" alt="Nightingale Tea Heritage Bungalow" style="width:100%;height:300px;object-fit:cover;display:block" />
      </div>
    </div>
  </div>
</section>

<section id="estates" style="padding:20px 0">
  <div class="container">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <h2 style="font-size:2rem;margin:0">Official Estates &amp; Multi-Room Categories</h2>
        <p style="margin:4px 0 0;font-size:0.9rem;color:var(--text-muted)">Select an estate and specific room category below to lock your dates.</p>
      </div>
      <button type="button" id="ntt-show-all-estates" class="btn btn-outline" style="display:none">Show All 3 Estates</button>
    </div>
    <div id="ntt-estates-grid" class="grid-3">
      <?php foreach ($estates as $e):
        $summary = $searchSummaries[$e['slug']] ?? null;
        $openRooms = $summary ? (int) $summary['available_rooms'] : (int) $e['total_rooms'];
        $cats = $summary['room_categories'] ?? ($e['room_categories'] ?? []);
      ?>
        <article class="card ntt-estate-card" data-estate-slug="<?= htmlspecialchars($e['slug'], ENT_QUOTES, 'UTF-8') ?>" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
          <img src="<?= $base ?>/<?= htmlspecialchars($e['image_path'], ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars($e['name'], ENT_QUOTES, 'UTF-8') ?>" style="width:100%;height:190px;object-fit:cover;display:block" />
          <div style="padding:20px;flex:1;display:flex;flex-direction:column">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:0.8rem;color:var(--text-muted)">
              <span><?= htmlspecialchars($e['location'], ENT_QUOTES, 'UTF-8') ?></span>
              <span class="tabular ntt-estate-open-label" style="font-weight:700;color:var(--accent)"><?= $openRooms ?>/<?= (int) $e['total_rooms'] ?> open</span>
            </div>
            <h3 style="font-size:1.4rem;margin:4px 0 6px"><?= htmlspecialchars($e['name'], ENT_QUOTES, 'UTF-8') ?></h3>
            <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">
              MAP: <strong class="tabular" style="color:var(--text)">₹<?= number_format((int) $e['map_base_rate']) ?></strong> ·
              All Meals: <strong class="tabular" style="color:var(--text)">₹<?= number_format((int) $e['all_meals_base_rate']) ?></strong>
            </div>
            <div class="ntt-room-cat-list" style="margin-bottom:14px;flex:1">
              <?php foreach ($cats as $cat):
                $catAvail = $cat['available_units'] ?? ($cat['total_units'] ?? 0);
                $catTotal = $cat['total_units'] ?? 0;
              ?>
                <div class="room-cat-row" data-room-id="<?= (int) $cat['id'] ?>">
                  <div style="min-width:0">
                    <div style="font-size:0.85rem;font-weight:600;color:var(--text)"><?= htmlspecialchars($cat['name'], ENT_QUOTES, 'UTF-8') ?></div>
                    <div style="font-size:11px;color:var(--text-muted)"><?= htmlspecialchars($cat['bed_type'] ?? '', ENT_QUOTES, 'UTF-8') ?></div>
                    <div class="tabular" style="font-size:11px;color:var(--accent);margin-top:2px"><?= (int) $catAvail ?>/<?= (int) $catTotal ?> units · MAP ₹<?= number_format((int) $cat['map_rate']) ?></div>
                  </div>
                  <button type="button" class="btn btn-outline" style="padding:6px 10px;font-size:12px" onclick="window.nttSelectRoom('<?= htmlspecialchars($e['slug'], ENT_QUOTES, 'UTF-8') ?>', <?= (int) $cat['id'] ?>)">Select</button>
                </div>
              <?php endforeach; ?>
            </div>
            <a href="#reserve" onclick="window.nttSelectRoom('<?= htmlspecialchars($e['slug'], ENT_QUOTES, 'UTF-8') ?>', null)" class="btn btn-primary" style="width:100%">Book at <?= htmlspecialchars($e['name'], ENT_QUOTES, 'UTF-8') ?></a>
          </div>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section id="reserve" style="padding:36px 0">
  <div class="container">
    <div class="grid-2" style="align-items:start">
      <div class="card">
        <h2 style="font-size:1.75rem;margin:0 0 18px">Reservation Details</h2>
        <form id="ntt-booking-form">
          <div style="margin-bottom:14px">
            <label class="label">Tea Estate</label>
            <select class="select" name="estate_slug">
              <?php foreach ($estates as $e): ?>
                <option value="<?= htmlspecialchars($e['slug'], ENT_QUOTES, 'UTF-8') ?>" <?= $selectedEstate === $e['slug'] ? 'selected' : '' ?>>
                  <?= htmlspecialchars($e['name'], ENT_QUOTES, 'UTF-8') ?> (<?= (int) $e['total_rooms'] ?> Rooms · MAP ₹<?= number_format((int) $e['map_base_rate']) ?>)
                </option>
              <?php endforeach; ?>
            </select>
          </div>
          <div style="margin-bottom:14px">
            <label class="label">Room Category / Unit Type</label>
            <select class="select" name="room_type_id" id="ntt-room-type-select"></select>
          </div>
          <div class="grid-2" style="gap:12px;margin-bottom:14px">
            <div><label class="label">Check-in</label><input class="input" type="date" name="check_in" value="<?= $tomorrow ?>" min="<?= $today ?>" required /></div>
            <div><label class="label">Check-out</label><input class="input" type="date" name="check_out" value="<?= $dayAfter ?>" min="<?= $tomorrow ?>" required /></div>
          </div>
          <div class="grid-4" style="gap:10px;margin-bottom:14px">
            <div><label class="label">Rooms</label><input class="input" type="number" name="rooms_count" value="1" min="1" max="10" /></div>
            <div><label class="label">Adults</label><input class="input" type="number" name="adults" value="2" min="1" max="30" /></div>
            <div><label class="label">Child (5-12)</label><input class="input" type="number" name="children_5_12" value="0" min="0" max="20" /></div>
            <div><label class="label">Kids (&lt;5 Free)</label><input class="input" type="number" name="children_under_5" value="0" min="0" max="20" /></div>
          </div>
          <div style="margin-bottom:14px">
            <label class="label">Meal Plan</label>
            <select class="select" name="meal_plan">
              <option value="MAP">MAP Plan (Breakfast &amp; Dinner)</option>
              <option value="ALL_MEALS">All Meals Plan (Breakfast, Lunch &amp; Dinner)</option>
            </select>
          </div>
          <div class="grid-2" style="gap:12px;margin-bottom:14px">
            <div><label class="label">Primary Guest Name</label><input class="input" name="guest_name" required placeholder="Full name" /></div>
            <div><label class="label">Phone / WhatsApp</label><input class="input" name="guest_phone" required placeholder="+91 98..." /></div>
          </div>
          <div class="grid-2" style="gap:12px;margin-bottom:14px">
            <div><label class="label">Email Address</label><input class="input" type="email" name="guest_email" required placeholder="guest@example.com" /></div>
            <div><label class="label">City</label><input class="input" name="guest_city" placeholder="Kolkata" /></div>
          </div>
          <div style="margin-bottom:14px">
            <label class="label">Special Requests</label>
            <textarea class="textarea" name="special_requests" rows="2" placeholder="Dietary preferences, arrival time, crib request..."></textarea>
          </div>
          <div style="margin-bottom:18px">
            <label class="label">Payment Method</label>
            <select class="select" name="payment_method">
              <option value="RAZORPAY">Automated Payment Gateway (Razorpay — Cards, UPI, NetBanking · Instant Confirmation)</option>
              <option value="MANUAL_UPI">Manual Direct UPI / QR Transfer (0% Gateway Fee · 30-Min Hold)</option>
            </select>
          </div>
          <button id="ntt-submit-booking" type="submit" class="btn btn-primary" style="width:100%">Reserve &amp; Proceed to Payment</button>
        </form>
      </div>

      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="card">
          <h3 style="font-size:1.35rem;margin:0 0 12px">Live Tariff Breakdown</h3>
          <div id="ntt-quote-summary">Calculating...</div>
        </div>
        <div id="availability" class="card">
          <h3 style="font-size:1.35rem;margin:0 0 12px">14-Day Estate Availability</h3>
          <div id="ntt-calendar-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"></div>
        </div>
        <div id="ntt-payment-step" class="card" style="display:none">
          <h3 style="font-size:1.35rem;margin:0 0 8px">Complete Payment · <span id="ntt-active-ref" class="tabular"></span></h3>
          <div id="ntt-upi-panel" style="display:none">
            <p style="font-size:0.875rem;color:var(--text-muted)">Transfer <strong id="ntt-upi-amount" class="tabular"></strong> to UPI ID <strong id="ntt-upi-vpa" class="tabular"></strong> (<a id="ntt-upi-link" href="#">Open UPI App</a>) and submit your UTR below:</p>
            <form id="ntt-upi-submit-form" enctype="multipart/form-data">
              <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />
              <input type="hidden" id="ntt-upi-ref-input" name="booking_ref" />
              <div style="margin-bottom:10px"><label class="label">12-Digit UTR / Transaction Ref</label><input class="input" name="utr_reference" required minlength="8" placeholder="432198765432" /></div>
              <div style="margin-bottom:12px"><label class="label">Payment Screenshot (JPG/PNG/PDF)</label><input class="input" type="file" name="payment_proof" accept=".jpg,.jpeg,.png,.webp,.pdf" /></div>
              <button type="submit" class="btn btn-primary" style="width:100%">Submit UTR for Verification</button>
            </form>
          </div>
          <div id="ntt-rzp-panel" style="display:none">
            <p style="font-size:0.875rem">Launching Razorpay Secure Checkout...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section id="track" style="padding:24px 0">
  <div class="container">
    <div class="card">
      <h2 style="font-size:1.6rem;margin:0 0 12px">Track Reservation &amp; Download Receipt</h2>
      <form onsubmit="event.preventDefault();window.location.href='<?= $base ?>/receipt/'+encodeURIComponent(this.ref.value.trim().toUpperCase())" style="display:flex;gap:12px;flex-wrap:wrap">
        <input class="input" name="ref" placeholder="Enter Booking Reference (e.g., NTT-2026-AB12CD)" style="max-width:340px" required />
        <button type="submit" class="btn btn-outline">View Digital Receipt</button>
      </form>
    </div>
  </div>
</section>

<script>
  window.NTT_CONFIG = {
    basePath: <?= json_encode($config['base_path'] ?? '') ?>,
    csrfToken: <?= json_encode($csrfToken) ?>,
    estates: <?= $estatesJson ?>,
    searchSummaries: <?= $summariesJson ?>
  };
</script>
<script src="<?= $base ?>/assets/js/booking-app.js" defer></script>
<?php
$content = ob_get_clean();
require dirname(__DIR__) . '/layouts/main.php';
