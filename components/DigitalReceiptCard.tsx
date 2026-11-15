'use client';

import React from 'react';
import {
  CheckCircle2,
  Clock,
  Printer,
  Search,
  AlertCircle,
  MapPin,
  Train,
  Plane,
} from 'lucide-react';
import { formatInr, type Booking, type Estate, type SystemSettings } from '@/lib/booking-engine';

interface DigitalReceiptCardProps {
  booking: Booking;
  estate?: Estate | null;
  settings?: SystemSettings | null;
  onBookAnother?: () => void;
}

export function StatusText({ status }: { status: Booking['status'] }) {
  switch (status) {
    case 'CONFIRMED':
    case 'CHECKED_IN':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#166534]">
          <CheckCircle2 className="h-4 w-4" />
          {status === 'CHECKED_IN' ? 'Checked In' : 'Confirmed'}
        </span>
      );
    case 'PENDING_VERIFICATION':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#B45309]">
          <Clock className="h-4 w-4" />
          Pending Bank Verification
        </span>
      );
    case 'AWAITING_PAYMENT':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#B45309]">
          <Clock className="h-4 w-4" />
          Awaiting Payment (Hold Active)
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#B91C1C]">
          <AlertCircle className="h-4 w-4" />
          {status}
        </span>
      );
  }
}

export function DigitalReceiptCard({
  booking,
  estate,
  settings,
  onBookAnother,
}: DigitalReceiptCardProps) {
  return (
    <div className="rounded-xl border border-[#E4E4E0] bg-white p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-[#E4E4E0] pb-6">
        <div>
          <p className="text-xs font-medium text-[#556159]">
            Official Digital Reservation Receipt · Nightingale Tea Tourism
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-[#141C17]">
            {booking.estateName}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#556159]">
            <span className="font-[family-name:var(--font-mono)] font-semibold text-[#1B4332]">
              {booking.bookingRef}
            </span>
            <span aria-hidden="true">·</span>
            <span>Booked {new Date(booking.createdAt).toLocaleDateString('en-IN')}</span>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-2">
          <StatusText status={booking.status} />
          <div className="text-xs text-[#556159]">
            {booking.paymentMethod === 'RAZORPAY'
              ? 'Automated Payment Gateway (Razorpay)'
              : 'Manual Direct UPI / QR Verification (0% Fee)'}
          </div>
          <div className="no-print mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E0] bg-white px-3.5 py-2 text-xs font-semibold text-[#141C17] hover:bg-[#F2F4F0] cursor-pointer whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </button>
            {onBookAnother && (
              <button
                type="button"
                onClick={onBookAnother}
                className="inline-flex items-center rounded-lg bg-[#1B4332] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#143326] cursor-pointer whitespace-nowrap"
              >
                New Reservation
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wide text-[#556159]">
            Stay &amp; Guest Summary
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-[#F2F4F0] pb-2">
              <dt className="text-[#556159]">Primary Guest</dt>
              <dd className="font-semibold text-[#141C17]">{booking.guestName}</dd>
            </div>
            <div className="flex justify-between border-b border-[#F2F4F0] pb-2">
              <dt className="text-[#556159]">Contact</dt>
              <dd className="font-[family-name:var(--font-mono)] text-xs text-[#141C17]">
                {booking.guestPhone} · {booking.guestEmail}
              </dd>
            </div>
            <div className="flex justify-between border-b border-[#F2F4F0] pb-2">
              <dt className="text-[#556159]">Check-in / Check-out</dt>
              <dd className="font-[family-name:var(--font-mono)] font-medium text-[#141C17]">
                {booking.checkIn} → {booking.checkOut} ({booking.nights}N)
              </dd>
            </div>
            <div className="flex justify-between border-b border-[#F2F4F0] pb-2">
              <dt className="text-[#556159]">Room Category</dt>
              <dd className="font-medium text-[#141C17] text-right">{booking.roomSummary}</dd>
            </div>
            <div className="flex justify-between border-b border-[#F2F4F0] pb-2">
              <dt className="text-[#556159]">Rooms &amp; Occupancy</dt>
              <dd className="text-[#141C17]">
                {booking.roomsCount} Room(s) · {booking.adults} Adults · {booking.children5to12} Child (5–12) ·{' '}
                {booking.childrenUnder5} Kids (&lt;5 Free)
              </dd>
            </div>
            <div className="flex justify-between pb-1">
              <dt className="text-[#556159]">Meal Plan</dt>
              <dd className="font-medium text-[#141C17]">
                {booking.mealPlan === 'ALL_MEALS'
                  ? 'All Meals (Breakfast, Lunch & Dinner)'
                  : 'MAP (Breakfast & Dinner)'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wide text-[#556159]">
            Tariff &amp; Settlement Ledger
          </h3>
          <dl className="space-y-2 text-sm tabular-nums">
            <div className="flex justify-between border-b border-[#F2F4F0] pb-2">
              <dt className="text-[#556159]">Base Double-Occupancy Room Tariff</dt>
              <dd className="font-medium">{formatInr(booking.baseRoomTotal)}</dd>
            </div>
            <div className="flex justify-between border-b border-[#F2F4F0] pb-2">
              <dt className="text-[#556159]">Extra Adult Charges</dt>
              <dd className="font-medium">{formatInr(booking.extraAdultTotal)}</dd>
            </div>
            <div className="flex justify-between border-b border-[#F2F4F0] pb-2">
              <dt className="text-[#556159]">Child (5–12 Yrs) Charges</dt>
              <dd className="font-medium">{formatInr(booking.childTotal)}</dd>
            </div>
            {booking.gstAmount > 0 && (
              <div className="flex justify-between border-b border-[#F2F4F0] pb-2">
                <dt className="text-[#556159]">Taxes / GST</dt>
                <dd className="font-medium">{formatInr(booking.gstAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between pt-1 text-base font-bold text-[#1B4332]">
              <dt>Total Amount</dt>
              <dd className="font-[family-name:var(--font-mono)]">{formatInr(booking.totalAmount)}</dd>
            </div>
            {booking.upiUtr && (
              <div className="flex justify-between pt-1 text-xs text-[#556159]">
                <dt>UPI UTR Reference</dt>
                <dd className="font-[family-name:var(--font-mono)] font-semibold text-[#141C17]">
                  {booking.upiUtr}
                </dd>
              </div>
            )}
            {booking.razorpayPaymentId && (
              <div className="flex justify-between pt-1 text-xs text-[#556159]">
                <dt>Razorpay Payment ID</dt>
                <dd className="font-[family-name:var(--font-mono)] font-semibold text-[#141C17]">
                  {booking.razorpayPaymentId}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {booking.specialRequests && (
        <div className="mt-5 rounded-lg bg-[#F2F4F0] px-4 py-3 text-sm text-[#141C17]">
          <span className="font-semibold">Guest Special Requests:</span> {booking.specialRequests}
        </div>
      )}

      <div className="mt-6 border-t border-[#E4E4E0] pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#556159]">
        <div className="flex flex-wrap items-center gap-4">
          {estate && (
            <>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {estate.location}
              </span>
              <span className="inline-flex items-center gap-1">
                <Plane className="h-3.5 w-3.5" /> {estate.distanceFromAirport}
              </span>
              <span className="inline-flex items-center gap-1">
                <Train className="h-3.5 w-3.5" /> {estate.nearestStation}
              </span>
            </>
          )}
        </div>
        <div>
          Desk Support: {settings?.supportPhone || '+91 95839 36626'} ·{' '}
          {settings?.supportEmail || 'sales@nightingaletea.in'}
        </div>
      </div>
    </div>
  );
}

export function TrackBookingSection() {
  const [refInput, setRefInput] = React.useState('');
  const [contactInput, setContactInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    booking: Booking;
    estate: Estate | null;
    settings: SystemSettings | null;
  } | null>(null);

  const performLookup = async (ref: string, contact: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ ref: ref.trim(), contact: contact.trim() });
      const res = await fetch(`/api/bookings?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(data.error || 'Reservation not found.');
        return;
      }
      setResult(data);
    } catch {
      setError('Network error while checking reservation status.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(refInput, contactInput);
  };

  return (
    <section className="mx-auto max-w-[1000px] px-4 sm:px-6 py-10 space-y-6">
      <div className="rounded-xl border border-[#E4E4E0] bg-white p-6 sm:p-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold text-[#141C17]">
          Track Your Reservation &amp; Download Receipt
        </h1>
        <p className="mt-2 text-sm text-[#556159]">
          Enter your unique Booking Reference ID (e.g., <span className="font-[family-name:var(--font-mono)]">NTT-2026-1001</span>) to verify confirmation status or print your estate check-in pass.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="track-ref" className="block text-xs font-semibold text-[#556159] mb-1.5">
              Booking Reference ID
            </label>
            <input
              id="track-ref"
              type="text"
              required
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="NTT-2026-1001"
              className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2.5 text-sm font-[family-name:var(--font-mono)] uppercase focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
            />
          </div>
          <div>
            <label htmlFor="track-contact" className="block text-xs font-semibold text-[#556159] mb-1.5">
              Phone or Email (Optional)
            </label>
            <input
              id="track-contact"
              type="text"
              value={contactInput}
              onChange={(e) => setContactInput(e.target.value)}
              placeholder="9830112233"
              className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B4332] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#143326] disabled:opacity-60 cursor-pointer"
            >
              <Search className="h-4 w-4" />
              {loading ? 'Searching...' : 'Look Up Reservation'}
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#556159]">
          <span>Sample records:</span>
          <button
            type="button"
            onClick={() => {
              setRefInput('NTT-2026-1001');
              setContactInput('9830112233');
              performLookup('NTT-2026-1001', '9830112233');
            }}
            className="underline hover:text-[#1B4332] cursor-pointer font-[family-name:var(--font-mono)]"
          >
            NTT-2026-1001 (Razorpay Confirmed)
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => {
              setRefInput('NTT-2026-1003');
              setContactInput('9874556611');
              performLookup('NTT-2026-1003', '9874556611');
            }}
            className="underline hover:text-[#1B4332] cursor-pointer font-[family-name:var(--font-mono)]"
          >
            NTT-2026-1003 (Manual UPI Pending)
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
            {error}
          </div>
        )}
      </div>

      {result && (
        <DigitalReceiptCard
          booking={result.booking}
          estate={result.estate}
          settings={result.settings}
        />
      )}
    </section>
  );
}
