import { NextRequest, NextResponse } from 'next/server';
import {
  addDaysIso,
  calculateBookingTariff,
  generateBookingReference,
  getEstateTotalRooms,
  parseIsoDateUtc,
  validateStayAvailability,
  type MealPlan,
  type PaymentMethod,
} from '@/lib/booking-engine';
import { mutateDb } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = String(body.type || '');
    const actor = String(body.actor || 'ADMIN:director');

    const out = await mutateDb((draft) => {
      const nowIso = new Date().toISOString();

      if (type === 'BOOKING_STATUS') {
        const bookingRef = String(body.bookingRef || '').toUpperCase();
        const action = String(body.action || '');
        const notes = String(body.adminNotes || '');
        const booking = draft.bookings.find((b) => b.bookingRef === bookingRef);
        if (!booking) throw new Error('Booking not found.');

        if (action === 'APPROVE_UPI') {
          booking.status = 'CONFIRMED';
          booking.holdExpiresAt = null;
        } else if (action === 'MARK_CHECKED_IN') {
          booking.status = 'CHECKED_IN';
        } else if (action === 'CANCEL') {
          booking.status = 'CANCELLED';
          booking.holdExpiresAt = null;
        } else {
          throw new Error('Unknown booking action.');
        }

        if (notes) booking.adminNotes = notes;
        booking.updatedAt = nowIso;

        draft.auditLogs.unshift({
          id: `aud-${Date.now()}`,
          actor,
          action,
          targetRef: bookingRef,
          details: `Updated status to ${booking.status}${notes ? ` (${notes})` : ''}.`,
          createdAt: nowIso,
        });
        return { booking };
      }

      if (type === 'CREATE_MANUAL_BOOKING') {
        const estate = draft.estates.find((e) => e.id === body.estateId || e.slug === body.estateSlug);
        if (!estate) throw new Error('Estate not found.');
        const roomTypeId = body.roomTypeId ? String(body.roomTypeId) : undefined;
        const roomCategory = roomTypeId
          ? estate.roomCategories?.find((r) => r.id === roomTypeId)
          : undefined;
        const checkIn = String(body.checkIn);
        const checkOut = String(body.checkOut);
        const roomsCount = Number(body.roomsCount || 1);
        const adults = Number(body.adults || 2);
        const children5to12 = Number(body.children5to12 || 0);
        const childrenUnder5 = Number(body.childrenUnder5 || 0);
        const mealPlan = (body.mealPlan || 'MAP') as MealPlan;
        const paymentMethod = (body.paymentMethod || 'MANUAL_UPI') as PaymentMethod;

        const avail = validateStayAvailability(
          estate,
          checkIn,
          checkOut,
          roomsCount,
          draft.bookings,
          draft.overrides,
          nowIso,
          roomCategory?.id
        );
        if (!avail.valid) throw new Error(avail.reason || 'Dates unavailable.');

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
          guestName: String(body.guestName || '').trim(),
          guestPhone: String(body.guestPhone || '').trim(),
          guestEmail: String(body.guestEmail || '').trim(),
          guestCity: String(body.guestCity || '').trim(),
          specialRequests: String(body.specialRequests || '').trim(),
          baseRoomTotal: tariff.baseRoomTotal,
          extraAdultTotal: tariff.extraAdultTotal,
          childTotal: tariff.childTotal,
          gstAmount: tariff.gstAmount,
          totalAmount: tariff.totalAmount,
          paymentMethod,
          status: 'CONFIRMED' as const,
          upiUtr: String(body.upiUtr || 'DESK-SETTLED'),
          holdExpiresAt: null,
          sourceChannel: 'ADMIN_MANUAL' as const,
          adminNotes: 'Created directly from Admin Console',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        draft.bookings.unshift(booking);
        draft.auditLogs.unshift({
          id: `aud-${Date.now()}`,
          actor,
          action: 'MANUAL_BOOKING_CREATED',
          targetRef: bookingRef,
          details: `Created confirmed desk booking for ${booking.guestName} at ${estate.name}.`,
          createdAt: nowIso,
        });
        return { booking };
      }

      if (type === 'INVENTORY_OVERRIDE') {
        const estateId = String(body.estateId || '');
        const startDate = String(body.startDate || '');
        const endDate = String(body.endDate || startDate);
        const isBlocked = Boolean(body.isBlocked);
        const blockReason = String(body.blockReason || '').trim();
        const customTotalRooms =
          body.customTotalRooms !== '' && body.customTotalRooms !== null && body.customTotalRooms !== undefined
            ? Number(body.customTotalRooms)
            : null;
        const minStay = Math.max(1, Number(body.minStay || 1));
        const mapRateOverride =
          body.mapRateOverride !== '' && body.mapRateOverride !== null && body.mapRateOverride !== undefined
            ? Number(body.mapRateOverride)
            : null;
        const allMealsRateOverride =
          body.allMealsRateOverride !== '' && body.allMealsRateOverride !== null && body.allMealsRateOverride !== undefined
            ? Number(body.allMealsRateOverride)
            : null;

        const s = parseIsoDateUtc(startDate);
        const e = parseIsoDateUtc(endDate);
        const span = Math.min(31, Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000)));

        for (let i = 0; i <= span; i++) {
          const d = addDaysIso(startDate, i);
          const idx = draft.overrides.findIndex((o) => o.estateId === estateId && o.date === d);
          const nextOv = {
            id: idx >= 0 ? draft.overrides[idx].id : `ov-${estateId}-${d}`,
            estateId,
            date: d,
            isBlocked,
            blockReason: blockReason || undefined,
            customTotalRooms,
            minStay,
            mapRateOverride,
            allMealsRateOverride,
          };
          if (idx >= 0) {
            draft.overrides[idx] = nextOv;
          } else {
            draft.overrides.push(nextOv);
          }
        }

        draft.auditLogs.unshift({
          id: `aud-${Date.now()}`,
          actor,
          action: 'INVENTORY_OVERRIDE',
          targetRef: estateId,
          details: `Updated ${startDate}${endDate !== startDate ? `..${endDate}` : ''}: ${isBlocked ? 'BLOCKED' : 'OPEN'}, minStay=${minStay}${mapRateOverride ? `, MAP=₹${mapRateOverride}` : ''}`,
          createdAt: nowIso,
        });
        return { saved: true };
      }

      if (type === 'UPDATE_ESTATE_TARIFF') {
        const estate = draft.estates.find((e) => e.id === body.estateId);
        if (!estate) throw new Error('Estate not found.');
        estate.totalRooms = Math.max(1, Number(body.totalRooms ?? estate.totalRooms));
        estate.mapBaseRate = Math.max(1000, Number(body.mapBaseRate ?? estate.mapBaseRate));
        estate.allMealsBaseRate = Math.max(1000, Number(body.allMealsBaseRate ?? estate.allMealsBaseRate));
        estate.extraAdultMapRate = Math.max(0, Number(body.extraAdultMapRate ?? estate.extraAdultMapRate));
        estate.extraAdultAllMealsRate = Math.max(0, Number(body.extraAdultAllMealsRate ?? estate.extraAdultAllMealsRate));
        estate.child5to12MapRate = Math.max(0, Number(body.child5to12MapRate ?? estate.child5to12MapRate));
        estate.child5to12AllMealsRate = Math.max(0, Number(body.child5to12AllMealsRate ?? estate.child5to12AllMealsRate));
        estate.isActive = body.isActive !== undefined ? Boolean(body.isActive) : estate.isActive;

        draft.auditLogs.unshift({
          id: `aud-${Date.now()}`,
          actor,
          action: 'ESTATE_TARIFF_UPDATED',
          targetRef: estate.slug,
          details: `Updated ${estate.name}: MAP ₹${estate.mapBaseRate}, All Meals ₹${estate.allMealsBaseRate}, Rooms ${estate.totalRooms}.`,
          createdAt: nowIso,
        });
        return { estate };
      }

      if (type === 'UPDATE_SETTINGS') {
        draft.settings = {
          ...draft.settings,
          upiId: String(body.upiId ?? draft.settings.upiId).trim(),
          upiMerchantName: String(body.upiMerchantName ?? draft.settings.upiMerchantName).trim(),
          holdTtlMinutes: Math.max(10, Number(body.holdTtlMinutes ?? draft.settings.holdTtlMinutes)),
          gstPercentage: Math.max(0, Math.min(28, Number(body.gstPercentage ?? draft.settings.gstPercentage))),
          razorpayEnabled: body.razorpayEnabled !== undefined ? Boolean(body.razorpayEnabled) : draft.settings.razorpayEnabled,
          manualUpiEnabled: body.manualUpiEnabled !== undefined ? Boolean(body.manualUpiEnabled) : draft.settings.manualUpiEnabled,
        };
        draft.auditLogs.unshift({
          id: `aud-${Date.now()}`,
          actor,
          action: 'SETTINGS_UPDATED',
          targetRef: 'SYSTEM',
          details: `Updated UPI VPA (${draft.settings.upiId}), Hold TTL (${draft.settings.holdTtlMinutes}m), GST (${draft.settings.gstPercentage}%).`,
          createdAt: nowIso,
        });
        return { settings: draft.settings };
      }

      if (type === 'UPDATE_ROOM_INVENTORY') {
        const estate = draft.estates.find((e) => e.id === body.estateId || e.slug === body.estateSlug);
        if (!estate) throw new Error('Estate not found.');
        const roomCategoryId = String(body.roomCategoryId || '');
        const rc = estate.roomCategories?.find((r) => r.id === roomCategoryId);
        if (!rc) throw new Error('Room category not found.');

        if (body.name !== undefined) {
          const cleanName = String(body.name).trim();
          if (cleanName) rc.name = cleanName;
        }
        if (body.bedType !== undefined) {
          rc.bedType = String(body.bedType).trim() || rc.bedType;
        }
        if (body.totalUnits !== undefined) {
          rc.totalUnits = Math.max(0, Math.min(30, Number(body.totalUnits)));
        }
        if (body.unitLabels !== undefined) {
          const labels = Array.isArray(body.unitLabels)
            ? body.unitLabels.map((s: unknown) => String(s).trim()).filter(Boolean)
            : String(body.unitLabels)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
          rc.unitLabels = labels;
        }
        if (body.mapRate !== undefined) {
          rc.mapRate = Math.max(1000, Number(body.mapRate));
        }
        if (body.allMealsRate !== undefined) {
          rc.allMealsRate = Math.max(1000, Number(body.allMealsRate));
        }
        if (body.isActive !== undefined) {
          rc.isActive = Boolean(body.isActive);
        }

        estate.totalRooms = getEstateTotalRooms(estate);

        draft.auditLogs.unshift({
          id: `aud-${Date.now()}`,
          actor,
          action: 'ROOM_INVENTORY_UPDATED',
          targetRef: rc.id,
          details: `Updated ${estate.name} · ${rc.name}: ${rc.totalUnits} unit(s), MAP ₹${rc.mapRate}, All Meals ₹${rc.allMealsRate}, status=${rc.isActive ? 'ACTIVE' : 'OUT_OF_SERVICE'}. Estate total=${estate.totalRooms} rooms.`,
          createdAt: nowIso,
        });

        return { estate, roomCategory: rc };
      }

      if (type === 'ADD_ROOM_CATEGORY') {
        const estate = draft.estates.find((e) => e.id === body.estateId || e.slug === body.estateSlug);
        if (!estate) throw new Error('Estate not found.');
        const name = String(body.name || '').trim();
        if (!name) throw new Error('Room category name is required.');
        const totalUnits = Math.max(1, Math.min(30, Number(body.totalUnits || 1)));
        const mapRate = Math.max(1000, Number(body.mapRate || estate.mapBaseRate));
        const allMealsRate = Math.max(1000, Number(body.allMealsRate || estate.allMealsBaseRate));
        const bedType = String(body.bedType || 'King Bed · Tea Garden View').trim();
        const rawLabels = String(body.unitLabels || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        const newRc = {
          id: `rm-${estate.slug}-${Date.now().toString(36)}`,
          estateId: estate.id,
          name,
          unitLabels:
            rawLabels.length > 0
              ? rawLabels
              : Array.from({ length: totalUnits }, (_, idx) => `${estate.slug.slice(0, 1).toUpperCase()}-${401 + idx}`),
          totalUnits,
          mapRate,
          allMealsRate,
          bedType,
          isActive: true,
        };
        if (!estate.roomCategories) estate.roomCategories = [];
        estate.roomCategories.push(newRc);
        estate.totalRooms = getEstateTotalRooms(estate);

        draft.auditLogs.unshift({
          id: `aud-${Date.now()}`,
          actor,
          action: 'ROOM_CATEGORY_ADDED',
          targetRef: newRc.id,
          details: `Added ${name} (${totalUnits} units) to ${estate.name}. Estate total=${estate.totalRooms} rooms.`,
          createdAt: nowIso,
        });

        return { estate, roomCategory: newRc };
      }

      throw new Error('Unknown admin action type.');
    });

    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Admin operation failed.' },
      { status: 422 }
    );
  }
}
