import fs from 'node:fs/promises';
import path from 'node:path';
import {
  addDaysIso,
  formatIsoDateUtc,
  generateBookingReference,
  getEstateTotalRooms,
  type AuditLog,
  type Booking,
  type Estate,
  type InventoryOverride,
  type RoomCategory,
  type SystemSettings,
} from './booking-engine';

export interface DatabaseState {
  nextBookingSeq: number;
  estates: Estate[];
  overrides: InventoryOverride[];
  bookings: Booking[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
}

const DB_PATH = path.join(process.cwd(), 'data', 'nightingale-db.json');

let memoryCache: DatabaseState | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function createInitialSeedState(): DatabaseState {
  const today = formatIsoDateUtc(new Date());
  const dMinus1 = addDaysIso(today, -1);
  const dPlus1 = addDaysIso(today, 1);
  const dPlus2 = addDaysIso(today, 2);
  const dPlus3 = addDaysIso(today, 3);
  const dPlus5 = addDaysIso(today, 5);
  const dPlus7 = addDaysIso(today, 7);
  const dPlus8 = addDaysIso(today, 8);
  const nowIso = new Date().toISOString();
  const holdUntil = new Date(Date.now() + 28 * 60 * 1000).toISOString();

  const estates: Estate[] = [
    {
      id: 'est-mateli',
      slug: 'mateli',
      name: 'Mateli Tea Estate',
      subtitle: 'Heritage Planter Bungalow',
      location: 'Matelli, Dooars, West Bengal',
      distanceFromAirport: '90 km from Bagdogra Airport',
      nearestStation: 'Chalsa Junction',
      accommodationType: 'Heritage Bungalow Suites',
      totalRooms: 6,
      roomCategories: [
        {
          id: 'rm-mat-suite',
          estateId: 'est-mateli',
          name: 'Burra Sahib Heritage Suite',
          unitLabels: ['M-101', 'M-102'],
          totalUnits: 2,
          mapRate: 10000,
          allMealsRate: 12000,
          bedType: 'King Four-Poster · Private Veranda',
          isActive: true,
        },
        {
          id: 'rm-mat-deluxe',
          estateId: 'est-mateli',
          name: 'Garden Veranda Deluxe Room',
          unitLabels: ['M-103', 'M-104'],
          totalUnits: 2,
          mapRate: 10000,
          allMealsRate: 12000,
          bedType: 'Queen Bed · Tea Lawn View',
          isActive: true,
        },
        {
          id: 'rm-mat-cottage',
          estateId: 'est-mateli',
          name: "Planter's Tea-View Room",
          unitLabels: ['M-105', 'M-106'],
          totalUnits: 2,
          mapRate: 10000,
          allMealsRate: 12000,
          bedType: 'King / Twin · Factory Trail Access',
          isActive: true,
        },
      ],
      maxAdultsPerRoom: 3,
      maxChildrenPerRoom: 2,
      mapBaseRate: 10000,
      allMealsBaseRate: 12000,
      extraAdultMapRate: 3500,
      extraAdultAllMealsRate: 5000,
      child5to12MapRate: 3500,
      child5to12AllMealsRate: 2000,
      amenities: [
        'Guided Tea Factory Visit',
        'Curated Tea Tasting',
        'Veranda Dining',
        'Power Backup & Hot Water',
        'Dedicated Estate Staff',
      ],
      nearbyAttractions: [
        'Chapramari Wildlife Sanctuary',
        'Gorumara National Park',
        'Samsing & Suntalekhola',
        'Jhalong & Bindu',
      ],
      imageUrl: '/images/estate_mateli.jpg',
      isActive: true,
    },
    {
      id: 'est-jainti',
      slug: 'jainti',
      name: 'Jainti Tea Estate',
      subtitle: 'Hill-View Bungalow & Cottages',
      location: 'Jayanti / Chuniajhora, Dooars, West Bengal',
      distanceFromAirport: '220 km from Bagdogra Airport',
      nearestStation: 'Alipurduar Junction',
      accommodationType: 'Hill-View Bungalows & Cottages',
      totalRooms: 6,
      roomCategories: [
        {
          id: 'rm-jai-suite',
          estateId: 'est-jainti',
          name: 'Bhutan Foothills Hill-View Suite',
          unitLabels: ['J-201', 'J-202'],
          totalUnits: 2,
          mapRate: 10000,
          allMealsRate: 12000,
          bedType: 'King Bed · Foothills Viewing Deck',
          isActive: true,
        },
        {
          id: 'rm-jai-cottage',
          estateId: 'est-jainti',
          name: 'Buxa Forest Timber Cottage',
          unitLabels: ['J-203', 'J-204'],
          totalUnits: 2,
          mapRate: 10000,
          allMealsRate: 12000,
          bedType: 'King Bed · Forest Sit-Out',
          isActive: true,
        },
        {
          id: 'rm-jai-river',
          estateId: 'est-jainti',
          name: 'Chuniajhora Riverfront Room',
          unitLabels: ['J-205', 'J-206'],
          totalUnits: 2,
          mapRate: 10000,
          allMealsRate: 12000,
          bedType: 'Double Bed · Hill Breeze Porch',
          isActive: true,
        },
      ],
      maxAdultsPerRoom: 3,
      maxChildrenPerRoom: 2,
      mapBaseRate: 10000,
      allMealsBaseRate: 12000,
      extraAdultMapRate: 3500,
      extraAdultAllMealsRate: 5000,
      child5to12MapRate: 3500,
      child5to12AllMealsRate: 2000,
      amenities: [
        'Bhutan Foothills Panorama',
        'Guided Tea Factory Tour',
        'Tea Tasting Session',
        'Room Heaters & Hot Water',
        'Forest Birding Trails',
      ],
      nearbyAttractions: [
        'Buxa Tiger Reserve & Fort',
        'Jayanti Riverbed',
        'Mahakal Cave',
        "Rover's Point & Pokhri Hill",
      ],
      imageUrl: '/images/estate_jainti.jpg',
      isActive: true,
    },
    {
      id: 'est-chuapara',
      slug: 'chuapara',
      name: 'Chuapara Tea Estate',
      subtitle: 'Executive Plantation Cottages',
      location: 'Chuapara, Dooars, West Bengal',
      distanceFromAirport: '170 km from Bagdogra / NJP',
      nearestStation: 'Hamiltonganj & Kalchini (7 km)',
      accommodationType: 'Executive Multi-Room Cottages',
      totalRooms: 8,
      roomCategories: [
        {
          id: 'rm-chu-exec',
          estateId: 'est-chuapara',
          name: 'Executive Plantation Cottage',
          unitLabels: ['C-301', 'C-302', 'C-303'],
          totalUnits: 3,
          mapRate: 8000,
          allMealsRate: 10000,
          bedType: 'King Bed · Private Sit-Out',
          isActive: true,
        },
        {
          id: 'rm-chu-family',
          estateId: 'est-chuapara',
          name: 'Duplex Family Tea Cottage',
          unitLabels: ['C-304', 'C-305', 'C-306'],
          totalUnits: 3,
          mapRate: 8000,
          allMealsRate: 10000,
          bedType: 'Twin / King · Dining Porch',
          isActive: true,
        },
        {
          id: 'rm-chu-orchid',
          estateId: 'est-chuapara',
          name: 'Orchid Lawn Standard Room',
          unitLabels: ['C-307', 'C-308'],
          totalUnits: 2,
          mapRate: 8000,
          allMealsRate: 10000,
          bedType: 'Queen Bed · Garden Courtyard',
          isActive: true,
        },
      ],
      maxAdultsPerRoom: 3,
      maxChildrenPerRoom: 2,
      mapBaseRate: 8000,
      allMealsBaseRate: 10000,
      extraAdultMapRate: 2500,
      extraAdultAllMealsRate: 3000,
      child5to12MapRate: 2000,
      child5to12AllMealsRate: 1500,
      amenities: [
        'Private Sit-Out Balcony',
        'Attached Dining Area',
        'Tea Garden Walks',
        'Power Backup & Hot Water',
        'Dedicated Estate Staff',
      ],
      nearbyAttractions: [
        'Buxa Tiger Reserve',
        'Chilapata Forest',
        'Bhutan Border (Jaigaon)',
        'Dukpa Tribal Settlement',
      ],
      imageUrl: '/images/estate_chuapara.jpg',
      isActive: true,
    },
  ];

  const overrides: InventoryOverride[] = [
    {
      id: 'ov-mateli-peak',
      estateId: 'est-mateli',
      date: dPlus5,
      isBlocked: false,
      minStay: 2,
      mapRateOverride: 11500,
      allMealsRateOverride: 13500,
    },
    {
      id: 'ov-jainti-maint',
      estateId: 'est-jainti',
      date: dPlus8,
      isBlocked: true,
      blockReason: 'Annual Bungalow Maintenance',
    },
  ];

  const bookings: Booking[] = [
    {
      id: 'bk-1001',
      bookingRef: generateBookingReference(1001, 2026),
      estateId: 'est-mateli',
      estateName: 'Mateli Tea Estate',
      roomTypeId: 'rm-mat-suite',
      roomTypeName: 'Burra Sahib Heritage Suite',
      roomSummary: '1 × Burra Sahib Heritage Suite · All Meals',
      checkIn: today,
      checkOut: dPlus2,
      nights: 2,
      roomsCount: 1,
      adults: 2,
      children5to12: 1,
      childrenUnder5: 0,
      mealPlan: 'ALL_MEALS',
      guestName: 'Anirban Chatterjee',
      guestPhone: '9830112233',
      guestEmail: 'anirban.c@example.com',
      guestCity: 'Kolkata',
      idProofType: 'Aadhaar',
      specialRequests: 'Early morning tea factory walk preferred',
      baseRoomTotal: 24000,
      extraAdultTotal: 0,
      childTotal: 4000,
      gstAmount: 0,
      totalAmount: 28000,
      paymentMethod: 'RAZORPAY',
      status: 'CONFIRMED',
      razorpayOrderId: 'order_NTT982341A',
      razorpayPaymentId: 'pay_NTT774129Z',
      holdExpiresAt: null,
      sourceChannel: 'MAIN_SITE_LINK',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'bk-1002',
      bookingRef: generateBookingReference(1002, 2026),
      estateId: 'est-chuapara',
      estateName: 'Chuapara Tea Estate',
      roomTypeId: 'rm-chu-exec',
      roomTypeName: 'Executive Plantation Cottage',
      roomSummary: '2 × Executive Plantation Cottage · MAP',
      checkIn: dMinus1,
      checkOut: today,
      nights: 1,
      roomsCount: 2,
      adults: 4,
      children5to12: 0,
      childrenUnder5: 1,
      mealPlan: 'MAP',
      guestName: 'Priyanka Mukherjee',
      guestPhone: '9831998877',
      guestEmail: 'priyanka.m@example.com',
      guestCity: 'Siliguri',
      idProofType: 'Passport',
      baseRoomTotal: 16000,
      extraAdultTotal: 0,
      childTotal: 0,
      gstAmount: 0,
      totalAmount: 16000,
      paymentMethod: 'MANUAL_UPI',
      status: 'CHECKED_IN',
      upiUtr: '431982761045',
      holdExpiresAt: null,
      sourceChannel: 'PORTAL',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'bk-1003',
      bookingRef: generateBookingReference(1003, 2026),
      estateId: 'est-jainti',
      estateName: 'Jainti Tea Estate',
      roomTypeId: 'rm-jai-cottage',
      roomTypeName: 'Buxa Forest Timber Cottage',
      roomSummary: '1 × Buxa Forest Timber Cottage · MAP',
      checkIn: dPlus1,
      checkOut: dPlus3,
      nights: 2,
      roomsCount: 1,
      adults: 3,
      children5to12: 0,
      childrenUnder5: 0,
      mealPlan: 'MAP',
      guestName: 'Subhajit Roy',
      guestPhone: '9874556611',
      guestEmail: 'subhajit.roy@example.com',
      guestCity: 'Guwahati',
      idProofType: 'Driving License',
      specialRequests: 'Buxa safari jeep assistance on Day 2',
      baseRoomTotal: 20000,
      extraAdultTotal: 7000,
      childTotal: 0,
      gstAmount: 0,
      totalAmount: 27000,
      paymentMethod: 'MANUAL_UPI',
      status: 'PENDING_VERIFICATION',
      upiUtr: '432055449918',
      holdExpiresAt: holdUntil,
      sourceChannel: 'PORTAL',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'bk-1004',
      bookingRef: generateBookingReference(1004, 2026),
      estateId: 'est-mateli',
      estateName: 'Mateli Tea Estate',
      roomTypeId: 'rm-mat-deluxe',
      roomTypeName: 'Garden Veranda Deluxe Room',
      roomSummary: '1 × Garden Veranda Deluxe Room · MAP',
      checkIn: dPlus3,
      checkOut: dPlus5,
      nights: 2,
      roomsCount: 1,
      adults: 2,
      children5to12: 1,
      childrenUnder5: 0,
      mealPlan: 'MAP',
      guestName: 'Devika Sen',
      guestPhone: '9007123456',
      guestEmail: 'devika.sen@example.com',
      guestCity: 'Bengaluru',
      baseRoomTotal: 20000,
      extraAdultTotal: 0,
      childTotal: 7000,
      gstAmount: 0,
      totalAmount: 27000,
      paymentMethod: 'MANUAL_UPI',
      status: 'PENDING_VERIFICATION',
      upiUtr: '432098712304',
      holdExpiresAt: holdUntil,
      sourceChannel: 'MAIN_SITE_LINK',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'bk-1005',
      bookingRef: generateBookingReference(1005, 2026),
      estateId: 'est-chuapara',
      estateName: 'Chuapara Tea Estate',
      roomTypeId: 'rm-chu-family',
      roomTypeName: 'Duplex Family Tea Cottage',
      roomSummary: '1 × Duplex Family Tea Cottage · All Meals',
      checkIn: dPlus5,
      checkOut: dPlus7,
      nights: 2,
      roomsCount: 1,
      adults: 2,
      children5to12: 2,
      childrenUnder5: 0,
      mealPlan: 'ALL_MEALS',
      guestName: 'Rohan & Aditi Verma',
      guestPhone: '9811223344',
      guestEmail: 'rohan.verma@example.com',
      guestCity: 'New Delhi',
      baseRoomTotal: 20000,
      extraAdultTotal: 0,
      childTotal: 6000,
      gstAmount: 0,
      totalAmount: 26000,
      paymentMethod: 'RAZORPAY',
      status: 'CONFIRMED',
      razorpayOrderId: 'order_NTT661209K',
      razorpayPaymentId: 'pay_NTT889912M',
      holdExpiresAt: null,
      sourceChannel: 'PORTAL',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud-1',
      actor: 'RAZORPAY_WEBHOOK',
      action: 'PAYMENT_CONFIRMED',
      targetRef: 'NTT-2026-1001',
      details: 'Razorpay payment pay_NTT774129Z verified via HMAC-SHA256.',
      createdAt: nowIso,
    },
    {
      id: 'aud-2',
      actor: 'GUEST:9874556611',
      action: 'UPI_UTR_SUBMITTED',
      targetRef: 'NTT-2026-1003',
      details: 'Submitted Manual UPI UTR 432055449918 for Jainti Tea Estate.',
      createdAt: nowIso,
    },
    {
      id: 'aud-3',
      actor: 'ADMIN:director',
      action: 'INVENTORY_OVERRIDE',
      targetRef: 'est-jainti',
      details: `Blocked ${dPlus8} for Annual Bungalow Maintenance.`,
      createdAt: nowIso,
    },
  ];

  return {
    nextBookingSeq: 1006,
    estates,
    overrides,
    bookings,
    auditLogs,
    settings: {
      brandName: 'Nightingale Tea Tourism',
      primaryDomain: 'https://nightingaletea.com',
      bookingSubdomain: 'https://booking.nightingaletea.com',
      upiId: 'nightingaletea@icici',
      upiMerchantName: 'Nightingale Tea Tourism',
      holdTtlMinutes: 30,
      gstPercentage: 0,
      razorpayEnabled: true,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
      manualUpiEnabled: true,
      supportPhone: '+91 95839 36626',
      supportEmail: 'sales@nightingaletea.in',
    },
  };
}

function backfillRoomCategories(state: DatabaseState): boolean {
  let mutated = false;
  const seed = createInitialSeedState();
  const seedMap = new Map<string, RoomCategory[]>(
    seed.estates.map((e) => [e.id, e.roomCategories || []])
  );
  for (const est of state.estates) {
    if (!est.roomCategories || est.roomCategories.length === 0) {
      est.roomCategories = seedMap.get(est.id) || [];
      est.totalRooms = getEstateTotalRooms(est);
      mutated = true;
    }
  }
  return mutated;
}

export async function readDb(): Promise<DatabaseState> {
  if (memoryCache) {
    return structuredClone(memoryCache);
  }
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as DatabaseState;
    if (backfillRoomCategories(parsed)) {
      await persistDb(parsed);
    } else {
      memoryCache = parsed;
    }
    return structuredClone(parsed);
  } catch {
    const seed = createInitialSeedState();
    await persistDb(seed);
    return structuredClone(seed);
  }
}

async function persistDb(state: DatabaseState): Promise<void> {
  memoryCache = structuredClone(state);
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(tmp, DB_PATH);
}

export async function mutateDb<T>(fn: (draft: DatabaseState) => T | Promise<T>): Promise<T> {
  let result!: T;
  const run = async () => {
    const current = await readDb();
    result = await fn(current);
    await persistDb(current);
  };
  writeQueue = writeQueue.then(run, run);
  await writeQueue;
  return result;
}
