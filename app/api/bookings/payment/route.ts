import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { mutateDb } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || '');
    const bookingRef = String(body.bookingRef || '').trim().toUpperCase();

    if (!bookingRef) {
      return NextResponse.json({ error: 'Booking Reference ID is required.' }, { status: 422 });
    }

    const updated = await mutateDb((draft) => {
      const booking = draft.bookings.find((b) => b.bookingRef === bookingRef);
      if (!booking) {
        throw new Error('Booking not found.');
      }
      if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') {
        throw new Error('This booking has expired or been cancelled.');
      }

      const nowIso = new Date().toISOString();

      if (action === 'SUBMIT_UPI') {
        const utr = String(body.utr || '').trim().toUpperCase();
        if (utr.length < 8) {
          throw new Error('Please enter a valid UTR / UPI Transaction Reference (min 8 characters).');
        }
        booking.upiUtr = utr;
        if (body.proofDataUrl) {
          booking.upiProofDataUrl = String(body.proofDataUrl);
          booking.upiProofFileName = String(body.proofFileName || 'upi-receipt.png');
        }
        booking.status = 'PENDING_VERIFICATION';
        booking.holdExpiresAt = null;
        booking.updatedAt = nowIso;

        draft.auditLogs.unshift({
          id: `aud-${Date.now()}`,
          actor: `GUEST:${booking.guestPhone}`,
          action: 'UPI_UTR_SUBMITTED',
          targetRef: bookingRef,
          details: `Submitted Manual UPI UTR ${utr}${booking.upiProofFileName ? ' with payment proof' : ''}.`,
          createdAt: nowIso,
        });
        return booking;
      }

      if (action === 'VERIFY_RAZORPAY') {
        const paymentId = String(body.razorpayPaymentId || `pay_${crypto.randomBytes(6).toString('hex')}`);
        const orderId = String(body.razorpayOrderId || booking.razorpayOrderId || '');
        const signature = String(body.razorpaySignature || '');

        const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
        if (keySecret && signature && orderId) {
          const expected = crypto
            .createHmac('sha256', keySecret)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');
          if (expected !== signature) {
            throw new Error('Invalid Razorpay HMAC-SHA256 signature.');
          }
        }

        booking.razorpayOrderId = orderId;
        booking.razorpayPaymentId = paymentId;
        booking.status = 'CONFIRMED';
        booking.holdExpiresAt = null;
        booking.updatedAt = nowIso;

        draft.auditLogs.unshift({
          id: `aud-${Date.now()}`,
          actor: 'RAZORPAY_GATEWAY',
          action: 'PAYMENT_CONFIRMED',
          targetRef: bookingRef,
          details: `Auto-confirmed via Razorpay Payment ID ${paymentId}.`,
          createdAt: nowIso,
        });
        return booking;
      }

      throw new Error('Unsupported payment action.');
    });

    return NextResponse.json({ booking: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Payment update failed.' },
      { status: 422 }
    );
  }
}
