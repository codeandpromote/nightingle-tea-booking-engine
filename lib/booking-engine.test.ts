import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBookingTariff,
  computeDailyAvailability,
  computeEstateSearchAvailability,
  getEstateTotalRooms,
  validateStayAvailability,
  buildUpiPaymentUri,
  escapeCsvCell,
  generateBookingReference,
  type Estate,
  type Booking,
  type InventoryOverride,
} from './booking-engine';

const mateli: Estate = {
  id: 'est-mateli',
  slug: 'mateli',
  name: 'Mateli Tea Estate',
  subtitle: 'Heritage Planter Bungalow',
  location: 'Matelli, Dooars, West Bengal',
  distanceFromAirport: '90 km from Bagdogra',
  nearestStation: 'Chalsa Junction',
  accommodationType: 'Heritage Bungalow Suites',
  totalRooms: 4,
  maxAdultsPerRoom: 3,
  maxChildrenPerRoom: 2,
  mapBaseRate: 10000,
  allMealsBaseRate: 12000,
  extraAdultMapRate: 3500,
  extraAdultAllMealsRate: 5000,
  child5to12MapRate: 3500,
  child5to12AllMealsRate: 2000,
  amenities: ['Guided Factory Visit', 'Tea Tasting'],
  nearbyAttractions: ['Chapramari', 'Samsing'],
  imageUrl: '/images/estate_mateli.jpg',
  isActive: true,
};

const chuapara: Estate = {
  id: 'est-chuapara',
  slug: 'chuapara',
  name: 'Chuapara Tea Estate',
  subtitle: 'Executive Plantation Cottages',
  location: 'Chuapara, Dooars, West Bengal',
  distanceFromAirport: '170 km from Bagdogra',
  nearestStation: 'Hamiltonganj / Kalchini',
  accommodationType: 'Executive Cottages',
  totalRooms: 5,
  maxAdultsPerRoom: 3,
  maxChildrenPerRoom: 2,
  mapBaseRate: 8000,
  allMealsBaseRate: 10000,
  extraAdultMapRate: 2500,
  extraAdultAllMealsRate: 3000,
  child5to12MapRate: 2000,
  child5to12AllMealsRate: 1500,
  amenities: ['Cottage Sit-Out', 'Power Backup'],
  nearbyAttractions: ['Buxa Tiger Reserve', 'Chilapata'],
  imageUrl: '/images/estate_chuapara.jpg',
  isActive: true,
};

test('Mateli MAP & All Meals tariff matches proposal schedule exactly', () => {
  const mapTariff = calculateBookingTariff({
    estate: mateli,
    checkIn: '2026-12-10',
    checkOut: '2026-12-12', // 2 nights
    roomsCount: 1,
    adults: 3, // 2 included + 1 extra adult
    children5to12: 1,
    childrenUnder5: 1, // complimentary
    mealPlan: 'MAP',
  });

  assert.equal(mapTariff.nights, 2);
  assert.equal(mapTariff.baseRoomTotal, 20000);
  assert.equal(mapTariff.extraAdults, 1);
  assert.equal(mapTariff.extraAdultTotal, 7000);
  assert.equal(mapTariff.childTotal, 7000);
  assert.equal(mapTariff.totalAmount, 34000);

  const allMealsTariff = calculateBookingTariff({
    estate: mateli,
    checkIn: '2026-12-10',
    checkOut: '2026-12-12',
    roomsCount: 1,
    adults: 3,
    children5to12: 1,
    childrenUnder5: 1,
    mealPlan: 'ALL_MEALS',
  });

  assert.equal(allMealsTariff.baseRoomTotal, 24000);
  assert.equal(allMealsTariff.extraAdultTotal, 10000);
  assert.equal(allMealsTariff.childTotal, 4000);
  assert.equal(allMealsTariff.totalAmount, 38000);
});

test('Chuapara tariff applies seasonal overrides and multi-room math', () => {
  const overrides: InventoryOverride[] = [
    {
      id: 'ov-1',
      estateId: 'est-chuapara',
      date: '2026-12-24',
      isBlocked: false,
      mapRateOverride: 9500,
    },
  ];
  const res = calculateBookingTariff({
    estate: chuapara,
    checkIn: '2026-12-24',
    checkOut: '2026-12-26', // 24th (override 9500) + 25th (base 8000)
    roomsCount: 2,
    adults: 4, // 0 extra adults since 2 rooms = 4 included
    children5to12: 1,
    childrenUnder5: 0,
    mealPlan: 'MAP',
    overrides,
  });

  assert.equal(res.baseRoomTotal, (9500 + 8000) * 2);
  assert.equal(res.extraAdultTotal, 0);
  assert.equal(res.childTotal, 2000 * 2);
  assert.equal(res.totalAmount, 39000);
});

test('Inventory availability tracks confirmed bookings, active UPI holds, expired holds, and blocks', () => {
  const nowIso = '2026-11-15T10:00:00.000Z';
  const bookings: Booking[] = [
    {
      id: 'b1',
      bookingRef: 'NTT-2026-1001',
      estateId: 'est-mateli',
      estateName: 'Mateli Tea Estate',
      roomSummary: '2 Rooms',
      checkIn: '2026-12-01',
      checkOut: '2026-12-03',
      nights: 2,
      roomsCount: 2,
      adults: 4,
      children5to12: 0,
      childrenUnder5: 0,
      mealPlan: 'MAP',
      guestName: 'Aarav Sen',
      guestPhone: '9830000001',
      guestEmail: 'aarav@example.com',
      guestCity: 'Kolkata',
      baseRoomTotal: 40000,
      extraAdultTotal: 0,
      childTotal: 0,
      gstAmount: 0,
      totalAmount: 40000,
      paymentMethod: 'RAZORPAY',
      status: 'CONFIRMED',
      sourceChannel: 'PORTAL',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'b2',
      bookingRef: 'NTT-2026-1002',
      estateId: 'est-mateli',
      estateName: 'Mateli Tea Estate',
      roomSummary: '1 Room',
      checkIn: '2026-12-01',
      checkOut: '2026-12-02',
      nights: 1,
      roomsCount: 1,
      adults: 2,
      children5to12: 0,
      childrenUnder5: 0,
      mealPlan: 'ALL_MEALS',
      guestName: 'Meera Das',
      guestPhone: '9830000002',
      guestEmail: 'meera@example.com',
      guestCity: 'Siliguri',
      baseRoomTotal: 12000,
      extraAdultTotal: 0,
      childTotal: 0,
      gstAmount: 0,
      totalAmount: 12000,
      paymentMethod: 'MANUAL_UPI',
      status: 'PENDING_VERIFICATION',
      holdExpiresAt: '2026-11-15T10:30:00.000Z', // active hold
      sourceChannel: 'PORTAL',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'b3',
      bookingRef: 'NTT-2026-1003',
      estateId: 'est-mateli',
      estateName: 'Mateli Tea Estate',
      roomSummary: '1 Room',
      checkIn: '2026-12-01',
      checkOut: '2026-12-02',
      nights: 1,
      roomsCount: 1,
      adults: 2,
      children5to12: 0,
      childrenUnder5: 0,
      mealPlan: 'MAP',
      guestName: 'Expired Guest',
      guestPhone: '9830000003',
      guestEmail: 'exp@example.com',
      guestCity: 'Delhi',
      baseRoomTotal: 10000,
      extraAdultTotal: 0,
      childTotal: 0,
      gstAmount: 0,
      totalAmount: 10000,
      paymentMethod: 'RAZORPAY',
      status: 'AWAITING_PAYMENT',
      holdExpiresAt: '2026-11-15T09:45:00.000Z', // expired hold should NOT occupy inventory
      sourceChannel: 'PORTAL',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const overrides: InventoryOverride[] = [
    {
      id: 'ov-block',
      estateId: 'est-mateli',
      date: '2026-12-04',
      isBlocked: true,
      blockReason: 'Private Heritage Shoot',
    },
  ];

  const daily = computeDailyAvailability(mateli, '2026-12-01', 4, bookings, overrides, nowIso);
  assert.equal(daily[0].bookedRooms, 2);
  assert.equal(daily[0].heldRooms, 1);
  assert.equal(daily[0].availableRooms, 1); // 4 - 2 - 1 = 1
  assert.equal(daily[1].availableRooms, 2); // b2 checked out on 2nd
  assert.equal(daily[3].isBlocked, true);
  assert.equal(daily[3].availableRooms, 0);

  const ok = validateStayAvailability(mateli, '2026-12-01', '2026-12-03', 1, bookings, overrides, nowIso);
  assert.equal(ok.valid, true);

  const overbooked = validateStayAvailability(mateli, '2026-12-01', '2026-12-03', 2, bookings, overrides, nowIso);
  assert.equal(overbooked.valid, false);

  const blocked = validateStayAvailability(mateli, '2026-12-03', '2026-12-05', 1, bookings, overrides, nowIso);
  assert.equal(blocked.valid, false);
});

test('UPI URI, booking ref, and CSV formula sanitization', () => {
  const uri = buildUpiPaymentUri({
    upiId: 'nightingaletea@icici',
    merchantName: 'Nightingale Tea Tourism',
    amountInr: 24000,
    bookingRef: 'NTT-2026-1042',
  });
  assert.match(uri, /^upi:\/\/pay\?pa=nightingaletea%40icici/);
  assert.match(uri, /am=24000\.00/);
  assert.equal(generateBookingReference(42), 'NTT-2026-0042');
  assert.equal(escapeCsvCell('=CMD|calc'), `"'=CMD|calc"`);
});

test('Multi-room category availability & room-category tariff calculation work end-to-end', () => {
  const multiEstate: Estate = {
    ...mateli,
    totalRooms: 6,
    roomCategories: [
      {
        id: 'rm-a',
        estateId: 'est-mateli',
        name: 'Burra Sahib Heritage Suite',
        unitLabels: ['M-101', 'M-102'],
        totalUnits: 2,
        mapRate: 11000,
        allMealsRate: 13000,
        bedType: 'King Four-Poster',
        isActive: true,
      },
      {
        id: 'rm-b',
        estateId: 'est-mateli',
        name: 'Garden Veranda Deluxe Room',
        unitLabels: ['M-103', 'M-104', 'M-105', 'M-106'],
        totalUnits: 4,
        mapRate: 10000,
        allMealsRate: 12000,
        bedType: 'Queen Bed',
        isActive: true,
      },
    ],
  };

  assert.equal(getEstateTotalRooms(multiEstate), 6);

  const nowIso = '2026-11-15T10:00:00.000Z';
  const bookings: Booking[] = [
    {
      id: 'b-cat-1',
      bookingRef: 'NTT-2026-2001',
      estateId: 'est-mateli',
      estateName: 'Mateli Tea Estate',
      roomTypeId: 'rm-a',
      roomTypeName: 'Burra Sahib Heritage Suite',
      roomSummary: '2 × Burra Sahib Heritage Suite · MAP',
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      nights: 2,
      roomsCount: 2,
      adults: 4,
      children5to12: 0,
      childrenUnder5: 0,
      mealPlan: 'MAP',
      guestName: 'Test Guest',
      guestPhone: '9830001122',
      guestEmail: 'test@example.com',
      guestCity: 'Kolkata',
      baseRoomTotal: 44000,
      extraAdultTotal: 0,
      childTotal: 0,
      gstAmount: 0,
      totalAmount: 44000,
      paymentMethod: 'RAZORPAY',
      status: 'CONFIRMED',
      sourceChannel: 'PORTAL',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const summary = computeEstateSearchAvailability(
    multiEstate,
    '2026-12-10',
    '2026-12-12',
    bookings,
    [],
    nowIso
  );
  assert.equal(summary.minAvailableRooms, 4);
  assert.equal(summary.categoryAvailability[0].availableUnits, 0);
  assert.equal(summary.categoryAvailability[1].availableUnits, 4);

  const catAUnavailable = validateStayAvailability(
    multiEstate,
    '2026-12-10',
    '2026-12-12',
    1,
    bookings,
    [],
    nowIso,
    'rm-a'
  );
  assert.equal(catAUnavailable.valid, false);

  const catBOk = validateStayAvailability(
    multiEstate,
    '2026-12-10',
    '2026-12-12',
    2,
    bookings,
    [],
    nowIso,
    'rm-b'
  );
  assert.equal(catBOk.valid, true);

  const suiteQuote = calculateBookingTariff({
    estate: multiEstate,
    roomCategory: multiEstate.roomCategories![0],
    checkIn: '2026-12-10',
    checkOut: '2026-12-12',
    roomsCount: 1,
    adults: 2,
    children5to12: 0,
    childrenUnder5: 0,
    mealPlan: 'MAP',
  });
  assert.equal(suiteQuote.baseRoomTotal, 22000);
});
