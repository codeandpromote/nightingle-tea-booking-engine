export type MealPlan = 'MAP' | 'ALL_MEALS';

export type PaymentMethod = 'RAZORPAY' | 'MANUAL_UPI';

export type BookingStatus =
  | 'AWAITING_PAYMENT'
  | 'PENDING_VERIFICATION'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CANCELLED'
  | 'EXPIRED';

export interface RoomCategory {
  id: string;
  estateId: string;
  name: string;
  unitLabels: string[];
  totalUnits: number;
  mapRate: number;
  allMealsRate: number;
  bedType: string;
  isActive: boolean;
}

export interface Estate {
  id: string;
  slug: 'mateli' | 'jainti' | 'chuapara' | string;
  name: string;
  subtitle: string;
  location: string;
  distanceFromAirport: string;
  nearestStation: string;
  accommodationType: string;
  totalRooms: number;
  roomCategories?: RoomCategory[];
  maxAdultsPerRoom: number;
  maxChildrenPerRoom: number;
  mapBaseRate: number;
  allMealsBaseRate: number;
  extraAdultMapRate: number;
  extraAdultAllMealsRate: number;
  child5to12MapRate: number;
  child5to12AllMealsRate: number;
  amenities: string[];
  nearbyAttractions: string[];
  imageUrl: string;
  isActive: boolean;
}

export interface InventoryOverride {
  id: string;
  estateId: string;
  date: string; // YYYY-MM-DD
  isBlocked: boolean;
  blockReason?: string;
  customTotalRooms?: number | null;
  minStay?: number;
  mapRateOverride?: number | null;
  allMealsRateOverride?: number | null;
}

export interface Booking {
  id: string;
  bookingRef: string;
  estateId: string;
  estateName: string;
  roomTypeId?: string;
  roomTypeName?: string;
  roomSummary: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  nights: number;
  roomsCount: number;
  adults: number;
  children5to12: number;
  childrenUnder5: number;
  mealPlan: MealPlan;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  guestCity: string;
  idProofType?: string;
  specialRequests?: string;
  baseRoomTotal: number;
  extraAdultTotal: number;
  childTotal: number;
  gstAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: BookingStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  upiUtr?: string;
  upiProofDataUrl?: string;
  upiProofFileName?: string;
  holdExpiresAt?: string | null;
  sourceChannel: 'PORTAL' | 'MAIN_SITE_LINK' | 'ADMIN_MANUAL';
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  targetRef: string;
  details: string;
  createdAt: string;
}

export interface SystemSettings {
  brandName: string;
  primaryDomain: string;
  bookingSubdomain: string;
  upiId: string;
  upiMerchantName: string;
  holdTtlMinutes: number;
  gstPercentage: number;
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  manualUpiEnabled: boolean;
  supportPhone: string;
  supportEmail: string;
}

export interface DailyAvailability {
  date: string;
  totalRooms: number;
  bookedRooms: number;
  heldRooms: number;
  availableRooms: number;
  isBlocked: boolean;
  blockReason?: string;
  minStay: number;
  effectiveMapRate: number;
  effectiveAllMealsRate: number;
}

export interface TariffBreakdown {
  nights: number;
  nightDates: string[];
  roomsCount: number;
  includedAdults: number;
  extraAdults: number;
  children5to12: number;
  childrenUnder5: number;
  mealPlan: MealPlan;
  nightlyRoomRates: { date: string; ratePerRoom: number; subtotal: number }[];
  baseRoomTotal: number;
  extraAdultRatePerNight: number;
  extraAdultTotal: number;
  childRatePerNight: number;
  childTotal: number;
  subtotal: number;
  gstPercentage: number;
  gstAmount: number;
  totalAmount: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDateUtc(dateStr: string): Date {
  if (!DATE_RE.test(dateStr)) {
    throw new Error(`Invalid date format "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new Error(`Calendar date "${dateStr}" does not exist.`);
  }
  return dt;
}

export function formatIsoDateUtc(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(dateStr: string, days: number): string {
  const dt = parseIsoDateUtc(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatIsoDateUtc(dt);
}

export function enumerateStayNights(checkIn: string, checkOut: string): string[] {
  const start = parseIsoDateUtc(checkIn);
  const end = parseIsoDateUtc(checkOut);
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (diffDays <= 0) {
    throw new Error('Check-out date must be at least 1 night after check-in.');
  }
  if (diffDays > 30) {
    throw new Error('Maximum online stay length is 30 nights. Contact estate desk for longer stays.');
  }
  const nights: string[] = [];
  for (let i = 0; i < diffDays; i++) {
    nights.push(addDaysIso(checkIn, i));
  }
  return nights;
}

export function isBookingOccupyingInventory(
  booking: Pick<Booking, 'status' | 'holdExpiresAt'>,
  nowIso: string
): boolean {
  if (booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN') {
    return true;
  }
  if (
    booking.status === 'PENDING_VERIFICATION' ||
    booking.status === 'AWAITING_PAYMENT'
  ) {
    if (!booking.holdExpiresAt) {
      return booking.status === 'PENDING_VERIFICATION';
    }
    return new Date(booking.holdExpiresAt).getTime() > new Date(nowIso).getTime();
  }
  return false;
}

export function getEstateTotalRooms(estate: Estate): number {
  if (estate.roomCategories && estate.roomCategories.length > 0) {
    return estate.roomCategories
      .filter((rc) => rc.isActive)
      .reduce((sum, rc) => sum + Math.max(0, rc.totalUnits), 0);
  }
  return Math.max(0, estate.totalRooms);
}

export interface RoomCategoryAvailability {
  roomCategory: RoomCategory;
  availableUnits: number;
  bookedUnits: number;
  heldUnits: number;
}

export interface StaySearchSummary {
  estate: Estate;
  nights: number;
  minAvailableRooms: number;
  maxTotalRooms: number;
  isBlocked: boolean;
  blockReason?: string;
  minStayRequired: number;
  categoryAvailability: RoomCategoryAvailability[];
}

export function computeDailyAvailability(
  estate: Estate,
  startDate: string,
  days: number,
  bookings: Booking[],
  overrides: InventoryOverride[],
  nowIso: string
): DailyAvailability[] {
  const overrideMap = new Map<string, InventoryOverride>();
  for (const ov of overrides) {
    if (ov.estateId === estate.id) {
      overrideMap.set(ov.date, ov);
    }
  }

  const estateBookings = bookings.filter(
    (b) => b.estateId === estate.id && isBookingOccupyingInventory(b, nowIso)
  );
  const baseEstateRooms = getEstateTotalRooms(estate);

  const result: DailyAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysIso(startDate, i);
    const ov = overrideMap.get(date);
    const totalRooms =
      ov?.customTotalRooms !== undefined && ov.customTotalRooms !== null
        ? Math.max(0, ov.customTotalRooms)
        : baseEstateRooms;
    const isBlocked = Boolean(ov?.isBlocked);

    let bookedRooms = 0;
    let heldRooms = 0;
    for (const b of estateBookings) {
      if (date >= b.checkIn && date < b.checkOut) {
        if (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') {
          bookedRooms += b.roomsCount;
        } else {
          heldRooms += b.roomsCount;
        }
      }
    }

    const availableRooms = isBlocked
      ? 0
      : Math.max(0, totalRooms - bookedRooms - heldRooms);

    result.push({
      date,
      totalRooms,
      bookedRooms,
      heldRooms,
      availableRooms,
      isBlocked,
      blockReason: ov?.blockReason,
      minStay: ov?.minStay && ov.minStay > 1 ? ov.minStay : 1,
      effectiveMapRate:
        ov?.mapRateOverride !== undefined && ov.mapRateOverride !== null
          ? ov.mapRateOverride
          : estate.mapBaseRate,
      effectiveAllMealsRate:
        ov?.allMealsRateOverride !== undefined && ov.allMealsRateOverride !== null
          ? ov.allMealsRateOverride
          : estate.allMealsBaseRate,
    });
  }

  return result;
}

export function computeEstateSearchAvailability(
  estate: Estate,
  checkIn: string,
  checkOut: string,
  bookings: Booking[],
  overrides: InventoryOverride[],
  nowIso: string
): StaySearchSummary {
  const nights = enumerateStayNights(checkIn, checkOut);
  const daily = computeDailyAvailability(
    estate,
    checkIn,
    nights.length,
    bookings,
    overrides,
    nowIso
  );

  const blockedDay = daily.find((d) => d.isBlocked);
  const minAvailableRooms = daily.reduce(
    (min, d) => Math.min(min, d.availableRooms),
    Number.POSITIVE_INFINITY
  );
  const maxTotalRooms = daily.reduce((max, d) => Math.max(max, d.totalRooms), 0);
  const minStayRequired = daily[0]?.minStay || 1;

  const estateBookings = bookings.filter(
    (b) => b.estateId === estate.id && isBookingOccupyingInventory(b, nowIso)
  );

  const categoryAvailability: RoomCategoryAvailability[] = (
    estate.roomCategories || []
  ).map((rc) => {
    if (!rc.isActive || blockedDay || !estate.isActive) {
      return {
        roomCategory: rc,
        availableUnits: 0,
        bookedUnits: 0,
        heldUnits: 0,
      };
    }

    let worstBooked = 0;
    let worstHeld = 0;
    let minCatOpen = rc.totalUnits;

    for (const date of nights) {
      let catBooked = 0;
      let catHeld = 0;
      for (const b of estateBookings) {
        if (date >= b.checkIn && date < b.checkOut && b.roomTypeId === rc.id) {
          if (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') {
            catBooked += b.roomsCount;
          } else {
            catHeld += b.roomsCount;
          }
        }
      }
      worstBooked = Math.max(worstBooked, catBooked);
      worstHeld = Math.max(worstHeld, catHeld);
      const dayOpen = Math.max(0, rc.totalUnits - catBooked - catHeld);
      minCatOpen = Math.min(minCatOpen, dayOpen);
    }

    const cappedOpen = Math.min(
      minCatOpen,
      Number.isFinite(minAvailableRooms) ? minAvailableRooms : 0
    );

    return {
      roomCategory: rc,
      availableUnits: Math.max(0, cappedOpen),
      bookedUnits: worstBooked,
      heldUnits: worstHeld,
    };
  });

  return {
    estate,
    nights: nights.length,
    minAvailableRooms: Number.isFinite(minAvailableRooms) ? minAvailableRooms : 0,
    maxTotalRooms,
    isBlocked: Boolean(blockedDay),
    blockReason: blockedDay?.blockReason,
    minStayRequired,
    categoryAvailability,
  };
}

export function validateStayAvailability(
  estate: Estate,
  checkIn: string,
  checkOut: string,
  roomsRequested: number,
  bookings: Booking[],
  overrides: InventoryOverride[],
  nowIso: string,
  roomTypeId?: string
): { valid: boolean; reason?: string; nights: string[]; daily: DailyAvailability[] } {
  if (!estate.isActive) {
    return {
      valid: false,
      reason: `${estate.name} is currently closed for online reservations.`,
      nights: [],
      daily: [],
    };
  }
  if (roomsRequested < 1) {
    return { valid: false, reason: 'Select at least 1 room or cottage.', nights: [], daily: [] };
  }

  let nights: string[];
  try {
    nights = enumerateStayNights(checkIn, checkOut);
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : 'Invalid dates selected.',
      nights: [],
      daily: [],
    };
  }

  const daily = computeDailyAvailability(
    estate,
    checkIn,
    nights.length,
    bookings,
    overrides,
    nowIso
  );

  const checkInDay = daily[0];
  if (checkInDay && nights.length < checkInDay.minStay) {
    return {
      valid: false,
      reason: `Minimum stay of ${checkInDay.minStay} nights is required for check-in on ${checkIn}.`,
      nights,
      daily,
    };
  }

  for (const day of daily) {
    if (day.isBlocked) {
      return {
        valid: false,
        reason: `${estate.name} is unavailable on ${day.date}${day.blockReason ? ` (${day.blockReason})` : ''}.`,
        nights,
        daily,
      };
    }
    if (day.availableRooms < roomsRequested) {
      return {
        valid: false,
        reason: `Only ${day.availableRooms} room(s) remaining on ${day.date} at ${estate.name}.`,
        nights,
        daily,
      };
    }
  }

  if (roomTypeId && estate.roomCategories && estate.roomCategories.length > 0) {
    const rc = estate.roomCategories.find((r) => r.id === roomTypeId);
    if (!rc || !rc.isActive) {
      return {
        valid: false,
        reason: 'Selected room category is currently out of service.',
        nights,
        daily,
      };
    }
    const estateBookings = bookings.filter(
      (b) => b.estateId === estate.id && b.roomTypeId === rc.id && isBookingOccupyingInventory(b, nowIso)
    );
    for (const d of nights) {
      const usedInCategory = estateBookings
        .filter((b) => d >= b.checkIn && d < b.checkOut)
        .reduce((sum, b) => sum + b.roomsCount, 0);
      const openInCat = Math.max(0, rc.totalUnits - usedInCategory);
      if (openInCat < roomsRequested) {
        return {
          valid: false,
          reason: `Only ${openInCat} ${rc.name} unit(s) remaining on ${d}.`,
          nights,
          daily,
        };
      }
    }
  }

  return { valid: true, nights, daily };
}

export function calculateBookingTariff(params: {
  estate: Estate;
  roomCategory?: RoomCategory;
  checkIn: string;
  checkOut: string;
  roomsCount: number;
  adults: number;
  children5to12: number;
  childrenUnder5: number;
  mealPlan: MealPlan;
  overrides?: InventoryOverride[];
  gstPercentage?: number;
}): TariffBreakdown {
  const {
    estate,
    roomCategory,
    checkIn,
    checkOut,
    roomsCount,
    adults,
    children5to12,
    childrenUnder5,
    mealPlan,
    overrides = [],
    gstPercentage = 0,
  } = params;

  if (roomsCount < 1) {
    throw new Error('At least 1 room must be selected.');
  }
  if (adults < 1) {
    throw new Error('At least 1 adult guest is required.');
  }
  if (adults > roomsCount * estate.maxAdultsPerRoom) {
    throw new Error(
      `Maximum ${estate.maxAdultsPerRoom} adults allowed per room (${roomsCount * estate.maxAdultsPerRoom} total for ${roomsCount} room(s)).`
    );
  }
  if (children5to12 + childrenUnder5 > roomsCount * estate.maxChildrenPerRoom) {
    throw new Error(
      `Maximum ${estate.maxChildrenPerRoom} children allowed per room.`
    );
  }

  const nightDates = enumerateStayNights(checkIn, checkOut);
  const nights = nightDates.length;

  const overrideByDate = new Map<string, InventoryOverride>();
  for (const ov of overrides) {
    if (ov.estateId === estate.id) {
      overrideByDate.set(ov.date, ov);
    }
  }

  const baseMapRate = roomCategory ? roomCategory.mapRate : estate.mapBaseRate;
  const baseAllMealsRate = roomCategory
    ? roomCategory.allMealsRate
    : estate.allMealsBaseRate;

  const nightlyRoomRates = nightDates.map((date) => {
    const ov = overrideByDate.get(date);
    const ratePerRoom =
      mealPlan === 'MAP'
        ? ov?.mapRateOverride ?? baseMapRate
        : ov?.allMealsRateOverride ?? baseAllMealsRate;
    return {
      date,
      ratePerRoom,
      subtotal: ratePerRoom * roomsCount,
    };
  });

  const baseRoomTotal = nightlyRoomRates.reduce((sum, n) => sum + n.subtotal, 0);

  const includedAdults = roomsCount * 2;
  const extraAdults = Math.max(0, adults - includedAdults);

  const extraAdultRatePerNight =
    mealPlan === 'MAP'
      ? estate.extraAdultMapRate
      : estate.extraAdultAllMealsRate;
  const extraAdultTotal = extraAdults * extraAdultRatePerNight * nights;

  const childRatePerNight =
    mealPlan === 'MAP'
      ? estate.child5to12MapRate
      : estate.child5to12AllMealsRate;
  const childTotal = Math.max(0, children5to12) * childRatePerNight * nights;

  const subtotal = baseRoomTotal + extraAdultTotal + childTotal;
  const gstAmount = gstPercentage > 0 ? Math.round((subtotal * gstPercentage) / 100) : 0;
  const totalAmount = subtotal + gstAmount;

  return {
    nights,
    nightDates,
    roomsCount,
    includedAdults,
    extraAdults,
    children5to12,
    childrenUnder5,
    mealPlan,
    nightlyRoomRates,
    baseRoomTotal,
    extraAdultRatePerNight,
    extraAdultTotal,
    childRatePerNight,
    childTotal,
    subtotal,
    gstPercentage,
    gstAmount,
    totalAmount,
  };
}

export function buildUpiPaymentUri(params: {
  upiId: string;
  merchantName: string;
  amountInr: number;
  bookingRef: string;
}): string {
  const pa = encodeURIComponent(params.upiId.trim());
  const pn = encodeURIComponent(params.merchantName.trim());
  const am = params.amountInr.toFixed(2);
  const tn = encodeURIComponent(`Nightingale Tea Stay ${params.bookingRef}`);
  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
}

export function generateBookingReference(seqNumber: number, year = 2026): string {
  return `NTT-${year}-${String(seqNumber).padStart(4, '0')}`;
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
