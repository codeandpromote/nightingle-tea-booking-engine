# Main Website (`nightingaletea.com`) Integration Guide

## 1. Drop-In Embed Script
Add this single line before `</body>` on `nightingaletea.com` / `nightingaletea.in`:

```html
<script
  src="https://booking.nightingaletea.com/embed/nightingale-widget.js"
  data-booking-url="https://booking.nightingaletea.com"
  defer
></script>
```

## 2. Single-Click "Book Now" Buttons
Attach `data-ntt-book` and `data-ntt-estate="mateli|jainti|chuapara"` to any button or link on your main website:

```html
<a href="https://booking.nightingaletea.com/?estate=mateli" data-ntt-book data-ntt-estate="mateli">
  Book Mateli Heritage Bungalow
</a>
```

## 3. Live Availability Counter Badges
Show real-time room availability directly on your main website estate cards:

```html
<span data-ntt-availability-badge="mateli">Checking availability...</span>
```
