import { NextResponse } from 'next/server';
import {
  addDaysIso,
  enumerateStayNights,
  formatIsoDateUtc,
  getEstateTotalRooms,
} from '@/lib/booking-engine';
import { readDb } from '@/lib/store';

export async function GET() {
  const db = await readDb();
  const today = formatIsoDateUtc(new Date());
  const monthPrefix = today.slice(0, 7);

  const checkinsToday = db.bookings.filter(
    (b) => b.checkIn === today && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN')
  ).length;
  const checkoutsToday = db.bookings.filter(
    (b) => b.checkOut === today && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN')
  ).length;
  const pendingVerifications = db.bookings.filter(
    (b) => b.status === 'PENDING_VERIFICATION'
  ).length;

  const confirmedBookings = db.bookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN'
  );
  const confirmedRevenue = confirmedBookings.reduce((s, b) => s + b.totalAmount, 0);
  const razorpayRevenue = confirmedBookings
    .filter((b) => b.paymentMethod === 'RAZORPAY')
    .reduce((s, b) => s + b.totalAmount, 0);
  const manualUpiRevenue = confirmedBookings
    .filter((b) => b.paymentMethod === 'MANUAL_UPI')
    .reduce((s, b) => s + b.totalAmount, 0);

  const totalRoomsCap = db.estates
    .filter((e) => e.isActive)
    .reduce((s, e) => s + getEstateTotalRooms(e), 0);
  let bookedRoomNightsThisMonth = 0;
  for (const b of confirmedBookings) {
    try {
      const nights = enumerateStayNights(b.checkIn, b.checkOut);
      for (const n of nights) {
        if (n.startsWith(monthPrefix)) {
          bookedRoomNightsThisMonth += b.roomsCount;
        }
      }
    } catch {
      // ignore invalid legacy dates
    }
  }
  const monthlyCapacity = totalRoomsCap * 30;
  const monthlyOccupancyPct =
    monthlyCapacity > 0
      ? Math.min(100, Number(((bookedRoomNightsThisMonth / monthlyCapacity) * 100).toFixed(1)))
      : 0;

  // Next 14-day quick summary
  const next14Start = today;
  const next14End = addDaysIso(today, 14);

  return NextResponse.json({
    kpis: {
      today,
      checkinsToday,
      checkoutsToday,
      pendingVerifications,
      confirmedRevenue,
      razorpayRevenue,
      manualUpiRevenue,
      monthlyOccupancyPct,
      totalBookings: db.bookings.length,
    },
    estates: db.estates,
    bookings: db.bookings,
    overrides: db.overrides,
    settings: db.settings,
    auditLogs: db.auditLogs.slice(0, 40),
    window: { next14Start, next14End },
  });
}
