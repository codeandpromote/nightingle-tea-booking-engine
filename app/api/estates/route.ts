import { NextRequest, NextResponse } from 'next/server';
import {
  addDaysIso,
  computeDailyAvailability,
  computeEstateSearchAvailability,
  formatIsoDateUtc,
  type StaySearchSummary,
} from '@/lib/booking-engine';
import { readDb } from '@/lib/store';

export async function GET(req: NextRequest) {
  const db = await readDb();
  const { searchParams } = new URL(req.url);
  const estateSlug = searchParams.get('estate');
  const today = formatIsoDateUtc(new Date());
  const start = searchParams.get('start') || today;
  const days = Math.min(45, Math.max(1, Number(searchParams.get('days') || 21)));
  const checkIn = searchParams.get('checkIn') || addDaysIso(today, 1);
  const checkOut = searchParams.get('checkOut') || addDaysIso(checkIn, 2);
  const nowIso = new Date().toISOString();

  if (estateSlug) {
    const estate = db.estates.find((e) => e.slug === estateSlug || e.id === estateSlug);
    if (!estate) {
      return NextResponse.json({ error: 'Estate not found' }, { status: 404 });
    }
    const calendar = computeDailyAvailability(estate, start, days, db.bookings, db.overrides, nowIso);
    let searchSummary: StaySearchSummary | null = null;
    try {
      searchSummary = computeEstateSearchAvailability(estate, checkIn, checkOut, db.bookings, db.overrides, nowIso);
    } catch {
      searchSummary = null;
    }
    return NextResponse.json({ estate, calendar, searchSummary, settings: db.settings });
  }

  const calendars: Record<string, ReturnType<typeof computeDailyAvailability>> = {};
  const searchSummaries: Record<string, StaySearchSummary> = {};
  for (const estate of db.estates) {
    calendars[estate.slug] = computeDailyAvailability(estate, start, days, db.bookings, db.overrides, nowIso);
    try {
      searchSummaries[estate.slug] = computeEstateSearchAvailability(
        estate,
        checkIn,
        checkOut,
        db.bookings,
        db.overrides,
        nowIso
      );
    } catch {
      // ignore invalid search range
    }
  }

  return NextResponse.json({
    estates: db.estates,
    calendars,
    searchSummaries,
    settings: db.settings,
  });
}
