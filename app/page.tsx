import React from 'react';
import {
  addDaysIso,
  computeDailyAvailability,
  computeEstateSearchAvailability,
  formatIsoDateUtc,
  type StaySearchSummary,
} from '@/lib/booking-engine';
import { readDb } from '@/lib/store';
import NightingalePortalShell from '@/components/NightingalePortalShell';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const db = await readDb();
  const today = formatIsoDateUtc(new Date());
  const defaultCheckIn = addDaysIso(today, 1);
  const defaultCheckOut = addDaysIso(today, 3);
  const nowIso = new Date().toISOString();

  const calendars: Record<string, ReturnType<typeof computeDailyAvailability>> = {};
  const searchSummaries: Record<string, StaySearchSummary> = {};
  for (const estate of db.estates) {
    calendars[estate.slug] = computeDailyAvailability(
      estate,
      today,
      21,
      db.bookings,
      db.overrides,
      nowIso
    );
    searchSummaries[estate.slug] = computeEstateSearchAvailability(
      estate,
      defaultCheckIn,
      defaultCheckOut,
      db.bookings,
      db.overrides,
      nowIso
    );
  }

  const pendingCount = db.bookings.filter(
    (b) => b.status === 'PENDING_VERIFICATION'
  ).length;

  return (
    <NightingalePortalShell
      initialEstates={db.estates}
      initialCalendars={calendars}
      initialSearchSummaries={searchSummaries}
      initialSettings={db.settings}
      initialPendingCount={pendingCount}
    />
  );
}
