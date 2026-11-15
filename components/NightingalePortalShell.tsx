'use client';

import React from 'react';
import type {
  DailyAvailability,
  Estate,
  StaySearchSummary,
  SystemSettings,
} from '@/lib/booking-engine';
import TopNavbar, { type AppSection } from './TopNavbar';
import GuestBookingPortal from './GuestBookingPortal';
import { TrackBookingSection } from './DigitalReceiptCard';
import AdminConsole from './AdminConsole';
import PhpCpanelKit from './PhpCpanelKit';

interface NightingalePortalShellProps {
  initialEstates: Estate[];
  initialCalendars: Record<string, DailyAvailability[]>;
  initialSearchSummaries: Record<string, StaySearchSummary>;
  initialSettings: SystemSettings;
  initialPendingCount: number;
}

export default function NightingalePortalShell({
  initialEstates,
  initialCalendars,
  initialSearchSummaries,
  initialSettings,
  initialPendingCount,
}: NightingalePortalShellProps) {
  const [activeSection, setActiveSection] = React.useState<AppSection>('booking');
  const [pendingCount, setPendingCount] = React.useState<number>(initialPendingCount);
  const bookingSectionRef = React.useRef<HTMLElement | null>(null);

  const syncPendingCount = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) return;
      const json = await res.json();
      if (json?.kpis?.pendingVerifications !== undefined) {
        setPendingCount(json.kpis.pendingVerifications);
      }
    } catch {
      // ignore transient errors
    }
  }, []);

  const handleBookNow = () => {
    setActiveSection('booking');
    setTimeout(() => {
      bookingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF8]">
      <TopNavbar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        onBookNow={handleBookNow}
        pendingCount={pendingCount}
      />

      <main className="flex-1">
        {activeSection === 'booking' && (
          <GuestBookingPortal
            initialEstates={initialEstates}
            initialCalendars={initialCalendars}
            initialSearchSummaries={initialSearchSummaries}
            initialSettings={initialSettings}
            onBookingCreated={syncPendingCount}
            bookingSectionRef={bookingSectionRef}
          />
        )}

        {activeSection === 'track' && <TrackBookingSection />}

        {activeSection === 'admin' && (
          <AdminConsole onDataChanged={syncPendingCount} />
        )}

        {activeSection === 'php-kit' && <PhpCpanelKit />}
      </main>

      <footer className="no-print border-t border-[#E4E4E0] bg-white py-8">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#556159]">
          <div>
            <span className="font-semibold text-[#141C17]">Nightingale Tea Tourism</span>
            {' · '}11, Shakespeare Sarani, Kolkata 700071{' · '}Dooars Heritage Stays
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>{initialSettings.supportPhone}</span>
            <span aria-hidden="true">·</span>
            <span>{initialSettings.supportEmail}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveSection('php-kit')}
              className="underline hover:text-[#1B4332] cursor-pointer"
            >
              cPanel PHP Deployment Kit
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
