import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  buildUpiPaymentUri,
  calculateBookingTariff,
  generateBookingReference,
  validateStayAvailability,
  type MealPlan,
  type PaymentMethod,
} from '@/lib/booking-engine';
import { mutateDb, readDb } from '@/lib/store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ref = (searchParams.get('ref') || '').trim().toUpperCase();
  const contact = (searchParams.get('contact') || '').trim().toLowerCase();

  if (!ref) {
    return NextResponse.json({ error: 'Booking Reference ID is required.' }, { status: 400 });
  }

  const db = await readDb();
  const booking = db.bookings.find((b) => {
    if (b.bookingRef.toUpperCase() !== ref) return false;
    if (!contact) return true;
    return (
      b.guestPhone.toLowerCase().includes(contact) ||
      b.guestEmail.toLowerCase() === contact
    );
  });

  if (!booking) {
    return NextResponse.json(
      { error: 'No reservation found matching that Reference ID and contact.' },
      { status: 404 }
    );
  }

  const estate = db.estates.find((e) => e.id === booking.estateId) || null;
  return NextResponse.json({ booking, estate, settings: db.settings });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const estateSlug = String(body.estateSlug || '');
    const roomTypeId = body.roomTypeId ? String(body.roomTypeId) : undefined;
    const checkIn = String(body.checkIn || '');
    const checkOut = String(body.checkOut || '');
    const roomsCount = Number(body.roomsCount || 1);
    const adults = Number(body.adults || 2);
    const children5to12 = Number(body.children5to12 || 0);
    const childrenUnder5 = Number(body.childrenUnder5 || 0);
    const mealPlan = (body.mealPlan || 'MAP') as MealPlan;
    const paymentMethod = (body.paymentMethod || 'MANUAL_UPI') as PaymentMethod;
    const guestName = String(body.guestName || '').trim();
    const guestPhone = String(body.guestPhone || '').trim();
    const guestEmail = String(body.guestEmail || '').trim();
    const guestCity = String(body.guestCity || '').trim();
    const idProofType = String(body.idProofType || '').trim();
    const specialRequests = String(body.specialRequests || '').trim();
    const sourceChannel = body.sourceChannel === 'MAIN_SITE_LINK' ? 'MAIN_SITE_LINK' : 'PORTAL';

    if (!guestName || !guestPhone || !guestEmail) {
      return NextResponse.json(
        { error: 'Guest name, phone number, and email address are required.' },
        { status: 422 }
      );
    }

    const result = await mutateDb(async (draft) => {
      const nowIso = new Date().toISOString();
      const estate = draft.estates.find((e) => e.slug === estateSlug || e.id === estateSlug);
      if (!estate) {
        throw new Error('Selected tea estate not found.');
      }

      const roomCategory = roomTypeId
        ? estate.roomCategories?.find((r) => r.id === roomTypeId)
        : undefined;

      const availability = validateStayAvailability(
        estate,
        checkIn,
        checkOut,
        roomsCount,
        draft.bookings,
        draft.overrides,
        nowIso,
        roomCategory?.id || roomTypeId
      );
      if (!availability.valid) {
        throw new Error(availability.reason || 'Selected dates are unavailable.');
      }

      const tariff = calculateBookingTariff({
        estate,
        roomCategory,
        checkIn,
        checkOut,
        roomsCount,
        adults,
        children5to12,
        childrenUnder5,
        mealPlan,
        overrides: draft.overrides,
        gstPercentage: draft.settings.gstPercentage,
      });

      const seq = draft.nextBookingSeq++;
      const bookingRef = generateBookingReference(seq, 2026);
      const holdMinutes = paymentMethod === 'RAZORPAY' ? 15 : draft.settings.holdTtlMinutes;
      const holdExpiresAt = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString();

      let razorpayOrderId: string | undefined;
      if (paymentMethod === 'RAZORPAY') {
        const keyId = process.env.RAZORPAY_KEY_ID || draft.settings.razorpayKeyId;
        const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
        if (keyId && keySecret) {
          const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
          const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: tariff.totalAmount * 100,
              currency: 'INR',
              receipt: bookingRef,
            }),
          });
          if (rzpRes.ok) {
            const rzpJson = (await rzpRes.json()) as { id?: string };
            razorpayOrderId = rzpJson.id;
          }
        }
        if (!razorpayOrderId) {
          razorpayOrderId = `order_${crypto.randomBytes(6).toString('hex')}`;
        }
      }

      const roomLabel = roomCategory ? roomCategory.name : estate.accommodationType;
      const booking = {
        id: `bk-${seq}`,
        bookingRef,
        estateId: estate.id,
        estateName: estate.name,
        roomTypeId: roomCategory?.id,
        roomTypeName: roomCategory?.name,
        roomSummary: `${roomsCount} × ${roomLabel} · ${mealPlan === 'ALL_MEALS' ? 'All Meals' : 'MAP'}`,
        checkIn,
        checkOut,
        nights: tariff.nights,
        roomsCount,
        adults,
        children5to12,
        childrenUnder5,
        mealPlan,
        guestName,
        guestPhone,
        guestEmail,
        guestCity,
        idProofType,
        specialRequests,
        baseRoomTotal: tariff.baseRoomTotal,
        extraAdultTotal: tariff.extraAdultTotal,
        childTotal: tariff.childTotal,
        gstAmount: tariff.gstAmount,
        totalAmount: tariff.totalAmount,
        paymentMethod,
        status: 'AWAITING_PAYMENT' as const,
        razorpayOrderId,
        holdExpiresAt,
        sourceChannel: sourceChannel as 'PORTAL' | 'MAIN_SITE_LINK',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      draft.bookings.unshift(booking);
      draft.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actor: `GUEST:${guestPhone}`,
        action: 'BOOKING_CREATED',
        targetRef: bookingRef,
        details: `Created ${paymentMethod} hold for ${estate.name} (${checkIn} to ${checkOut}), ₹${tariff.totalAmount}`,
        createdAt: nowIso,
      });

      const upiUri = buildUpiPaymentUri({
        upiId: draft.settings.upiId,
        merchantName: draft.settings.upiMerchantName,
        amountInr: tariff.totalAmount,
        bookingRef,
      });

      return { booking, tariff, upiUri, settings: draft.settings };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to create booking.' },
      { status: 422 }
    );
  }
}
