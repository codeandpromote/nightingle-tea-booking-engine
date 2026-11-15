/**
 * Nightingale Tea Tourism - Main Website Integration Widget
 * Drop into nightingaletea.com / nightingaletea.in:
 * <script src="https://booking.nightingaletea.com/embed/nightingale-widget.js" data-booking-url="https://booking.nightingaletea.com" defer></script>
 */
(function () {
  var scriptEl = document.currentScript;
  var bookingBase = (scriptEl && scriptEl.getAttribute('data-booking-url')) || 'https://booking.nightingaletea.com';
  bookingBase = bookingBase.replace(/\/+$/, '');

  // Bind any [data-ntt-book] button on nightingaletea.com directly to the selected estate/dates
  document.addEventListener('click', function (ev) {
    var trigger = ev.target && ev.target.closest ? ev.target.closest('[data-ntt-book]') : null;
    if (!trigger) return;
    ev.preventDefault();
    var estate = trigger.getAttribute('data-ntt-estate') || 'mateli';
    var checkin = trigger.getAttribute('data-ntt-checkin') || '';
    var checkout = trigger.getAttribute('data-ntt-checkout') || '';
    var params = new URLSearchParams({ estate: estate, source: 'main_site' });
    if (checkin) params.set('checkin', checkin);
    if (checkout) params.set('checkout', checkout);
    window.location.href = bookingBase + '/?' + params.toString();
  });

  // Optional live availability badge hydration for main domain estate cards
  var slots = document.querySelectorAll('[data-ntt-availability-badge]');
  if (slots.length > 0) {
    var today = new Date().toISOString().slice(0, 10);
    slots.forEach(function (el) {
      var slug = el.getAttribute('data-ntt-availability-badge');
      if (!slug) return;
      fetch(bookingBase + '/api/availability?estate=' + encodeURIComponent(slug) + '&start=' + today + '&days=7')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.calendar && data.calendar[0]) {
            var avail = data.calendar[0].available_rooms;
            el.textContent = avail > 0 ? (avail + ' rooms open today') : 'Sold out today';
          }
        })
        .catch(function () {});
    });
  }
})();
