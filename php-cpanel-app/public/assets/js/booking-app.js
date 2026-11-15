(function () {
  const cfg = window.NTT_CONFIG || { basePath: '', csrfToken: '', estates: [], searchSummaries: {} };
  const base = cfg.basePath || '';
  const estates = Array.isArray(cfg.estates) ? cfg.estates : [];
  let searchSummaries = cfg.searchSummaries || {};

  const form = document.getElementById('ntt-booking-form');
  if (!form) return;

  const roomSelect = document.getElementById('ntt-room-type-select');
  const quoteBox = document.getElementById('ntt-quote-summary');
  const calendarGrid = document.getElementById('ntt-calendar-grid');
  const submitBtn = document.getElementById('ntt-submit-booking');
  const paymentStep = document.getElementById('ntt-payment-step');
  const upiPanel = document.getElementById('ntt-upi-panel');
  const rzpPanel = document.getElementById('ntt-rzp-panel');

  // MMT Search Bar state & elements
  const mmtForm = document.getElementById('ntt-mmt-search');
  const guestTrigger = document.getElementById('mmt-guest-trigger');
  const guestPopover = document.getElementById('mmt-guest-popover');
  const guestSummary = document.getElementById('mmt-guest-summary');
  const guestDone = document.getElementById('mmt-guest-done');
  const showAllBtn = document.getElementById('ntt-show-all-estates');
  const searchDatesBadge = document.getElementById('ntt-search-dates-badge');

  const guestState = { rooms: 1, adults: 2, c5: 0, cu5: 0 };

  function syncGuestSummary() {
    if (!guestSummary) return;
    const kids = guestState.c5 + guestState.cu5;
    guestSummary.textContent =
      `${guestState.rooms} Room${guestState.rooms > 1 ? 's' : ''} · ${guestState.adults} Adult${guestState.adults > 1 ? 's' : ''}` +
      (kids > 0 ? ` · ${kids} Child` : '');
    const map = { rooms: 'step-val-rooms', adults: 'step-val-adults', c5: 'step-val-c5', cu5: 'step-val-cu5' };
    Object.keys(map).forEach((k) => {
      const el = document.getElementById(map[k]);
      if (el) el.textContent = String(guestState[k]);
    });
  }

  if (guestTrigger && guestPopover) {
    guestTrigger.addEventListener('click', () => {
      guestPopover.style.display = guestPopover.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', (evt) => {
      if (!guestTrigger.contains(evt.target)) {
        guestPopover.style.display = 'none';
      }
    });
    if (guestDone) {
      guestDone.addEventListener('click', () => {
        guestPopover.style.display = 'none';
      });
    }
    guestPopover.querySelectorAll('button[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-step');
        const delta = Number(btn.getAttribute('data-delta'));
        const min = key === 'rooms' || key === 'adults' ? 1 : 0;
        const max = key === 'rooms' ? 10 : 24;
        guestState[key] = Math.max(min, Math.min(max, guestState[key] + delta));
        syncGuestSummary();
      });
    });
    syncGuestSummary();
  }

  function populateRoomSelect(preferredRoomId) {
    if (!roomSelect) return;
    const slug = form.estate_slug.value;
    const est = estates.find((e) => e.slug === slug);
    const summary = searchSummaries[slug];
    const cats = (summary && summary.room_categories && summary.room_categories.length)
      ? summary.room_categories
      : (est && est.room_categories ? est.room_categories : []);

    const prevVal = preferredRoomId ? String(preferredRoomId) : roomSelect.value;
    roomSelect.innerHTML = cats.map((c) => {
      const open = typeof c.available_units === 'number' ? c.available_units : c.total_units;
      return `<option value="${c.id}">${c.name} (${open}/${c.total_units} open · MAP ₹${Number(c.map_rate).toLocaleString('en-IN')})</option>`;
    }).join('');

    if (prevVal && cats.some((c) => String(c.id) === prevVal)) {
      roomSelect.value = prevVal;
    } else if (cats.length > 0) {
      roomSelect.value = String(cats[0].id);
    }

    document.querySelectorAll('.room-cat-row').forEach((row) => {
      row.classList.toggle('active', row.getAttribute('data-room-id') === roomSelect.value);
    });
  }

  function renderEstateCardAvailability(estateFilter) {
    document.querySelectorAll('.ntt-estate-card').forEach((card) => {
      const slug = card.getAttribute('data-estate-slug');
      const visible = !estateFilter || estateFilter === 'ALL' || estateFilter === slug;
      card.style.display = visible ? 'flex' : 'none';

      const summary = searchSummaries[slug];
      if (!summary) return;

      const openLabel = card.querySelector('.ntt-estate-open-label');
      if (openLabel) {
        openLabel.textContent = summary.is_blocked
          ? 'Blocked'
          : `${summary.available_rooms}/${summary.total_rooms} open`;
      }

      const catList = card.querySelector('.ntt-room-cat-list');
      if (catList && Array.isArray(summary.room_categories)) {
        catList.innerHTML = summary.room_categories.map((c) => `
          <div class="room-cat-row ${roomSelect && String(c.id) === roomSelect.value ? 'active' : ''}" data-room-id="${c.id}">
            <div style="min-width:0">
              <div style="font-size:0.85rem;font-weight:600;color:var(--text)">${c.name}</div>
              <div style="font-size:11px;color:var(--text-muted)">${c.bed_type || ''}</div>
              <div class="tabular" style="font-size:11px;color:var(--accent);margin-top:2px">${c.available_units}/${c.total_units} units · MAP ₹${Number(c.map_rate).toLocaleString('en-IN')}</div>
            </div>
            <button type="button" class="btn btn-outline" style="padding:6px 10px;font-size:12px" onclick="window.nttSelectRoom('${slug}', ${c.id})">Select</button>
          </div>
        `).join('');
      }
    });

    if (showAllBtn) {
      showAllBtn.style.display = estateFilter && estateFilter !== 'ALL' ? 'inline-flex' : 'none';
    }
  }

  window.nttSelectRoom = function (estateSlug, roomId) {
    form.estate_slug.value = estateSlug;
    populateRoomSelect(roomId);
    refreshAvailability();
    refreshQuote();
    document.getElementById('reserve')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (mmtForm) {
    mmtForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const estate = mmtForm.search_estate.value;
      const ci = mmtForm.search_check_in.value;
      const co = mmtForm.search_check_out.value;
      const plan = mmtForm.search_meal_plan.value;

      form.check_in.value = ci;
      form.check_out.value = co;
      form.rooms_count.value = String(guestState.rooms);
      form.adults.value = String(guestState.adults);
      form.children_5_12.value = String(guestState.c5);
      form.children_under_5.value = String(guestState.cu5);
      form.meal_plan.value = plan;
      if (estate !== 'ALL') {
        form.estate_slug.value = estate;
      }

      if (searchDatesBadge) {
        searchDatesBadge.textContent = `${ci} → ${co}`;
      }

      const params = new URLSearchParams({
        check_in: ci,
        check_out: co,
        rooms: String(guestState.rooms),
        estate: estate,
      });
      const res = await fetch(`${base}/api/search?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.search_summaries) {
        searchSummaries = data.search_summaries;
      }
      renderEstateCardAvailability(estate);
      populateRoomSelect();
      refreshAvailability();
      refreshQuote();
      document.getElementById('estates')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      if (mmtForm) mmtForm.search_estate.value = 'ALL';
      renderEstateCardAvailability('ALL');
    });
  }

  async function refreshAvailability() {
    const estate = form.estate_slug.value;
    const start = form.check_in.value || new Date().toISOString().slice(0, 10);
    const res = await fetch(`${base}/api/availability?estate=${encodeURIComponent(estate)}&start=${encodeURIComponent(start)}&days=14`);
    const data = await res.json();
    if (!calendarGrid || !data.calendar) return;

    calendarGrid.innerHTML = data.calendar.map((d) => {
      const stateClass = d.is_blocked ? 'blocked' : (d.available_rooms === 0 ? 'soldout' : 'open');
      const label = d.is_blocked ? 'Blocked' : `${d.available_rooms} open`;
      return `<div class="cal-cell ${stateClass}" style="padding:10px;border:1px solid var(--border);border-radius:8px;background:${d.is_blocked || d.available_rooms === 0 ? '#f8f5f2' : '#fff'}">
        <div style="font-size:12px;color:var(--text-muted)">${d.date}</div>
        <div style="font-weight:600;font-size:13px;margin-top:2px">${label}</div>
        <div class="tabular" style="font-size:12px;color:var(--accent)">₹${Number(d.map_rate).toLocaleString('en-IN')}</div>
      </div>`;
    }).join('');
  }

  async function refreshQuote() {
    const params = new URLSearchParams({
      estate: form.estate_slug.value,
      room_type_id: roomSelect ? roomSelect.value : '',
      check_in: form.check_in.value,
      check_out: form.check_out.value,
      rooms: form.rooms_count.value,
      adults: form.adults.value,
      children_5_12: form.children_5_12.value,
      children_under_5: form.children_under_5.value,
      meal_plan: form.meal_plan.value,
    });
    const res = await fetch(`${base}/api/quote?${params.toString()}`);
    const data = await res.json();
    if (!quoteBox) return;
    if (!res.ok) {
      quoteBox.innerHTML = `<p style="color:var(--danger);font-size:14px">${data.error || 'Select valid dates'}</p>`;
      return;
    }
    const t = data.tariff;
    const rcName = data.room_category ? data.room_category.name : 'Standard Room';
    quoteBox.innerHTML = `
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">Selected Category: <strong style="color:var(--text)">${rcName}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Room Stay (${t.nights} nights × ${t.rooms_count} room)</span><strong class="tabular">₹${t.base_room_total.toLocaleString('en-IN')}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Extra Adults (${t.extra_adults})</span><span class="tabular">₹${t.extra_adult_total.toLocaleString('en-IN')}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Children 5–12 yrs (${t.children_5_12})</span><span class="tabular">₹${t.child_total.toLocaleString('en-IN')}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;color:var(--text-muted)"><span>Kids below 5 yrs (${t.children_under_5})</span><span>Complimentary</span></div>
      <hr style="border:none;border-top:1px solid var(--border);margin:10px 0" />
      <div style="display:flex;justify-content:space-between;font-size:1.1rem"><strong>Total Payable</strong><strong class="tabular" style="color:var(--accent)">₹${t.total_amount.toLocaleString('en-IN')}</strong></div>
    `;
  }

  ['change', 'input'].forEach((evt) => {
    form.addEventListener(evt, () => {
      refreshQuote();
    });
  });
  form.estate_slug.addEventListener('change', () => {
    populateRoomSelect();
    refreshAvailability();
    refreshQuote();
  });
  if (roomSelect) {
    roomSelect.addEventListener('change', () => {
      document.querySelectorAll('.room-cat-row').forEach((row) => {
        row.classList.toggle('active', row.getAttribute('data-room-id') === roomSelect.value);
      });
      refreshQuote();
    });
  }
  form.check_in.addEventListener('change', refreshAvailability);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Locking Room Inventory...';

    const payload = {
      _csrf: cfg.csrfToken,
      estate_slug: form.estate_slug.value,
      room_type_id: roomSelect ? Number(roomSelect.value) : null,
      check_in: form.check_in.value,
      check_out: form.check_out.value,
      rooms_count: Number(form.rooms_count.value),
      adults: Number(form.adults.value),
      children_5_12: Number(form.children_5_12.value),
      children_under_5: Number(form.children_under_5.value),
      meal_plan: form.meal_plan.value,
      guest_name: form.guest_name.value,
      guest_phone: form.guest_phone.value,
      guest_email: form.guest_email.value,
      guest_city: form.guest_city.value,
      special_requests: form.special_requests.value,
      payment_method: form.payment_method.value,
    };

    try {
      const res = await fetch(`${base}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': cfg.csrfToken },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Could not create reservation.');
        return;
      }

      paymentStep.style.display = 'block';
      document.getElementById('ntt-active-ref').textContent = data.booking_ref;

      if (data.payment_method === 'MANUAL_UPI') {
        upiPanel.style.display = 'block';
        rzpPanel.style.display = 'none';
        document.getElementById('ntt-upi-vpa').textContent = data.upi.vpa;
        document.getElementById('ntt-upi-amount').textContent = `₹${Number(data.total_amount).toLocaleString('en-IN')}`;
        document.getElementById('ntt-upi-link').href = data.upi.uri;
        document.getElementById('ntt-upi-ref-input').value = data.booking_ref;
      } else if (data.razorpay && window.Razorpay) {
        upiPanel.style.display = 'none';
        rzpPanel.style.display = 'block';
        const rzp = new window.Razorpay({
          key: data.razorpay.key_id,
          amount: data.razorpay.amount_paise,
          currency: 'INR',
          name: 'Nightingale Tea Tourism',
          description: `Stay Reservation ${data.booking_ref}`,
          order_id: data.razorpay.order_id,
          handler: async function (response) {
            const vRes = await fetch(`${base}/api/payments/razorpay/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                booking_ref: data.booking_ref,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            if (vRes.ok) {
              window.location.href = `${base}/receipt/${data.booking_ref}`;
            }
          },
        });
        rzp.open();
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Reserve & Proceed to Payment';
    }
  });

  const upiForm = document.getElementById('ntt-upi-submit-form');
  if (upiForm) {
    upiForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(upiForm);
      const res = await fetch(`${base}/api/payments/upi/submit`, { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        window.location.href = `${base}/receipt/${data.booking_ref}`;
      } else {
        alert(data.error || 'Could not submit UPI UTR.');
      }
    });
  }

  populateRoomSelect();
  refreshAvailability();
  refreshQuote();
})();
