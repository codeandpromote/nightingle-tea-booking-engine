import { NextResponse } from 'next/server';
import { escapeCsvCell } from '@/lib/booking-engine';
import { readDb } from '@/lib/store';

export async function GET() {
  const db = await readDb();
  const headers = [
    'Booking Ref',
    'Estate',
    'Check-In',
    'Check-Out',
    'Nights',
    'Rooms',
    'Adults',
    'Child (5-12)',
    'Kids (<5 Free)',
    'Meal Plan',
    'Guest Name',
    'Phone',
    'Email',
    'City',
    'ID Proof',
    'Payment Mode',
    'Status',
    'UPI UTR',
    'Razorpay Payment ID',
    'Total INR',
    'Channel',
    'Created At',
  ];

  const rows = db.bookings.map((b) =>
    [
      b.bookingRef,
      b.estateName,
      b.checkIn,
      b.checkOut,
      b.nights,
      b.roomsCount,
      b.adults,
      b.children5to12,
      b.childrenUnder5,
      b.mealPlan,
      b.guestName,
      b.guestPhone,
      b.guestEmail,
      b.guestCity,
      b.idProofType || '',
      b.paymentMethod,
      b.status,
      b.upiUtr || '',
      b.razorpayPaymentId || '',
      b.totalAmount,
      b.sourceChannel,
      b.createdAt,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  const csv = [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="nightingale-guest-manifest-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
